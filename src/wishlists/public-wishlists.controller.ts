import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WishlistsService } from './wishlists.service';

// Unauthenticated — backs the pay.wishers.app contribution pages.
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
}
