import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

// One row per (wishlist, signed-in visitor) — makes visitCount count unique visitors.
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class WishlistVisit {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Wishlist',
    required: true,
  })
  wishlist: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  visitor: Types.ObjectId;
}

export const WishlistVisitSchema = SchemaFactory.createForClass(WishlistVisit);
WishlistVisitSchema.index({ wishlist: 1, visitor: 1 }, { unique: true });
