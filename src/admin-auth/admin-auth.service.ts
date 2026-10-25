import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import type { StringValue } from 'ms';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditEntityType } from '../audit-log/schemas/audit-log.schema';
import {
  hashRefreshToken,
  refreshTokenMatches,
} from '../auth/refresh-token-hash.util';
import { AdminChangePasswordDto } from './dto/admin-change-password.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminRefreshDto } from './dto/admin-refresh.dto';
import { Admin, AdminDocument } from './schemas/admin.schema';

export interface AdminTokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectModel(Admin.name) private readonly adminModel: Model<Admin>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  async login(dto: AdminLoginDto): Promise<AdminTokenPair> {
    const admin = await this.adminModel
      .findOne({ email: dto.email.toLowerCase().trim() })
      .select('+password')
      .exec();
    if (!admin || !(await bcrypt.compare(dto.password, admin.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!admin.active) {
      throw new UnauthorizedException('Admin account not active');
    }

    admin.lastLoginAt = new Date();
    await admin.save();
    await this.auditLog.record({
      entityType: AuditEntityType.ADMIN,
      entityId: admin._id.toString(),
      event: 'admin.logged_in',
      actor: admin._id.toString(),
    });
    return this.issueTokens(admin);
  }

  async refresh(dto: AdminRefreshDto): Promise<AdminTokenPair> {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const admin = await this.adminModel
      .findById(payload.sub)
      .select('+refreshToken')
      .exec();
    if (
      !admin?.active ||
      !admin.refreshToken ||
      admin.refreshToken.expiresAt < new Date() ||
      !refreshTokenMatches(dto.refreshToken, admin.refreshToken.hashedToken)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.issueTokens(admin);
  }

  async logout(dto: AdminRefreshDto): Promise<void> {
    try {
      const payload = await this.verifyRefreshToken(dto.refreshToken);
      await this.adminModel
        .updateOne({ _id: payload.sub }, { $unset: { refreshToken: 1 } })
        .exec();
    } catch {
      // already invalid: nothing to clear
    }
  }

  async me(adminId: string) {
    const admin = await this.adminModel.findById(adminId).exec();
    if (!admin) throw new UnauthorizedException('Admin account not found');
    return {
      _id: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      lastLoginAt: admin.lastLoginAt,
    };
  }

  // New tokens come back so this session stays signed in; rotating the refresh token signs out any other.
  async changePassword(
    adminId: string,
    dto: AdminChangePasswordDto,
  ): Promise<AdminTokenPair> {
    const admin = await this.adminModel
      .findById(adminId)
      .select('+password')
      .exec();
    if (
      !admin ||
      !(await bcrypt.compare(dto.currentPassword, admin.password))
    ) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'Choose a password different from your current one',
      );
    }

    const rounds = Number(this.config.get('BCRYPT_SALT_ROUNDS') ?? 12);
    admin.password = await bcrypt.hash(dto.newPassword, rounds);
    await admin.save();
    await this.auditLog.record({
      entityType: AuditEntityType.ADMIN,
      entityId: adminId,
      event: 'admin.password_changed',
      actor: adminId,
    });
    return this.issueTokens(admin);
  }

  private secrets() {
    const access = this.config.get<string>('JWT_ADMIN_ACCESS_SECRET');
    const refresh = this.config.get<string>('JWT_ADMIN_REFRESH_SECRET');
    if (!access || !refresh) {
      throw new ServiceUnavailableException('Admin access is not configured');
    }
    return { access, refresh };
  }

  private async issueTokens(admin: AdminDocument): Promise<AdminTokenPair> {
    const { access, refresh } = this.secrets();
    const adminId = admin._id.toString();

    const accessToken = await this.jwtService.signAsync(
      { sub: adminId, kind: 'admin' },
      {
        secret: access,
        expiresIn: this.config.get<string>(
          'JWT_ADMIN_ACCESS_EXPIRY',
        ) as StringValue,
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      { sub: adminId, kind: 'admin', jti: randomUUID() },
      {
        secret: refresh,
        expiresIn: this.config.get<string>(
          'JWT_ADMIN_REFRESH_EXPIRY',
        ) as StringValue,
      },
    );

    const decoded = this.jwtService.decode<{ exp: number }>(refreshToken);
    await this.adminModel
      .updateOne(
        { _id: adminId },
        {
          refreshToken: {
            hashedToken: hashRefreshToken(refreshToken),
            expiresAt: new Date(decoded.exp * 1000),
          },
        },
      )
      .exec();

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(token: string): Promise<{ sub: string }> {
    const { refresh } = this.secrets();
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        kind: string;
      }>(token, { secret: refresh });
      if (payload.kind !== 'admin') throw new Error('not an admin token');
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
