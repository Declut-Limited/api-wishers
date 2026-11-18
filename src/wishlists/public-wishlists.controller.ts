import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WishlistsService } from './wishlists.service';
import { RecordViewDto } from './dto/record-view.dto';

// Unauthenticated — backs the pay.wishers.com.ng contribution pages.
@Controller('public/wishlists')
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class PublicWishlistsController {
  constructor(private readonly wishlistsService: WishlistsService) {}

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.wishlistsService.getPublicBySlug(slug);
  }

  @Get(':slug/items/:itemSlug')
  getItemBySlug(
    @Param('slug') slug: string,
    @Param('itemSlug') itemSlug: string,
  ) {
    return this.wishlistsService.getPublicItemBySlug(slug, itemSlug);
  }

  // Sent from the visitor's browser after 5 seconds on a wishlist or wish page.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post(':slug/view')
  recordView(
    @Param('slug') slug: string,
    @Body() dto: RecordViewDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.wishlistsService.recordPublicView(
      slug,
      dto.visitorId,
      userAgent,
    );
  }
}
