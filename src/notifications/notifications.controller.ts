import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/interfaces/jwt-payload.interface';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { NotificationsService } from './notifications.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { RegisterTokenDto } from './dto/register-token.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listMine(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListNotificationsDto,
  ) {
    return this.notificationsService.listMine(user.sub, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AccessTokenPayload) {
    return this.notificationsService.unreadCount(user.sub);
  }

  @HttpCode(HttpStatus.OK)
  @Post('read-all')
  markAllRead(@CurrentUser() user: AccessTokenPayload) {
    return this.notificationsService.markAllRead(user.sub);
  }

  // For a token that changes mid-session or push permission granted after login.
  @HttpCode(HttpStatus.OK)
  @Post('register-token')
  async registerToken(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: RegisterTokenDto,
  ) {
    await this.notificationsService.registerToken(user.sub, dto.token);
    return { registered: true };
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.notificationsService.markRead(user.sub, id);
  }
}
