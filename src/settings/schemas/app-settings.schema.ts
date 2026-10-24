import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AppSettingsDocument = HydratedDocument<AppSettings>;

@Schema({ _id: false })
export class BoostPlan {
  @Prop({ required: true })
  id: number;

  @Prop({ required: true })
  name: string;

  // Naira.
  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  durationInHours: number;
}

const BoostPlanSchema = SchemaFactory.createForClass(BoostPlan);

// Singleton (key: 'app') replacing Firestore's app_actions document. Defaults are the live Firestore values on 2026-10-10.
@Schema({ timestamps: true, collection: 'app_settings' })
export class AppSettings {
  @Prop({ required: true, unique: true, default: 'app' })
  key: string;

  @Prop({ default: 10 })
  wishlistCreationLimit: number;

  @Prop({ default: 25 })
  wishItemCreationLimit: number;

  @Prop({ default: 3 })
  maxWishItemImages: number;

  @Prop({ default: 100 })
  minGoalAmount: number;

  @Prop({ default: 99_999_999 })
  maxGoalAmount: number;

  @Prop({ default: 10 })
  maxGoalAmountDigits: number;

  // Naira; smallest gift a giver can send.
  @Prop({ default: 100 })
  minContributionAmount: number;

  // Each gift is split at payment: the wisher's share, the referrer's share (only when the
  // referrer has bank details), and Wishers keeps the rest.
  @Prop({ default: 92.5 })
  wisherSharePercentage: number;

  @Prop({ default: 1 })
  referrerSharePercentage: number;

  @Prop({ default: true })
  shouldDisplayConfetti: boolean;

  @Prop({
    type: [BoostPlanSchema],
    default: () => [
      { id: 1, name: '24 hours', price: 500, durationInHours: 24 },
      { id: 2, name: '48 hours', price: 1000, durationInHours: 48 },
      { id: 3, name: '1 Week', price: 2500, durationInHours: 168 },
      { id: 4, name: '1 Month', price: 7500, durationInHours: 720 },
    ],
  })
  boostPlans: BoostPlan[];
}

export const AppSettingsSchema = SchemaFactory.createForClass(AppSettings);
