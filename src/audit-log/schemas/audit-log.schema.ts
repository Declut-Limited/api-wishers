import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

export enum AuditEntityType {
  USER = 'user',
  WISHLIST = 'wishlist',
  WISH_ITEM = 'wish_item',
  BANK_ACCOUNT = 'bank_account',
  PAYMENT = 'payment',
}

// Append-only activity log for the future admin side. entityId has no ref — it points at whichever collection entityType names.
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'audit_logs',
})
export class AuditLog {
  @Prop({ required: true, index: true })
  entityType: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  entityId: Types.ObjectId;

  @Prop({ required: true, index: true })
  event: string;

  // A user id, or 'system' for server-triggered events.
  @Prop({ required: true, index: true })
  actor: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1 });
