import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  AccountStatus,
  User,
  UserDocument,
  UserRole,
} from './schemas/user.schema';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditEntityType } from '../audit-log/schemas/audit-log.schema';

// No 0/O/1/I so codes are easy to read out and type.
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 6;

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  image?: string;
  emailVerified: boolean;
  accountStatus: AccountStatus;
  role: UserRole;
  inviteCode: string;
  referredBy?: string;
  referralsCount: number;
  createdAt?: Date;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly auditLog: AuditLogService,
  ) {}

  async createEmailUser(data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    referredBy?: string;
  }): Promise<UserDocument> {
    return this.userModel.create({
      ...data,
      inviteCode: await this.generateUniqueInviteCode(),
    });
  }

  findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  findByPhone(phone: string) {
    return this.userModel.findOne({ phone }).exec();
  }

  findByInviteCode(code: string) {
    return this.userModel.findOne({ inviteCode: code.toUpperCase() }).exec();
  }

  // Login identifier is an email or a phone number.
  findByIdentifierWithPassword(identifier: string) {
    const query = identifier.includes('@')
      ? { email: identifier.toLowerCase() }
      : { phone: identifier };
    return this.userModel.findOne(query).select('+password').exec();
  }

  findByEmailWithPassword(email: string) {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+password')
      .exec();
  }

  findByIdWithPassword(id: string) {
    return this.userModel.findById(id).select('+password').exec();
  }

  findByIdWithRefreshToken(id: string) {
    return this.userModel.findById(id).select('+refreshToken').exec();
  }

  async incrementReferralsCount(id: string): Promise<void> {
    await this.userModel
      .updateOne({ _id: id }, { $inc: { referralsCount: 1 } })
      .exec();
  }

  async setPushToken(id: string, pushToken: string): Promise<void> {
    await this.userModel.updateOne({ _id: id }, { pushToken }).exec();
  }

  async setRefreshToken(
    id: string,
    refreshToken: { hashedToken: string; expiresAt: Date },
  ): Promise<void> {
    await this.userModel.updateOne({ _id: id }, { refreshToken }).exec();
  }

  async clearRefreshToken(id: string): Promise<void> {
    await this.userModel
      .updateOne({ _id: id }, { $unset: { refreshToken: 1 } })
      .exec();
  }

  async setPassword(id: string, password: string): Promise<void> {
    await this.userModel.updateOne({ _id: id }, { password }).exec();
  }

  async setEmailVerified(id: string): Promise<void> {
    await this.userModel.updateOne({ _id: id }, { emailVerified: true }).exec();
  }

  async getProfile(id: string): Promise<UserProfile> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toProfile(user);
  }

  async updateProfile(id: string, dto: UpdateUserDto): Promise<UserProfile> {
    if (dto.phone) {
      const owner = await this.findByPhone(dto.phone);
      if (owner && owner._id.toString() !== id) {
        throw new ConflictException('Phone number already registered');
      }
    }
    const user = await this.userModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.auditLog.record({
      entityType: AuditEntityType.USER,
      entityId: id,
      event: 'user.profile_updated',
      actor: id,
      metadata: { fields: Object.keys(dto) },
    });
    return this.toProfile(user);
  }

  // Signs the user out everywhere and closes the account. Wallet/wishlist clean-up joins this once those modules exist.
  async deleteOwnAccount(id: string, password: string): Promise<void> {
    const user = await this.findByIdWithPassword(id);
    if (!user?.password || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Password is incorrect');
    }
    await this.userModel
      .updateOne(
        { _id: id },
        {
          accountStatus: AccountStatus.DEACTIVATED,
          deletedAt: new Date(),
          $unset: { refreshToken: 1, pushToken: 1 },
        },
      )
      .exec();
    await this.auditLog.record({
      entityType: AuditEntityType.USER,
      entityId: id,
      event: 'user.account_deleted',
      actor: id,
    });
  }

  toProfile(user: UserDocument): UserProfile {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.image,
      emailVerified: user.emailVerified,
      accountStatus: user.accountStatus,
      role: user.role,
      inviteCode: user.inviteCode,
      referredBy: user.referredBy?.toString(),
      referralsCount: user.referralsCount,
      createdAt: (user as UserDocument & { createdAt?: Date }).createdAt,
    };
  }

  private async generateUniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = Array.from(
        { length: INVITE_CODE_LENGTH },
        () => INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)],
      ).join('');
      if (!(await this.userModel.exists({ inviteCode: code }))) {
        return code;
      }
    }
    throw new Error('Could not generate a unique invite code');
  }
}
