import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AdminDocument = HydratedDocument<Admin>;

@Schema({ _id: false })
class AdminRefreshToken {
  @Prop({ required: true })
  hashedToken: string;

  @Prop({ required: true })
  expiresAt: Date;
}

// Admins never live on User: their own collection and their own JWT secrets, so a user
// token can never pass as an admin's. No roles yet (house rule: ask before adding RBAC).
@Schema({ timestamps: true, collection: 'admins' })
export class Admin {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // bcrypt hash; never returned in any response.
  @Prop({ required: true, select: false })
  password: string;

  @Prop({ default: true })
  active: boolean;

  @Prop()
  lastLoginAt?: Date;

  @Prop({ type: AdminRefreshToken, select: false })
  refreshToken?: AdminRefreshToken;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);
