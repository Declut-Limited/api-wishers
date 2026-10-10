import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:\+234[789]\d{9}|0[789]\d{9})$/, {
    message:
      'phone must be a valid Nigerian phone number, e.g. 08012345678 or +2348012345678',
  })
  phone?: string;

  // Cloudinary URL — the app uploads directly using GET /media/upload-signature.
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  image?: string;
}
