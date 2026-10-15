import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Contributor, ContributorSchema } from './schemas/contributor.schema';
import {
  WishItem,
  WishItemSchema,
} from '../wishlists/schemas/wish-item.schema';
import { Wishlist, WishlistSchema } from '../wishlists/schemas/wishlist.schema';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { ContributorsService } from './contributors.service';
import { ContributorsController } from './contributors.controller';
import { PublicContributionsController } from './public-contributions.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contributor.name, schema: ContributorSchema },
      { name: WishItem.name, schema: WishItemSchema },
      { name: Wishlist.name, schema: WishlistSchema },
    ]),
    CloudinaryModule,
  ],
  controllers: [ContributorsController, PublicContributionsController],
  providers: [ContributorsService],
  exports: [ContributorsService],
})
export class ContributorsModule {}
