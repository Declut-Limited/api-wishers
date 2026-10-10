import { Controller, Get } from '@nestjs/common';
import { SettingsService } from './settings.service';

// Public: the app and the contribution pages both read limits and fees before sign-in.
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings() {
    return this.settingsService.getPublic();
  }
}
