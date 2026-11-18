import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

// One row per (wishlist, pay page visitor, Lagos day) — makes visitCount count each visitor
// once a day. Rows are only needed for the day they guard, so they expire after two days.
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class WishlistView {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Wishlist',
    required: true,
  })
  wishlist: Types.ObjectId;

  // Random ID the pay page keeps in the visitor's browser.
  @Prop({ required: true })
  visitor: string;

  // YYYY-MM-DD in Lagos time.
  @Prop({ required: true })
  day: string;

  createdAt?: Date;
}

export const WishlistViewSchema = SchemaFactory.createForClass(WishlistView);
WishlistViewSchema.index({ wishlist: 1, visitor: 1, day: 1 }, { unique: true });
WishlistViewSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 24 * 60 * 60 });
