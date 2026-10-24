import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { randomBytes } from 'crypto';
import {
  Payment,
  PaymentDocument,
  PaymentPurpose,
  PaymentStatus,
} from './schemas/payment.schema';
import { InitializeContributionDto } from './dto/initialize-contribution.dto';
import { splitGift } from './split.util';
import { PaystackService } from '../paystack/paystack.service';
import { SettingsService } from '../settings/settings.service';
import { BankAccountsService } from '../bank-accounts/bank-accounts.service';
import { WalletsService } from '../wallets/wallets.service';
import { WishItemsService } from '../wishlists/wish-items.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditEntityType } from '../audit-log/schemas/audit-log.schema';
import { AccountStatus, User } from '../users/schemas/user.schema';
import { WishItem } from '../wishlists/schemas/wish-item.schema';
import { Wishlist } from '../wishlists/schemas/wishlist.schema';
import { Contributor } from '../contributors/schemas/contributor.schema';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../transactions/schemas/transaction.schema';

const naira = (amount: number) => `₦${amount.toLocaleString('en-NG')}`;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(WishItem.name) private readonly wishItemModel: Model<WishItem>,
    @InjectModel(Wishlist.name) private readonly wishlistModel: Model<Wishlist>,
    @InjectModel(Contributor.name)
    private readonly contributorModel: Model<Contributor>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
    private readonly paystack: PaystackService,
    private readonly settings: SettingsService,
    private readonly bankAccounts: BankAccountsService,
    private readonly wallets: WalletsService,
    private readonly wishItems: WishItemsService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly auditLog: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  // Fixes the split up front (wisher, referrer if they have bank details, Wishers keeps the rest)
  // and opens a Paystack checkout for gift + fee.
  async initializeContribution(dto: InitializeContributionDto) {
    const wishItem = await this.wishItemModel
      .findOne({ slug: dto.wishItemSlug, active: true })
      .exec();
    if (!wishItem) throw new NotFoundException('Wish not found');
    const wishlist = await this.wishlistModel
      .findOne({ _id: wishItem.wishlist, active: true })
      .select('_id')
      .exec();
    if (!wishlist) throw new NotFoundException('Wish not found');

    const owner = await this.userModel.findById(wishItem.owner).exec();
    if (!owner || owner.accountStatus !== AccountStatus.ACTIVE) {
      throw new BadRequestException(
        'This wisher can’t receive gifts right now',
      );
    }
    const ownerBank = await this.bankAccounts.getMine(owner._id.toString());
    if (!ownerBank?.subaccountCode) {
      throw new BadRequestException(
        'This wisher hasn’t added their bank details yet, so they can’t receive gifts',
      );
    }

    const settings = await this.settings.get();
    if (dto.amount < settings.minContributionAmount) {
      throw new BadRequestException(
        `The smallest gift is ${naira(settings.minContributionAmount)}`,
      );
    }

    const referrer = await this.eligibleReferrer(
      owner.referredBy?.toString(),
      ownerBank.subaccountCode,
    );
    const split = splitGift(
      dto.amount,
      settings.wisherSharePercentage,
      referrer ? settings.referrerSharePercentage : null,
    );

    const reference = `WSH_${Date.now().toString(36)}_${randomBytes(6).toString('hex')}`;
    const payment = await this.paymentModel.create({
      reference,
      purpose: PaymentPurpose.CONTRIBUTION,
      email: dto.email,
      giftAmount: split.giftAmount,
      charges: split.charges,
      totalAmount: split.totalAmount,
      owner: owner._id,
      wishItem: wishItem._id,
      wishlist: wishItem.wishlist,
      wishItemSlug: wishItem.slug,
      wisherShare: split.wisherShare,
      wisherSubaccount: ownerBank.subaccountCode,
      ...(referrer && {
        referrer: referrer.userId,
        referrerShare: split.referrerShare,
        referrerSubaccount: referrer.subaccountCode,
      }),
      appShare: split.appShare,
    });

    try {
      const checkout = await this.paystack.initializeTransaction({
        email: dto.email,
        amountKobo: split.totalAmount * 100,
        reference,
        shares: [
          {
            subaccount: ownerBank.subaccountCode,
            share: split.wisherShare * 100,
          },
          ...(referrer
            ? [
                {
                  subaccount: referrer.subaccountCode,
                  share: split.referrerShare * 100,
                },
              ]
            : []),
        ],
        callbackUrl: this.safeCallbackUrl(dto.callbackUrl),
        metadata: {
          purpose: PaymentPurpose.CONTRIBUTION,
          paymentId: payment._id.toString(),
        },
      });
      return {
        reference,
        authorizationUrl: checkout.authorization_url,
        accessCode: checkout.access_code,
        giftAmount: split.giftAmount,
        charges: split.charges,
        totalAmount: split.totalAmount,
      };
    } catch (err) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = 'initialize_failed';
      await payment.save();
      throw err;
    }
  }

  // Called by the webhook and by the pay page after checkout. Safe to call any number of times.
  async confirm(reference: string) {
    const payment = await this.paymentModel.findOne({ reference }).exec();
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.PENDING) {
      await this.verifyAndCredit(payment);
    }
    const latest = (await this.paymentModel.findById(payment._id).exec())!;
    return {
      reference,
      status: latest.status,
      giftAmount: latest.giftAmount,
      totalAmount: latest.totalAmount,
      wishItemSlug: latest.wishItemSlug,
    };
  }

  async handleWebhook(event: {
    event?: string;
    data?: { reference?: string };
  }) {
    const reference = event.data?.reference;
    if (event.event !== 'charge.success' || !reference) return;
    const payment = await this.paymentModel.findOne({ reference }).exec();
    // Not one of ours (or not a gift) — nothing to do.
    if (!payment || payment.status !== PaymentStatus.PENDING) return;
    await this.verifyAndCredit(payment);
  }

  // The webhook body is never trusted on its own: Paystack is asked again, and the amount checked.
  private async verifyAndCredit(payment: PaymentDocument): Promise<void> {
    const tx = await this.paystack.verifyTransaction(payment.reference);
    if (tx.status === 'failed') {
      await this.paymentModel
        .updateOne(
          { _id: payment._id, status: PaymentStatus.PENDING },
          { status: PaymentStatus.FAILED, failureReason: 'declined' },
        )
        .exec();
      return;
    }
    if (tx.status !== 'success') return;

    if (tx.amount !== payment.totalAmount * 100 || tx.currency !== 'NGN') {
      const flagged = await this.paymentModel
        .updateOne(
          { _id: payment._id, status: PaymentStatus.PENDING },
          { status: PaymentStatus.FLAGGED, failureReason: 'amount_mismatch' },
        )
        .exec();
      if (flagged.modifiedCount) {
        this.logger.error(
          `Payment ${payment.reference} amount mismatch: paid ${tx.amount} ${tx.currency}, expected ${payment.totalAmount * 100} NGN`,
        );
        await this.auditLog.record({
          entityType: AuditEntityType.PAYMENT,
          entityId: payment._id.toString(),
          event: 'payment.flagged',
          actor: 'system',
          metadata: {
            reference: payment.reference,
            paid: tx.amount,
            currency: tx.currency,
          },
        });
      }
      return;
    }

    const paidAt = tx.paid_at ? new Date(tx.paid_at) : new Date();
    const credited = await this.credit(payment, paidAt);
    if (credited) await this.afterCredit(payment);
  }

  // One Mongo transaction: flip the payment to success (only once), then the ledger rows, the
  // anonymous contributor, both wallets and the wish's total. Returns false if already credited.
  private async credit(
    payment: PaymentDocument,
    paidAt: Date,
  ): Promise<boolean> {
    return this.connection.transaction(async (session) => {
      const flipped = await this.paymentModel
        .findOneAndUpdate(
          { _id: payment._id, status: PaymentStatus.PENDING },
          { status: PaymentStatus.SUCCESS, paidAt },
          { session, new: true },
        )
        .exec();
      if (!flipped) return false;

      const ownerId = payment.owner.toString();
      const wishItem = await this.wishItemModel
        .findById(payment.wishItem)
        .select('title')
        .session(session)
        .exec();
      const [wisherTx] = await this.transactionModel.create(
        [
          {
            owner: payment.owner,
            type: TransactionType.CONTRIBUTION,
            status: TransactionStatus.SUCCESS,
            amount: payment.wisherShare,
            giftAmount: payment.giftAmount,
            charges: payment.charges,
            reference: payment.reference,
            payment: payment._id,
            subaccountCode: payment.wisherSubaccount,
            paidAt,
            wishItem: payment.wishItem,
            wishItemSlug: payment.wishItemSlug,
            wishlist: payment.wishlist,
            description: wishItem ? `Gift towards "${wishItem.title}"` : 'Gift',
          },
        ],
        { session },
      );
      await this.contributorModel.create(
        [
          {
            owner: payment.owner,
            wishItem: payment.wishItem,
            wishlist: payment.wishlist,
            wishItemSlug: payment.wishItemSlug,
            email: payment.email,
            amount: payment.giftAmount,
            isAnonymous: true,
            transaction: wisherTx._id,
            reference: payment.reference,
          },
        ],
        { session },
      );
      await this.wallets.recordEarning(
        ownerId,
        payment.wisherShare,
        'contribution',
        session,
      );
      // The wish counts the full gift towards its goal.
      await this.wishItemModel
        .updateOne(
          { _id: payment.wishItem },
          { $inc: { amountReceived: payment.giftAmount, contributorCount: 1 } },
          { session },
        )
        .exec();
      await this.wishItemModel
        .updateOne(
          {
            _id: payment.wishItem,
            isCompleted: false,
            $expr: { $gte: ['$amountReceived', '$goalAmount'] },
          },
          { isCompleted: true },
          { session },
        )
        .exec();

      if (payment.referrer && payment.referrerShare > 0) {
        await this.transactionModel.create(
          [
            {
              owner: payment.referrer,
              type: TransactionType.REFERRAL_EARNING,
              status: TransactionStatus.SUCCESS,
              amount: payment.referrerShare,
              giftAmount: payment.giftAmount,
              reference: `${payment.reference}:referral`,
              payment: payment._id,
              subaccountCode: payment.referrerSubaccount,
              paidAt,
              description: 'Referral earning',
            },
          ],
          { session },
        );
        await this.wallets.recordEarning(
          payment.referrer.toString(),
          payment.referrerShare,
          'referral',
          session,
        );
      }
      return true;
    });
  }

  // Totals, live pings, notifications and the audit trail — after the money is safely recorded.
  private async afterCredit(payment: PaymentDocument): Promise<void> {
    const ownerId = payment.owner.toString();
    const wishItemId = payment.wishItem.toString();
    const wishlistId = payment.wishlist.toString();
    try {
      await this.wishItems.recalculateWishlistTotals(wishlistId);
      this.realtime.wishItemChanged(ownerId, wishItemId, wishlistId, 'updated');
      this.realtime.walletChanged(ownerId);

      const wishItem = await this.wishItemModel
        .findById(wishItemId)
        .select('title')
        .exec();
      await this.auditLog.record({
        entityType: AuditEntityType.PAYMENT,
        entityId: payment._id.toString(),
        event: 'payment.credited',
        actor: 'system',
        metadata: {
          reference: payment.reference,
          giftAmount: payment.giftAmount,
          wisherShare: payment.wisherShare,
          referrerShare: payment.referrerShare,
          appShare: payment.appShare,
        },
      });
      await this.notifications.notify(ownerId, {
        title: 'Hooray 🎉🎉, you just received a gift',
        body: `${naira(payment.giftAmount)} was just sent for "${wishItem?.title ?? 'your wish'}". ${naira(payment.wisherShare)} is on its way to your bank.`,
        type: 'contribution',
        reference: payment.reference,
      });

      if (payment.referrer && payment.referrerShare > 0) {
        const referrerId = payment.referrer.toString();
        this.realtime.walletChanged(referrerId);
        await this.notifications.notify(referrerId, {
          title: 'You earned a referral bonus',
          body: `${naira(payment.referrerShare)} from a gift to someone you invited is on its way to your bank.`,
          type: 'referral_earning',
          reference: payment.reference,
        });
      }
    } catch (err) {
      this.logger.error(
        `After-credit steps failed for ${payment.reference} — ${(err as Error).message}`,
      );
    }
  }

  // The referrer only shares in gifts if they have an active account and bank details.
  private async eligibleReferrer(
    referrerId: string | undefined,
    ownerSubaccount: string,
  ): Promise<{ userId: string; subaccountCode: string } | null> {
    if (!referrerId) return null;
    const referrer = await this.userModel
      .findById(referrerId)
      .select('accountStatus')
      .exec();
    if (!referrer || referrer.accountStatus !== AccountStatus.ACTIVE)
      return null;
    const bank = await this.bankAccounts.getMine(referrerId);
    if (!bank?.subaccountCode || bank.subaccountCode === ownerSubaccount) {
      return null;
    }
    return { userId: referrerId, subaccountCode: bank.subaccountCode };
  }

  // Only our own pay site may be the post-payment redirect. Localhost is allowed too (it can only
  // ever reach the giver's own machine), so the pay site can be tested locally against the live API.
  private safeCallbackUrl(url?: string): string | undefined {
    if (!url) return undefined;
    try {
      const target = new URL(url);
      const payApp = new URL(this.config.get<string>('PAY_APP_URL')!);
      const isLocal = ['localhost', '127.0.0.1'].includes(target.hostname);
      if (target.origin === payApp.origin || isLocal) return target.toString();
    } catch {
      // fall through
    }
    throw new BadRequestException(
      'callbackUrl must be on the Wishers pay site',
    );
  }
}
