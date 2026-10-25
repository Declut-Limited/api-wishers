import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtAuthGuard } from '../admin-auth/guards/admin-jwt-auth.guard';
import type { AdminRequest } from '../admin-auth/guards/admin-jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AdminService } from './admin.service';
import {
  AdminListTransactionsDto,
  AdminListUsersDto,
  AdminListWishlistsDto,
} from './dto/admin-query.dto';
import {
  AdminUpdateSettingsDto,
  AdminUpdateUserStatusDto,
} from './dto/admin-update.dto';

// Everything here needs an admin token (admin secret, active admin).
@UseGuards(AdminJwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  stats() {
    return this.adminService.stats();
  }

  @Get('users')
  listUsers(@Query() dto: AdminListUsersDto) {
    return this.adminService.listUsers(dto);
  }

  @Get('users/:id')
  getUser(@Param('id', ParseObjectIdPipe) id: string) {
    return this.adminService.getUser(id);
  }

  @Patch('users/:id/status')
  setUserStatus(
    @Req() req: AdminRequest,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AdminUpdateUserStatusDto,
  ) {
    return this.adminService.setUserStatus(
      req.admin.sub,
      id,
      dto.accountStatus,
    );
  }

  @Get('wishlists')
  listWishlists(@Query() dto: AdminListWishlistsDto) {
    return this.adminService.listWishlists(dto);
  }

  @Get('wishlists/:id')
  getWishlist(@Param('id', ParseObjectIdPipe) id: string) {
    return this.adminService.getWishlist(id);
  }

  @Get('transactions')
  listTransactions(@Query() dto: AdminListTransactionsDto) {
    return this.adminService.listTransactions(dto);
  }

  @Get('settings')
  getSettings() {
    return this.adminService.getSettings();
  }

  @Patch('settings')
  updateSettings(
    @Req() req: AdminRequest,
    @Body() dto: AdminUpdateSettingsDto,
  ) {
    return this.adminService.updateSettings(req.admin.sub, dto);
  }
}
