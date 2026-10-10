import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateWishlistDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  // Cloudinary URL from GET /media/upload-signature?folder=wishlists.
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  image?: string;
}
