import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import { UsersService } from '../users/users.service';
import { AccountStatus, UserDocument } from '../users/schemas/user.schema';
import { PasswordResetTokenService } from './password-reset-token.service';
import {
  hashRefreshToken,
  refreshTokenMatches,
} from './refresh-token-hash.util';
import { EmailService } from '../email/email.service';
import { WalletsService } from '../wallets/wallets.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditEntityType } from '../audit-log/schemas/audit-log.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { RefreshTokenPayload } from './interfaces/jwt-payload.interface';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  emailVerified: boolean;
}

export interface RegisterResult extends TokenPair {
  otpToken: string;
  message: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Never-real id so an unknown email gets the same response shape as a real one (no enumeration).
  private static readonly INERT_SUBJECT = '000000000000000000000000';

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly passwordResetTokens: PasswordResetTokenService,
    private readonly emailService: EmailService,
    private readonly auditLog: AuditLogService,
    private readonly walletsService: WalletsService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResult> {
    if (await this.usersService.findByEmail(dto.email)) {
      throw new ConflictException('Email already registered');
    }
    if (dto.phone && (await this.usersService.findByPhone(dto.phone))) {
      throw new ConflictException('Phone number already registered');
    }

    const referrer = dto.referralCode
      ? await this.usersService.findByInviteCode(dto.referralCode)
      : null;

    const user = await this.usersService.createEmailUser({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      password: await bcrypt.hash(dto.password, this.saltRounds()),
      referredBy: referrer?._id.toString(),
    });

    await this.walletsService.ensureWallet(user._id.toString());

    // Counted only after the account really exists, unlike the old client-side flow.
    if (referrer) {
      await this.usersService.incrementReferralsCount(referrer._id.toString());
    }

    await this.auditLog.record({
      entityType: AuditEntityType.USER,
      entityId: user._id.toString(),
      event: 'user.registered',
      actor: user._id.toString(),
      metadata: { referred: Boolean(referrer) },
    });

    const tokens = await this.issueTokens(user);
    const { otp, otpToken } = await this.issueEmailVerificationOtp(
      user._id.toString(),
    );

    // The account already exists — a failed send mustn't fail registration; resend-verification-email retries it.
    try {
      await this.emailService.sendOtpEmail(
        user.email,
        user.name,
        otp,
        this.otpExpiryMinutes(),
      );
    } catch (err) {
      this.logger.error(
        `Failed to send signup verification email to ${user.email}`,
        err as Error,
      );
    }

    return {
      ...tokens,
      otpToken,
      message:
        'Registration successful. Check your email for a verification code.',
    };
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.usersService.findByIdentifierWithPassword(
      dto.identifier,
    );
    if (
      !user?.password ||
      !(await bcrypt.compare(dto.password, user.password))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Checked after the password, so a wrong guess can't reveal an account's status.
    this.assertAccountIsUsable(user);

    await this.auditLog.record({
      entityType: AuditEntityType.USER,
      entityId: user._id.toString(),
      event: 'user.logged_in',
      actor: user._id.toString(),
    });

    return this.issueTokens(user);
  }

  async refresh(dto: RefreshTokenDto): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const user = await this.usersService.findByIdWithRefreshToken(payload.sub);
    if (
      !user?.refreshToken ||
      user.refreshToken.expiresAt < new Date() ||
      !refreshTokenMatches(dto.refreshToken, user.refreshToken.hashedToken)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    this.assertAccountIsUsable(user);
    return this.issueTokens(user);
  }

  async logout(dto: RefreshTokenDto): Promise<void> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.verifyRefreshToken(dto.refreshToken);
    } catch {
      return;
    }
    await this.usersService.clearRefreshToken(payload.sub);
    await this.auditLog.record({
      entityType: AuditEntityType.USER,
      entityId: payload.sub,
      event: 'user.logged_out',
      actor: payload.sub,
    });
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ otpToken: string; message: string }> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    const message =
      'If that email is registered, a verification code has been sent.';
    const otp = this.passwordResetTokens.generateOtp();
    const otpToken = await this.signPasswordOtp(
      user?.password ? user._id.toString() : AuthService.INERT_SUBJECT,
      otp,
    );

    if (user?.password) {
      this.logDevOtp('Password reset', user._id.toString(), otp);
      try {
        await this.emailService.sendOtpEmail(
          user.email,
          user.name,
          otp,
          this.otpExpiryMinutes(),
        );
      } catch (err) {
        this.logger.error(
          `Failed to send password reset email to ${user.email}`,
          err as Error,
        );
      }
    }

    // The code itself is never returned — only emailed (and logged in development).
    return { otpToken, message };
  }

  async resendOtp(
    dto: ResendOtpDto,
  ): Promise<{ otpToken: string; message: string }> {
    const { sub } = await this.passwordResetTokens.decodeOtpToken(
      dto.otpToken,
      this.passwordResetSecret(),
    );
    const message =
      'If that email is registered, a new verification code has been sent.';
    const otp = this.passwordResetTokens.generateOtp();

    if (sub === AuthService.INERT_SUBJECT) {
      return { otpToken: await this.signPasswordOtp(sub, otp), message };
    }

    const user = await this.usersService.findById(sub);
    if (!user) {
      throw new BadRequestException('Invalid or expired token');
    }

    const otpToken = await this.signPasswordOtp(sub, otp);
    this.logDevOtp('Password reset', sub, otp);
    await this.emailService.sendOtpEmail(
      user.email,
      user.name,
      otp,
      this.otpExpiryMinutes(),
    );

    return { otpToken, message };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ resetToken: string }> {
    const { sub } = await this.passwordResetTokens.verifyOtp(
      dto.otpToken,
      dto.otp,
      this.passwordResetSecret(),
    );

    const user = await this.usersService.findByIdWithPassword(sub);
    if (!user?.password) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const resetToken = await this.passwordResetTokens.signResetToken({
      sub,
      passwordHash: user.password,
      secret: this.passwordResetSecret(),
      expiresIn: this.resetTokenExpiry(),
    });

    return { resetToken };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const unverified = this.jwtService.decode<{ sub?: string } | null>(
      dto.resetToken,
    );
    const user = unverified?.sub
      ? await this.usersService.findByIdWithPassword(unverified.sub)
      : null;

    await this.passwordResetTokens.verifyResetToken(
      dto.resetToken,
      user?.password,
      this.passwordResetSecret(),
    );

    const userId = user!._id.toString();
    await this.usersService.setPassword(
      userId,
      await bcrypt.hash(dto.newPassword, this.saltRounds()),
    );
    await this.usersService.clearRefreshToken(userId);
    await this.auditLog.record({
      entityType: AuditEntityType.USER,
      entityId: userId,
      event: 'user.password_reset',
      actor: userId,
    });

    return { message: 'Password reset successfully. Please log in again.' };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user?.password) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (!(await bcrypt.compare(dto.currentPassword, user.password))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.usersService.setPassword(
      userId,
      await bcrypt.hash(dto.newPassword, this.saltRounds()),
    );
    await this.usersService.clearRefreshToken(userId);
    await this.auditLog.record({
      entityType: AuditEntityType.USER,
      entityId: userId,
      event: 'user.password_changed',
      actor: userId,
    });

    return { message: 'Password changed successfully. Please log in again.' };
  }

  async verifyEmail(
    userId: string,
    dto: VerifyEmailDto,
  ): Promise<{ message: string }> {
    const { sub } = await this.passwordResetTokens.verifyOtp(
      dto.otpToken,
      dto.otp,
      this.passwordResetSecret(),
      'email_verify',
    );
    if (sub !== userId) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.usersService.setEmailVerified(userId);
    await this.auditLog.record({
      entityType: AuditEntityType.USER,
      entityId: userId,
      event: 'user.email_verified',
      actor: userId,
    });
    return { message: 'Email verified successfully.' };
  }

  async resendVerificationEmail(
    userId: string,
  ): Promise<{ otpToken?: string; message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (user.emailVerified) {
      return { message: 'Email is already verified.' };
    }

    const { otp, otpToken } = await this.issueEmailVerificationOtp(userId);
    await this.emailService.sendOtpEmail(
      user.email,
      user.name,
      otp,
      this.otpExpiryMinutes(),
    );

    return {
      otpToken,
      message: 'A new verification code has been sent to your email.',
    };
  }

  private async issueEmailVerificationOtp(
    userId: string,
  ): Promise<{ otp: string; otpToken: string }> {
    const otp = this.passwordResetTokens.generateOtp();
    const otpToken = await this.passwordResetTokens.signOtpToken({
      sub: userId,
      otp,
      secret: this.passwordResetSecret(),
      expiresIn: this.otpExpiry(),
      saltRounds: this.saltRounds(),
      purpose: 'email_verify',
    });
    this.logDevOtp('Email verification', userId, otp);
    return { otp, otpToken };
  }

  private signPasswordOtp(sub: string, otp: string): Promise<string> {
    return this.passwordResetTokens.signOtpToken({
      sub,
      otp,
      secret: this.passwordResetSecret(),
      expiresIn: this.otpExpiry(),
      saltRounds: this.saltRounds(),
    });
  }

  // Lets codes be tested before Mailtrap is configured; never logs in production.
  private logDevOtp(kind: string, userId: string, otp: string): void {
    if (this.config.get<string>('NODE_ENV') !== 'production') {
      this.logger.log(`[DEV ONLY] ${kind} code for user ${userId}: ${otp}`);
    }
  }

  private async issueTokens(user: UserDocument): Promise<TokenPair> {
    const userId = user._id.toString();

    const accessToken = await this.jwtService.signAsync(
      { sub: userId },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRY') as StringValue,
      },
    );

    // jti keeps two tokens issued in the same second distinct, so rotation always invalidates the old one.
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, jti: randomUUID() },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRY') as StringValue,
      },
    );

    const decoded = this.jwtService.decode<{ exp: number }>(refreshToken);
    await this.usersService.setRefreshToken(userId, {
      hashedToken: hashRefreshToken(refreshToken),
      expiresAt: new Date(decoded.exp * 1000),
    });

    return { accessToken, refreshToken, emailVerified: user.emailVerified };
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private assertAccountIsUsable(user: UserDocument): void {
    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw new ForbiddenException(
        'Your account has been suspended - Contact support to restore access',
      );
    }
    if (user.accountStatus === AccountStatus.DEACTIVATED) {
      throw new ForbiddenException(
        'Your account has been deactivated - Contact support to restore access',
      );
    }
  }

  private passwordResetSecret(): string {
    return this.config.get<string>('JWT_PASSWORD_RESET_SECRET') as string;
  }

  private otpExpiryMinutes(): number {
    return this.config.get<number>('OTP_EXPIRY_MINUTES', 10);
  }

  private otpExpiry(): string {
    return `${this.otpExpiryMinutes()}m`;
  }

  private resetTokenExpiry(): string {
    return `${this.config.get<number>('PASSWORD_RESET_TOKEN_EXPIRY_MINUTES', 15)}m`;
  }

  private saltRounds(): number {
    return this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
  }
}
