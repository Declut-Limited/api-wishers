import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DEACTIVATED = 'deactivated',
}

// Admins live in their own Admin collection, never on User.
export enum UserRole {
  USER = 'user',
}

@Schema({ _id: false })
class RefreshTokenInfo {
  @Prop({ required: true })
  hashedToken: string;

  @Prop({ required: true })
  expiresAt: Date;
}

// Ref fields must use MongooseSchema.Types.ObjectId — mongoose's Types.ObjectId silently compiles as Mixed.
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ unique: true, sparse: true, trim: true })
  phone?: string;

  // bcrypt hash; never returned in any response.
  @Prop({ select: false })
  password?: string;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({
    type: String,
    enum: Object.values(AccountStatus),
    default: AccountStatus.ACTIVE,
  })
  accountStatus: AccountStatus;

  // Never settable through signup or profile updates.
  @Prop({ type: String, enum: Object.values(UserRole), default: UserRole.USER })
  role: UserRole;

  @Prop()
  image?: string;

  @Prop({ required: true, unique: true, uppercase: true })
  inviteCode: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  referredBy?: Types.ObjectId;

  @Prop({ default: 0 })
  referralsCount: number;

  // Expo push token — one per user, overwritten on each login.
  @Prop()
  pushToken?: string;

  // Set when the user deletes their own account.
  @Prop()
  deletedAt?: Date;

  @Prop({ type: RefreshTokenInfo, select: false })
  refreshToken?: RefreshTokenInfo;
}

export const UserSchema = SchemaFactory.createForClass(User);
