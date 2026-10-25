import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Request } from 'express';
import { Model } from 'mongoose';
import { Admin } from '../schemas/admin.schema';

export interface AdminAccessPayload {
  sub: string;
  kind: 'admin';
}

export interface AdminRequest extends Request {
  admin: AdminAccessPayload;
}

// Admin routes only: verifies with the admin secret (a user token fails here), then
// re-checks the admin still exists and is active, so deactivating one locks them out at once.
@Injectable()
export class AdminJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectModel(Admin.name) private readonly adminModel: Model<Admin>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const secret = this.config.get<string>('JWT_ADMIN_ACCESS_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException('Admin access is not configured');
    }

    const request = context.switchToHttp().getRequest<AdminRequest>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: AdminAccessPayload;
    try {
      payload = await this.jwtService.verifyAsync<AdminAccessPayload>(token, {
        secret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (payload.kind !== 'admin') {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const admin = await this.adminModel
      .exists({ _id: payload.sub, active: true })
      .exec();
    if (!admin) throw new UnauthorizedException('Admin account not active');

    request.admin = payload;
    return true;
  }
}
