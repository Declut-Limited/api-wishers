import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AppSettings,
  AppSettingsDocument,
} from './schemas/app-settings.schema';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(AppSettings.name)
    private readonly settingsModel: Model<AppSettings>,
  ) {}

  // Creates the singleton with schema defaults on first read; upsert keeps concurrent first reads to one document.
  async get(): Promise<AppSettingsDocument> {
    return this.settingsModel
      .findOneAndUpdate(
        { key: 'app' },
        { $setOnInsert: { key: 'app' } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async getPublic() {
    const settings = await this.get();
    const {
      wishlistCreationLimit,
      wishItemCreationLimit,
      maxWishItemImages,
      minGoalAmount,
      maxGoalAmount,
      maxGoalAmountDigits,
      minWithdrawalAmount,
      maxWithdrawalAmountDigits,
      appWithdrawalPercentage,
      shouldDisplayConfetti,
      boostPlans,
    } = settings.toObject();
    return {
      wishlistCreationLimit,
      wishItemCreationLimit,
      maxWishItemImages,
      minGoalAmount,
      maxGoalAmount,
      maxGoalAmountDigits,
      minWithdrawalAmount,
      maxWithdrawalAmountDigits,
      appWithdrawalPercentage,
      shouldDisplayConfetti,
      boostPlans,
    };
  }
}
