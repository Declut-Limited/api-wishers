import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type WalletDocument = HydratedDocument<Wallet>;

// One per user, a read-only record of what they've earned (naira). Money never sits here —
// Paystack settles each share straight to the user's bank; pending turns settled when it lands.
@Schema({ timestamps: true })
export class Wallet {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  })
  owner: Types.ObjectId;

  // Everything ever earned (gifts + referrals).
  @Prop({ default: 0 })
  allTimeBalance: number;

  // Paid, not yet in the user's bank.
  @Prop({ default: 0 })
  pendingBalance: number;

  // Already settled to the user's bank.
  @Prop({ default: 0 })
  settledBalance: number;

  @Prop({ default: 0 })
  contributedEarning: number;

  @Prop({ default: 0 })
  referralEarnings: number;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);
