import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type TransactionDocument = HydratedDocument<Transaction>;

export enum TransactionType {
  CONTRIBUTION = 'contribution',
  WITHDRAWAL = 'withdrawal',
}

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
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

// The user's money ledger. Written only by the server (payment verification, withdrawals).
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

  // Naira credited to / debited from the wallet.
  @Prop({ required: true })
  amount: number;

  @Prop({ default: 0 })
  charges: number;

  @Prop({ default: 'NGN' })
  currency: string;

  // Payment gateway reference; unique so a retried webhook can't record twice.
  @Prop({ unique: true, sparse: true })
  reference?: string;

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
