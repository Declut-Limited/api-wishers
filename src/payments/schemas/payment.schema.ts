import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

export enum PaymentPurpose {
  CONTRIBUTION = 'contribution',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  // Paystack said success but the amount or currency didn't match — never credited.
  FLAGGED = 'flagged',
}

// One Paystack checkout, created at initialize with the split fixed up front. Amounts in whole naira.
@Schema({ timestamps: true })
export class Payment {
  @Prop({ required: true, unique: true })
  reference: string;

  @Prop({ type: String, enum: Object.values(PaymentPurpose), required: true })
  purpose: PaymentPurpose;

  @Prop({
    type: String,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.PENDING,
    index: true,
  })
  status: PaymentStatus;

  // The giver's email.
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  giftAmount: number;

  @Prop({ required: true })
  charges: number;

  // What the giver pays: gift + charges.
  @Prop({ required: true })
  totalAmount: number;

  // The wisher receiving the gift.
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

  @Prop({ required: true })
  wisherShare: number;

  @Prop({ required: true })
  wisherSubaccount: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  referrer?: Types.ObjectId;

  @Prop({ default: 0 })
  referrerShare: number;

  @Prop()
  referrerSubaccount?: string;

  @Prop({ required: true })
  appShare: number;

  @Prop()
  paidAt?: Date;

  @Prop()
  failureReason?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
