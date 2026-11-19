import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PaystackService,
  PaystackSettlement,
} from '../paystack/paystack.service';
import { WalletsService } from '../wallets/wallets.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  SettlementStatus,
  Transaction,
  TransactionStatus,
} from '../transactions/schemas/transaction.schema';

const SYNC_EVERY_MS = 60 * 60 * 1000;
const FIRST_SYNC_AFTER_MS = 60 * 1000;
const DONE_STATUSES = ['success', 'processed', 'settled'];
const MAX_PAGES = 20;

// Hourly: asks Paystack which settlements have reached each subaccount and moves the matching
// ledger rows (and wallet amounts) from pending to settled.
@Injectable()
export class SettlementsService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SettlementsService.name);
  private timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
    private readonly paystack: PaystackService,
    private readonly wallets: WalletsService,
    private readonly realtime: RealtimeService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    const first = setTimeout(() => void this.sync(), FIRST_SYNC_AFTER_MS);
    const every = setInterval(() => void this.sync(), SYNC_EVERY_MS);
    first.unref();
    every.unref();
    this.timers = [first, every];
  }

  onModuleDestroy() {
    this.timers.forEach((t) => clearTimeout(t));
  }

  async sync(): Promise<void> {
    if (this.running || !this.config.get<string>('PAYSTACK_SECRET_KEY')) return;
    this.running = true;
    try {
      const pending = await this.transactionModel.aggregate<{
        _id: string;
        oldest: Date;
      }>([
        {
          $match: {
            status: TransactionStatus.SUCCESS,
            settlementStatus: SettlementStatus.PENDING,
            subaccountCode: { $exists: true },
          },
        },
        { $group: { _id: '$subaccountCode', oldest: { $min: '$paidAt' } } },
      ]);
      if (!pending.length) return;
      const codes = new Set(pending.map((p) => p._id));
      const oldest = pending.reduce<Date>(
        (min, p) => (p.oldest && p.oldest < min ? p.oldest : min),
        new Date(),
      );
      await this.syncSince(
        new Date(oldest.getTime() - 24 * 60 * 60 * 1000),
        codes,
      );
    } catch (err) {
      this.logger.error(`Settlement sync failed — ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  // Every gift is split: our cut lands in Wishers' own payout, the rest in the wisher's (or
  // referrer's) subaccount payout. Paystack only lists the gifts inside OUR payouts, so a
  // subaccount payout that's done on day D settles that subaccount's pending gifts found in our
  // payouts up to day D.
  private async syncSince(from: Date, codes: Set<string>) {
    const settlements: PaystackSettlement[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await this.paystack.listSettlements(from, page);
      settlements.push(...batch);
      if (batch.length < 100) break;
    }

    const dayOf = (s: PaystackSettlement) =>
      (s.settlement_date ?? '').slice(0, 10);
    const ours = settlements.filter((s) => !s.subaccount && dayOf(s));
    const references = new Map<number, string[]>();
    const referencesFor = async (s: PaystackSettlement) => {
      if (!references.has(s.id)) {
        const rows = await this.paystack.listSettlementTransactions(s.id);
        references.set(
          s.id,
          rows.flatMap((r) => [r.reference, `${r.reference}:referral`]),
        );
      }
      return references.get(s.id) ?? [];
    };

    for (const settlement of settlements) {
      const subaccountCode = settlement.subaccount?.subaccount_code;
      if (!subaccountCode || !codes.has(subaccountCode)) continue;
      if (!DONE_STATUSES.includes(settlement.status?.toLowerCase())) continue;
      const day = dayOf(settlement);
      if (!day) continue;

      const refs: string[] = [];
      for (const s of ours.filter((o) => dayOf(o) <= day)) {
        refs.push(...(await referencesFor(s)));
      }
      if (!refs.length) continue;

      const settledAt = new Date(settlement.settlement_date as string);
      await this.settle(subaccountCode, refs, settledAt);
    }
  }

  private async settle(
    subaccountCode: string,
    references: string[],
    settledAt: Date,
  ) {
    const candidates = await this.transactionModel
      .find({
        reference: { $in: references },
        subaccountCode,
        settlementStatus: SettlementStatus.PENDING,
      })
      .select('_id')
      .exec();
    for (const { _id } of candidates) {
      // Flip once; only the call that flips it moves the wallet amount.
      const tx = await this.transactionModel
        .findOneAndUpdate(
          { _id, settlementStatus: SettlementStatus.PENDING },
          { settlementStatus: SettlementStatus.SETTLED, settledAt },
          { new: true },
        )
        .exec();
      if (!tx) continue;
      const ownerId = tx.owner.toString();
      await this.wallets.recordSettled(ownerId, tx.amount);
      this.realtime.walletChanged(ownerId);
    }
  }
}
