import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type WishlistDocument = HydratedDocument<Wishlist>;

@Schema({ _id: false })
class BoostingCreator {
  @Prop({ required: true })
  name: string;

  @Prop()
  image?: string;
}

// Totals, completion and boost fields are server-set only.
@Schema({ timestamps: true })
export class Wishlist {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  owner: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  description?: string;

  @Prop()
  image?: string;

  @Prop({ required: true, unique: true })
  slug: string;

  // Public contribution page, e.g. https://pay.wishers.app/w/{slug}.
  @Prop({ required: true })
  link: string;

  @Prop({ default: true })
  active: boolean;

  @Prop({ default: 0 })
  totalWishItems: number;

  @Prop({ default: 0 })
  totalGoalAmount: number;

  @Prop({ default: 0 })
  totalAmountReceived: number;

  @Prop({ default: 0 })
  totalContributors: number;

  @Prop({ default: false })
  isCompleted: boolean;

  @Prop({ type: [String], default: [] })
  contributorsImages: string[];

  @Prop({ default: 0 })
  visitCount: number;

  @Prop({ default: 0 })
  impressionCount: number;

  @Prop({ index: true })
  currentBoostExpiresAt?: Date;

  @Prop()
  lastBoostedAt?: Date;

  @Prop()
  lastBoostingPlanName?: string;

  @Prop({ default: 0 })
  previousBoostingCount: number;

  @Prop({ type: BoostingCreator })
  boostingCreator?: BoostingCreator;
}

export const WishlistSchema = SchemaFactory.createForClass(Wishlist);
WishlistSchema.index({ owner: 1, createdAt: -1 });
