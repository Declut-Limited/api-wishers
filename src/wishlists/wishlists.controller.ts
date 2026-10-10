import {
  Body,
  Controller,
  Delete,
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
import { PaginationDto } from '../common/dto/pagination.dto';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { WishlistsService } from './wishlists.service';
import { WishItemsService } from './wish-items.service';
import { CreateWishlistDto } from './dto/create-wishlist.dto';
import { UpdateWishlistDto } from './dto/update-wishlist.dto';
import { CreateWishItemDto } from './dto/create-wish-item.dto';

@Controller('wishlists')
@UseGuards(JwtAuthGuard)
export class WishlistsController {
  constructor(
    private readonly wishlistsService: WishlistsService,
    private readonly wishItemsService: WishItemsService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateWishlistDto,
  ) {
    return this.wishlistsService.create(user.sub, dto);
  }

  @Get('me')
  listMine(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: PaginationDto,
  ) {
    return this.wishlistsService.listMine(user.sub, query.page, query.limit);
  }

  @Get('featured')
  listFeatured(@Query() query: PaginationDto) {
    return this.wishlistsService.listFeatured(query.page, query.limit);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.wishlistsService.getMine(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateWishlistDto,
  ) {
    return this.wishlistsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    await this.wishlistsService.remove(user.sub, id);
    return { deleted: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/impression')
  async impression(@Param('id', ParseObjectIdPipe) id: string) {
    await this.wishlistsService.recordImpression(id);
    return { recorded: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/visit')
  visit(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.wishlistsService.recordVisit(user.sub, id);
  }

  @Post(':id/items')
  createItem(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: CreateWishItemDto,
  ) {
    return this.wishItemsService.create(user.sub, id, dto);
  }

  @Get(':id/items')
  listItems(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseObjectIdPipe) id: string,
  ) {
    return this.wishItemsService.listForWishlist(user.sub, id);
  }
}
