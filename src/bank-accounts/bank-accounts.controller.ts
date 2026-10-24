import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/interfaces/jwt-payload.interface';
import { BankAccountsService } from './bank-accounts.service';
import { BankAccountDto, ResolveBankAccountDto } from './dto/bank-account.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Get('banks')
  listBanks() {
    return this.bankAccountsService.listBanks();
  }

  // Paystack account lookup; tight limit since Paystack rate-limits it too.
  @Get('banks/resolve')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resolve(@Query() dto: ResolveBankAccountDto) {
    return this.bankAccountsService.resolve(dto);
  }

  @Post('bank-accounts')
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: BankAccountDto) {
    return this.bankAccountsService.create(user.sub, dto);
  }

  // null when none has been added yet.
  @Get('bank-accounts/me')
  getMine(@CurrentUser() user: AccessTokenPayload) {
    return this.bankAccountsService.getMine(user.sub);
  }

  @Patch('bank-accounts/me')
  update(@CurrentUser() user: AccessTokenPayload, @Body() dto: BankAccountDto) {
    return this.bankAccountsService.update(user.sub, dto);
  }

  @Delete('bank-accounts/me')
  async remove(@CurrentUser() user: AccessTokenPayload) {
    await this.bankAccountsService.remove(user.sub);
    return { deleted: true };
  }
}
