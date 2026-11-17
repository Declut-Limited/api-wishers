import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';

const CHECK_EVERY_MS = 15 * 60 * 1000;
const FIRST_CHECK_AFTER_MS = 2 * 60 * 1000;

// Every 15 minutes: re-checks gifts still pending with Paystack and expires any older than a day.
@Injectable()
export class PendingPaymentsService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(PendingPaymentsService.name);
  private timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    const first = setTimeout(() => void this.check(), FIRST_CHECK_AFTER_MS);
    const every = setInterval(() => void this.check(), CHECK_EVERY_MS);
    first.unref();
    every.unref();
    this.timers = [first, every];
  }

  onModuleDestroy() {
    this.timers.forEach((t) => clearTimeout(t));
  }

  async check(): Promise<void> {
    if (this.running || !this.config.get<string>('PAYSTACK_SECRET_KEY')) return;
    this.running = true;
    try {
      const { checked, expired } = await this.payments.recheckPending();
      if (checked) {
        this.logger.log(
          `Re-checked ${checked} pending payment(s), expired ${expired}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Pending payment re-check failed — ${(err as Error).message}`,
      );
    } finally {
      this.running = false;
    }
  }
}
