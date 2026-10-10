import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type WalletDocument = HydratedDocument<Wallet>;

// One per user. Balances (naira) are changed only by the server — contributions credit, withdrawals debit.
@Schema({ timestamps: true })
export class Wallet {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  })
  owner: Types.ObjectId;

  // Everything ever received.
  @Prop({ default: 0 })
  allTimeBalance: number;

  // Available to withdraw.
  @Prop({ default: 0 })
  remainingBalance: number;

  @Prop({ default: 0 })
  contributedEarning: number;

  @Prop({ default: 0 })
  referralEarnings: number;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);
