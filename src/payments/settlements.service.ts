import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaystackService } from '../paystack/paystack.service';
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
      for (const { _id: subaccountCode, oldest } of pending) {
        await this.syncSubaccount(subaccountCode, oldest);
      }
    } catch (err) {
      this.logger.error(`Settlement sync failed — ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async syncSubaccount(subaccountCode: string, oldest: Date) {
    const from = new Date(
      (oldest ?? new Date()).getTime() - 24 * 60 * 60 * 1000,
    );
    const settlements = await this.paystack.listSettlements(
      subaccountCode,
      from,
    );
    for (const settlement of settlements) {
      if (!DONE_STATUSES.includes(settlement.status?.toLowerCase())) continue;
      const rows = await this.paystack.listSettlementTransactions(
        settlement.id,
      );
      const references = rows.flatMap((r) => [
        r.reference,
        `${r.reference}:referral`,
      ]);
      const settledAt = settlement.settlement_date
        ? new Date(settlement.settlement_date)
        : new Date();
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
}
