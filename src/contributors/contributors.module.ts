import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Contributor, ContributorSchema } from './schemas/contributor.schema';
import {
  WishItem,
  WishItemSchema,
} from '../wishlists/schemas/wish-item.schema';
import { ContributorsService } from './contributors.service';
import { ContributorsController } from './contributors.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contributor.name, schema: ContributorSchema },
      { name: WishItem.name, schema: WishItemSchema },
    ]),
  ],
  controllers: [ContributorsController],
  providers: [ContributorsService],
  exports: [ContributorsService],
})
export class ContributorsModule {}
