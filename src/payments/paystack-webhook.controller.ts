import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { PaystackService } from '../paystack/paystack.service';
import { PaymentsService } from './payments.service';

// Set this URL as the webhook in the Paystack dashboard: {API}/api/payments/paystack/webhook
@Controller('payments/paystack')
@SkipThrottle()
export class PaystackWebhookController {
  private readonly logger = new Logger(PaystackWebhookController.name);

  constructor(
    private readonly paystack: PaystackService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature?: string,
  ) {
    if (!this.paystack.isValidWebhookSignature(req.rawBody, signature)) {
      throw new UnauthorizedException('Invalid signature');
    }
    try {
      await this.paymentsService.handleWebhook(
        req.body as { event?: string; data?: { reference?: string } },
      );
    } catch (err) {
      // A 500 makes Paystack retry, which is what we want if crediting failed midway.
      this.logger.error(`Webhook handling failed — ${(err as Error).message}`);
      throw err;
    }
    return { received: true };
  }
}
