import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AccountStatus } from '../../users/schemas/user.schema';
import {
  TransactionStatus,
  TransactionType,
} from '../../transactions/schemas/transaction.schema';

// ?q= searches by name/email (users) or title (wishlists).
export class AdminListUsersDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;
}

export class AdminListWishlistsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(['active', 'completed'])
  status?: 'active' | 'completed';
}

export class AdminListTransactionsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;
}
