import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type BankAccountDocument = HydratedDocument<BankAccount>;

// One per user — where withdrawals are paid out.
@Schema({ timestamps: true })
export class BankAccount {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  })
  owner: Types.ObjectId;

  @Prop({ required: true })
  bankCode: string;

  @Prop({ required: true })
  bankName: string;

  @Prop({ required: true })
  accountNumber: string;

  // "•••• " + last 4 digits, computed server-side.
  @Prop({ required: true })
  maskedAccountNumber: string;

  // As entered by the user (no account-name lookup).
  @Prop({ required: true })
  accountName: string;

  @Prop()
  logoUrl?: string;

  @Prop({ default: 'NGN' })
  currency: string;
}

export const BankAccountSchema = SchemaFactory.createForClass(BankAccount);
