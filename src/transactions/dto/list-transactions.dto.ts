import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { TransactionType } from '../schemas/transaction.schema';

export class ListTransactionsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;
}
