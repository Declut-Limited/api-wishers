import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ContributorDocument = HydratedDocument<Contributor>;

// One gift towards a wish. Written only by the server once the payment is verified.
@Schema({ timestamps: true })
export class Contributor {
  // The wishlist owner receiving the gift.
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  owner: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'WishItem',
    required: true,
    index: true,
  })
  wishItem: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Wishlist',
    required: true,
  })
  wishlist: Types.ObjectId;

  @Prop()
  wishItemSlug?: string;

  // Absent when the giver stays anonymous.
  @Prop({ trim: true })
  name?: string;

  @Prop({ lowercase: true, trim: true })
  email?: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ trim: true })
  message?: string;

  @Prop()
  image?: string;

  @Prop({ default: false })
  isAnonymous: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Transaction' })
  transaction?: Types.ObjectId;

  @Prop()
  reference?: string;

  // Set when the giver adds their name/photo/message after paying — that step is allowed once.
  @Prop()
  detailsAddedAt?: Date;
}

export const ContributorSchema = SchemaFactory.createForClass(Contributor);
ContributorSchema.index({ owner: 1, createdAt: -1 });
// The payment reference is how the public details step finds the gift; one gift per reference.
ContributorSchema.index({ reference: 1 }, { unique: true, sparse: true });
