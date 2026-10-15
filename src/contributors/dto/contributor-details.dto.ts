import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';

// What a giver may add to their gift after paying (pay-wishers' "Payment Successful" step).
export class ContributorDetailsDto {
  @IsBoolean()
  isAnonymous: boolean;

  // Required unless anonymous; anonymous gifts keep no name, photo or message.
  @ValidateIf((d: ContributorDetailsDto) => !d.isAnonymous)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  // A Cloudinary URL from the upload signature for this gift (checked in the service).
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  image?: string;
}
