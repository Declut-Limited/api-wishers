import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/interfaces/jwt-payload.interface';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { TransactionsService } from './transactions.service';
import { ListTransactionsDto } from './dto/list-transactions.dto';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  listMine(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListTransactionsDto,
  ) {
    return this.transactionsService.listMine(user.sub, query);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.transactionsService.getMine(user.sub, id);
  }
}
