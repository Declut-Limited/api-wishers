import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateWishItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  // Cloudinary URLs; the count is checked again against settings.maxWishItemImages.
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  images: string[];

  // Naira, within settings min/max.
  @IsInt()
  @Min(1)
  goalAmount: number;
}
