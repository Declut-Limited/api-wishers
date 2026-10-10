import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const MEDIA_FOLDERS = ['users', 'wishlists', 'wishitems'] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

export class UploadSignatureDto {
  @IsIn(MEDIA_FOLDERS)
  folder: MediaFolder;

  // One signature per image; capped again by settings.maxWishItemImages in the controller.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  count?: number = 1;
}
