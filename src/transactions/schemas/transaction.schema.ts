import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type TransactionDocument = HydratedDocument<Transaction>;

export enum TransactionType {
  CONTRIBUTION = 'contribution',
  REFERRAL_EARNING = 'referral_earning',
}

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export enum SettlementStatus {
  PENDING = 'pending',
  SETTLED = 'settled',
}

@Schema({ _id: false })
class Receiver {
  @Prop()
  bankName?: string;

  @Prop()
  accountNumber?: string;

  @Prop()
  accountName?: string;
}

// The user's earnings ledger. Written only by the server once a payment is verified; wallet
// balances can always be rebuilt from it.
@Schema({ timestamps: true })
export class Transaction {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  owner: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(TransactionType), required: true })
  type: TransactionType;

  @Prop({
    type: String,
    enum: Object.values(TransactionStatus),
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  // Naira this user earns (their share of the gift).
  @Prop({ required: true })
  amount: number;

  // Naira the giver gave towards the wish, before the split.
  @Prop()
  giftAmount?: number;

  // Paystack's fee, paid by the giver on top.
  @Prop({ default: 0 })
  charges: number;

  @Prop({ default: 'NGN' })
  currency: string;

  // Unique so a retried webhook can't record twice: the Paystack reference for the wisher's row,
  // "{reference}:referral" for the referrer's.
  @Prop({ unique: true, sparse: true })
  reference?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Payment' })
  payment?: Types.ObjectId;

  // The Paystack subaccount this share settles to.
  @Prop()
  subaccountCode?: string;

  @Prop({
    type: String,
    enum: Object.values(SettlementStatus),
    default: SettlementStatus.PENDING,
    index: true,
  })
  settlementStatus: SettlementStatus;

  @Prop()
  settledAt?: Date;

  @Prop()
  paidAt?: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'WishItem' })
  wishItem?: Types.ObjectId;

  @Prop()
  wishItemSlug?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Wishlist' })
  wishlist?: Types.ObjectId;

  @Prop({ type: Receiver })
  receiver?: Receiver;

  @Prop({ trim: true })
  description?: string;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
TransactionSchema.index({ owner: 1, createdAt: -1 });
