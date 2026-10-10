import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { SettingsModule } from '../settings/settings.module';
import { MediaController } from './media.controller';

@Module({
  imports: [CloudinaryModule, SettingsModule],
  controllers: [MediaController],
})
export class MediaModule {}
