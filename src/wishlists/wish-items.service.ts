import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Wishlist } from './schemas/wishlist.schema';
import { WishItem, WishItemDocument } from './schemas/wish-item.schema';
import { CreateWishItemDto } from './dto/create-wish-item.dto';
import { UpdateWishItemDto } from './dto/update-wish-item.dto';
import { WishlistsService } from './wishlists.service';
import { SettingsService } from '../settings/settings.service';
import { RealtimeService } from '../realtime/realtime.service';
import { generateSlug } from '../common/utils/slug.util';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditEntityType } from '../audit-log/schemas/audit-log.schema';

@Injectable()
export class WishItemsService {
  constructor(
    @InjectModel(Wishlist.name) private readonly wishlistModel: Model<Wishlist>,
    @InjectModel(WishItem.name) private readonly wishItemModel: Model<WishItem>,
    private readonly wishlistsService: WishlistsService,
    private readonly settingsService: SettingsService,
    private readonly realtime: RealtimeService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(ownerId: string, wishlistId: string, dto: CreateWishItemDto) {
    await this.wishlistsService.findOwned(ownerId, wishlistId);
    const settings = await this.settingsService.get();

    const count = await this.wishItemModel.countDocuments({
      wishlist: wishlistId,
    });
    if (count >= settings.wishItemCreationLimit) {
      throw new BadRequestException(
        `You cannot create more than ${settings.wishItemCreationLimit} wishes in a wishlist`,
      );
    }
    this.assertImagesAndGoal(settings, dto.images, dto.goalAmount);

    const wishItem = await this.wishItemModel.create({
      ...dto,
      wishlist: wishlistId,
      owner: ownerId,
      slug: await this.uniqueSlug(),
    });
    await this.recalculateWishlistTotals(wishlistId);
    await this.auditLog.record({
      entityType: AuditEntityType.WISH_ITEM,
      entityId: wishItem._id.toString(),
      event: 'wish_item.created',
      actor: ownerId,
      metadata: { wishlist: wishlistId },
    });
    this.realtime.wishItemChanged(
      ownerId,
      wishItem._id.toString(),
      wishlistId,
      'created',
    );
    return wishItem;
  }

  async listForWishlist(ownerId: string, wishlistId: string) {
    await this.wishlistsService.findOwned(ownerId, wishlistId);
    return this.wishItemModel
      .find({ wishlist: wishlistId })
      .sort({ createdAt: -1 })
      .exec();
  }

  getMine(ownerId: string, id: string) {
    return this.findOwned(ownerId, id);
  }

  async update(ownerId: string, id: string, dto: UpdateWishItemDto) {
    const existing = await this.findOwned(ownerId, id);
    const settings = await this.settingsService.get();
    this.assertImagesAndGoal(settings, dto.images, dto.goalAmount);

    const goalAmount = dto.goalAmount ?? existing.goalAmount;
    const wishItem = await this.wishItemModel
      .findByIdAndUpdate(
        id,
        { ...dto, isCompleted: existing.amountReceived >= goalAmount },
        { new: true },
      )
      .exec();
    const wishlistId = existing.wishlist.toString();
    await this.recalculateWishlistTotals(wishlistId);
    await this.auditLog.record({
      entityType: AuditEntityType.WISH_ITEM,
      entityId: id,
      event: 'wish_item.updated',
      actor: ownerId,
      metadata: { fields: Object.keys(dto) },
    });
    this.realtime.wishItemChanged(ownerId, id, wishlistId, 'updated');
    return wishItem;
  }

  // Like the Firebase app: the wish's money and givers drop out of the wishlist totals with it.
  async remove(ownerId: string, id: string): Promise<void> {
    const existing = await this.findOwned(ownerId, id);
    const wishlistId = existing.wishlist.toString();
    await this.wishItemModel.deleteOne({ _id: id });
    await this.recalculateWishlistTotals(wishlistId);
    await this.auditLog.record({
      entityType: AuditEntityType.WISH_ITEM,
      entityId: id,
      event: 'wish_item.deleted',
      actor: ownerId,
      metadata: { wishlist: wishlistId, title: existing.title },
    });
    this.realtime.wishItemChanged(ownerId, id, wishlistId, 'deleted');
  }

  // Totals are always derived from the wish items, never written by clients.
  async recalculateWishlistTotals(wishlistId: string): Promise<void> {
    const [totals] = await this.wishItemModel.aggregate<{
      totalWishItems: number;
      totalGoalAmount: number;
      totalAmountReceived: number;
      totalContributors: number;
    }>([
      { $match: { wishlist: new Types.ObjectId(wishlistId) } },
      {
        $group: {
          _id: null,
          totalWishItems: { $sum: 1 },
          totalGoalAmount: { $sum: '$goalAmount' },
          totalAmountReceived: { $sum: '$amountReceived' },
          totalContributors: { $sum: '$contributorCount' },
        },
      },
    ]);
    const t = totals ?? {
      totalWishItems: 0,
      totalGoalAmount: 0,
      totalAmountReceived: 0,
      totalContributors: 0,
    };
    const wishlist = await this.wishlistModel
      .findByIdAndUpdate(
        wishlistId,
        {
          totalWishItems: t.totalWishItems,
          totalGoalAmount: t.totalGoalAmount,
          totalAmountReceived: t.totalAmountReceived,
          totalContributors: t.totalContributors,
          isCompleted:
            t.totalGoalAmount > 0 && t.totalAmountReceived >= t.totalGoalAmount,
        },
        { new: true },
      )
      .select('owner')
      .exec();
    if (wishlist) {
      this.realtime.wishlistChanged(
        wishlist.owner.toString(),
        wishlistId,
        'updated',
      );
    }
  }

  private async findOwned(
    ownerId: string,
    id: string,
  ): Promise<WishItemDocument> {
    const wishItem = await this.wishItemModel.findById(id).exec();
    if (!wishItem) throw new NotFoundException('Wish not found');
    if (wishItem.owner.toString() !== ownerId) {
      throw new ForbiddenException('You do not own this wish');
    }
    return wishItem;
  }

  private assertImagesAndGoal(
    settings: {
      maxWishItemImages: number;
      minGoalAmount: number;
      maxGoalAmount: number;
    },
    images?: string[],
    goalAmount?: number,
  ): void {
    if (images && images.length > settings.maxWishItemImages) {
      throw new BadRequestException(
        `A wish can have at most ${settings.maxWishItemImages} images`,
      );
    }
    if (
      goalAmount !== undefined &&
      (goalAmount < settings.minGoalAmount ||
        goalAmount > settings.maxGoalAmount)
    ) {
      throw new BadRequestException(
        `goalAmount must be between ${settings.minGoalAmount} and ${settings.maxGoalAmount}`,
      );
    }
  }

  private async uniqueSlug(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const slug = generateSlug();
      if (!(await this.wishItemModel.exists({ slug }))) return slug;
    }
    throw new Error('Could not generate a unique wish slug');
  }
}
