import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type BankAccountDocument = HydratedDocument<BankAccount>;

// One per user — the wisher's Paystack subaccount, where their share of each gift settles.
// Removing bank details only deactivates it, so re-adding reuses the same subaccount.
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

  // As the bank holds it, from Paystack's account lookup.
  @Prop({ required: true })
  accountName: string;

  @Prop()
  logoUrl?: string;

  @Prop({ default: 'NGN' })
  currency: string;

  // Paystack subaccount (ACCT_…); created once, then updated on every change.
  @Prop({ unique: true, sparse: true })
  subaccountCode?: string;

  // false once the user removes their bank details (the subaccount is deactivated too).
  @Prop({ default: true })
  active: boolean;
}

export const BankAccountSchema = SchemaFactory.createForClass(BankAccount);
