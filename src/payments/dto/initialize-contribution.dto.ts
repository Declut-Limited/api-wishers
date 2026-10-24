import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class InitializeContributionDto {
  @IsString()
  @MaxLength(100)
  wishItemSlug: string;

  @IsEmail()
  email: string;

  // Whole naira; the settings minimum is checked in the service.
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  amount: number;

  // Where Paystack sends the giver back after paying; only our pay site is accepted.
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  callbackUrl?: string;
}
