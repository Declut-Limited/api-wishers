import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Wishlist, WishlistSchema } from './schemas/wishlist.schema';
import { WishItem, WishItemSchema } from './schemas/wish-item.schema';
import {
  WishlistVisit,
  WishlistVisitSchema,
} from './schemas/wishlist-visit.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { SettingsModule } from '../settings/settings.module';
import { WishlistsService } from './wishlists.service';
import { WishItemsService } from './wish-items.service';
import { WishlistsController } from './wishlists.controller';
import { WishItemsController } from './wish-items.controller';
import { PublicWishlistsController } from './public-wishlists.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Wishlist.name, schema: WishlistSchema },
      { name: WishItem.name, schema: WishItemSchema },
      { name: WishlistVisit.name, schema: WishlistVisitSchema },
      { name: User.name, schema: UserSchema },
    ]),
    SettingsModule,
  ],
  controllers: [
    WishlistsController,
    WishItemsController,
    PublicWishlistsController,
  ],
  providers: [WishlistsService, WishItemsService],
  exports: [WishlistsService, WishItemsService],
})
export class WishlistsModule {}
