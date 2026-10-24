import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class BankAccountDto {
  @IsString()
  @Matches(/^\d{3,6}$/, { message: 'bankCode must be a 3-6 digit bank code' })
  bankCode: string;

  // Nigerian NUBAN.
  @IsString()
  @Matches(/^\d{10}$/, { message: 'accountNumber must be a 10-digit NUBAN' })
  accountNumber: string;

  // Ignored — the name comes from Paystack's account lookup. Still accepted so older app builds keep working.
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  accountName?: string;
}

export class ResolveBankAccountDto {
  @IsString()
  @Matches(/^\d{3,6}$/, { message: 'bankCode must be a 3-6 digit bank code' })
  bankCode: string;

  @IsString()
  @Matches(/^\d{10}$/, { message: 'accountNumber must be a 10-digit NUBAN' })
  accountNumber: string;
}
