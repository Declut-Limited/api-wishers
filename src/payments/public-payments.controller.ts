import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { InitializeContributionDto } from './dto/initialize-contribution.dto';

// Unauthenticated — the pay.wishers.app checkout. Givers don't have accounts.
@Controller('public/payments')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class PublicPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('contributions')
  initializeContribution(@Body() dto: InitializeContributionDto) {
    return this.paymentsService.initializeContribution(dto);
  }

  // The pay page calls this after checkout; it verifies with Paystack and credits if the webhook hasn't yet.
  @Get(':reference')
  confirm(@Param('reference') reference: string) {
    return this.paymentsService.confirm(reference);
  }
}
