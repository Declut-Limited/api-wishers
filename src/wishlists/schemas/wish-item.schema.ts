import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type WishItemDocument = HydratedDocument<WishItem>;

// amountReceived, contributorCount, isCompleted and contributorsImages are server-set only.
@Schema({ timestamps: true, collection: 'wishitems' })
export class WishItem {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Wishlist',
    required: true,
    index: true,
  })
  wishlist: Types.ObjectId;

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

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  goalAmount: number;

  @Prop({ default: 0 })
  amountReceived: number;

  @Prop({ default: 0 })
  contributorCount: number;

  @Prop({ default: false })
  isCompleted: boolean;

  @Prop({ default: true })
  active: boolean;

  @Prop({ type: [String], default: [] })
  contributorsImages: string[];
}

export const WishItemSchema = SchemaFactory.createForClass(WishItem);
