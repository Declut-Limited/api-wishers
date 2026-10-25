import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

// Admins can suspend or restore; "deactivated" is only set by the user deleting their account.
export class AdminUpdateUserStatusDto {
  @IsIn(['active', 'suspended'])
  accountStatus: 'active' | 'suspended';
}

// The app limits and fees from GET /settings (boost plans stay as they are).
export class AdminUpdateSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  wishlistCreationLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  wishItemCreationLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  maxWishItemImages?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minGoalAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxGoalAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(15)
  maxGoalAmountDigits?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minContributionAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  wisherSharePercentage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  referrerSharePercentage?: number;

  @IsOptional()
  @IsBoolean()
  shouldDisplayConfetti?: boolean;
}
