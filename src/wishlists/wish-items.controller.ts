import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/interfaces/jwt-payload.interface';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { WishItemsService } from './wish-items.service';
import { UpdateWishItemDto } from './dto/update-wish-item.dto';

@Controller('wish-items')
@UseGuards(JwtAuthGuard)
export class WishItemsController {
  constructor(private readonly wishItemsService: WishItemsService) {}

  @Get(':id')
  getOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.wishItemsService.getMine(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateWishItemDto,
  ) {
    return this.wishItemsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    await this.wishItemsService.remove(user.sub, id);
    return { deleted: true };
  }
}
