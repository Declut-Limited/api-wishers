import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/interfaces/jwt-payload.interface';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AccessTokenPayload) {
    return this.usersService.getProfile(user.sub);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  // Password re-check guards against a stolen session closing the account.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('me/delete')
  async deleteMe(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: DeleteAccountDto,
  ) {
    await this.usersService.deleteOwnAccount(user.sub, dto.password);
    return { deleted: true };
  }
}
