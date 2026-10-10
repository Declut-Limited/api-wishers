import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SettingsService } from '../settings/settings.service';
import { UploadSignatureDto } from './dto/upload-signature.dto';

// The app uploads straight to Cloudinary with these short-lived signatures; we never handle image bytes.
@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get('upload-signature')
  async getUploadSignatures(@Query() dto: UploadSignatureDto) {
    const count = dto.count ?? 1;
    const { maxWishItemImages } = await this.settingsService.get();
    if (count > maxWishItemImages) {
      throw new BadRequestException(
        `count must not be greater than ${maxWishItemImages}`,
      );
    }
    return this.cloudinaryService.generateBulkUploadSignatures(
      count,
      dto.folder,
    );
  }
}
