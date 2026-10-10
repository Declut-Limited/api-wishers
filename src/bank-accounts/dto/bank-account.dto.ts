import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class BankAccountDto {
  @IsString()
  @Matches(/^\d{3,6}$/, { message: 'bankCode must be a 3-6 digit bank code' })
  bankCode: string;

  // Nigerian NUBAN.
  @IsString()
  @Matches(/^\d{10}$/, { message: 'accountNumber must be a 10-digit NUBAN' })
  accountNumber: string;

  // Entered by the user — there's no account-name lookup.
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  accountName: string;
}
