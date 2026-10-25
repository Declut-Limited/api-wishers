import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminAuthService } from './admin-auth.service';
import { AdminChangePasswordDto } from './dto/admin-change-password.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminRefreshDto } from './dto/admin-refresh.dto';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import type { AdminRequest } from './guards/admin-jwt-auth.guard';

// Same brute-force limit as user login.
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto);
  }

  @Throttle(AUTH_THROTTLE)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: AdminRefreshDto) {
    return this.adminAuthService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: AdminRefreshDto) {
    await this.adminAuthService.logout(dto);
    return { loggedOut: true };
  }

  @UseGuards(AdminJwtAuthGuard)
  @Get('me')
  me(@Req() req: AdminRequest) {
    return this.adminAuthService.me(req.admin.sub);
  }

  @Throttle(AUTH_THROTTLE)
  @UseGuards(AdminJwtAuthGuard)
  @Patch('change-password')
  changePassword(
    @Req() req: AdminRequest,
    @Body() dto: AdminChangePasswordDto,
  ) {
    return this.adminAuthService.changePassword(req.admin.sub, dto);
  }
}
