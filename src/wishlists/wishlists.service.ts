import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Wishlist, WishlistDocument } from './schemas/wishlist.schema';
import { WishItem } from './schemas/wish-item.schema';
import { WishlistVisit } from './schemas/wishlist-visit.schema';
import { User } from '../users/schemas/user.schema';
import { CreateWishlistDto } from './dto/create-wishlist.dto';
import { UpdateWishlistDto } from './dto/update-wishlist.dto';
import { SettingsService } from '../settings/settings.service';
import { RealtimeService } from '../realtime/realtime.service';
import { generateSlug } from '../common/utils/slug.util';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditEntityType } from '../audit-log/schemas/audit-log.schema';
import { Paginated, pageWindow } from '../common/utils/paginate.util';

// Fields a contributor-facing page may see — never the owner's email, phone or tokens.
const PUBLIC_WISHLIST_FIELDS =
  'title description image slug link totalWishItems totalGoalAmount totalAmountReceived totalContributors isCompleted contributorsImages currentBoostExpiresAt owner createdAt';
const PUBLIC_ITEM_FIELDS =
  'title description images slug goalAmount amountReceived contributorCount isCompleted contributorsImages createdAt';

@Injectable()
export class WishlistsService {
  constructor(
    @InjectModel(Wishlist.name) private readonly wishlistModel: Model<Wishlist>,
    @InjectModel(WishItem.name) private readonly wishItemModel: Model<WishItem>,
    @InjectModel(WishlistVisit.name)
    private readonly visitModel: Model<WishlistVisit>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly settingsService: SettingsService,
    private readonly realtime: RealtimeService,
    private readonly config: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(ownerId: string, dto: CreateWishlistDto) {
    const { wishlistCreationLimit } = await this.settingsService.get();
    const count = await this.wishlistModel.countDocuments({ owner: ownerId });
    if (count >= wishlistCreationLimit) {
      throw new BadRequestException(
        `You cannot create more than ${wishlistCreationLimit} wishlists`,
      );
    }

    const slug = await this.uniqueSlug();
    const wishlist = await this.wishlistModel.create({
      ...dto,
      owner: ownerId,
      slug,
      link: `${this.config.get<string>('PAY_APP_URL')}/w/${slug}`,
    });
    await this.auditLog.record({
      entityType: AuditEntityType.WISHLIST,
      entityId: wishlist._id.toString(),
      event: 'wishlist.created',
      actor: ownerId,
    });
    this.realtime.wishlistChanged(ownerId, wishlist._id.toString(), 'created');
    return wishlist;
  }

  async listMine(
    ownerId: string,
    page = 1,
    limit = 20,
  ): Promise<Paginated<WishlistDocument>> {
    const filter = { owner: ownerId };
    const { skip } = pageWindow(page, limit);
    const [results, total] = await Promise.all([
      this.wishlistModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.wishlistModel.countDocuments(filter),
    ]);
    return { results, total, page, limit };
  }

  // Same ordering as the app's Firestore query: biggest raised, then most givers, then most boosts.
  async listFeatured(page = 1, limit = 20) {
    const filter = {
      active: true,
      currentBoostExpiresAt: { $gte: new Date() },
    };
    const { skip } = pageWindow(page, limit);
    const [results, total] = await Promise.all([
      this.wishlistModel
        .find(filter)
        .select(`${PUBLIC_WISHLIST_FIELDS} boostingCreator`)
        .sort({
          totalAmountReceived: -1,
          totalContributors: -1,
          previousBoostingCount: -1,
        })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.wishlistModel.countDocuments(filter),
    ]);
    return { results, total, page, limit };
  }

  async getMine(ownerId: string, id: string) {
    const wishlist = await this.findOwned(ownerId, id);
    const wishItems = await this.wishItemModel
      .find({ wishlist: id })
      .sort({ createdAt: -1 })
      .exec();
    return { ...wishlist.toObject(), wishItems };
  }

  async update(ownerId: string, id: string, dto: UpdateWishlistDto) {
    await this.findOwned(ownerId, id);
    const wishlist = await this.wishlistModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    await this.auditLog.record({
      entityType: AuditEntityType.WISHLIST,
      entityId: id,
      event: 'wishlist.updated',
      actor: ownerId,
      metadata: { fields: Object.keys(dto) },
    });
    this.realtime.wishlistChanged(ownerId, id, 'updated');
    return wishlist;
  }

  // Contributors and transactions are kept — they're the money history.
  async remove(ownerId: string, id: string): Promise<void> {
    const wishlist = await this.findOwned(ownerId, id);
    await this.wishItemModel.deleteMany({ wishlist: id });
    await this.visitModel.deleteMany({ wishlist: id });
    await this.wishlistModel.deleteOne({ _id: id });
    await this.auditLog.record({
      entityType: AuditEntityType.WISHLIST,
      entityId: id,
      event: 'wishlist.deleted',
      actor: ownerId,
      metadata: { title: wishlist.title },
    });
    this.realtime.wishlistChanged(ownerId, id, 'deleted');
  }

  async recordImpression(id: string): Promise<void> {
    const res = await this.wishlistModel.updateOne(
      { _id: id },
      { $inc: { impressionCount: 1 } },
    );
    if (!res.matchedCount) throw new NotFoundException('Wishlist not found');
  }

  // Counts each signed-in visitor once; the owner's own visits don't count.
  async recordVisit(
    visitorId: string,
    id: string,
  ): Promise<{ counted: boolean }> {
    const wishlist = await this.wishlistModel
      .findById(id)
      .select('owner')
      .exec();
    if (!wishlist) throw new NotFoundException('Wishlist not found');
    if (wishlist.owner.toString() === visitorId) return { counted: false };

    const res = await this.visitModel.updateOne(
      { wishlist: id, visitor: visitorId },
      { $setOnInsert: { wishlist: id, visitor: visitorId } },
      { upsert: true },
    );
    if (!res.upsertedCount) return { counted: false };
    await this.wishlistModel.updateOne(
      { _id: id },
      { $inc: { visitCount: 1 } },
    );
    return { counted: true };
  }

  async getPublicBySlug(slug: string) {
    const wishlist = await this.wishlistModel
      .findOne({ slug, active: true })
      .select(PUBLIC_WISHLIST_FIELDS)
      .lean()
      .exec();
    if (!wishlist) throw new NotFoundException('Wishlist not found');

    const [wishItems, creator] = await Promise.all([
      this.wishItemModel
        .find({ wishlist: wishlist._id, active: true })
        .select(PUBLIC_ITEM_FIELDS)
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
      this.publicCreator(wishlist.owner),
    ]);
    return { ...wishlist, owner: undefined, creator, wishItems };
  }

  async getPublicItemBySlug(wishlistSlug: string, itemSlug: string) {
    const wishlist = await this.wishlistModel
      .findOne({ slug: wishlistSlug, active: true })
      .select(PUBLIC_WISHLIST_FIELDS)
      .lean()
      .exec();
    if (!wishlist) throw new NotFoundException('Wishlist not found');

    const wishItem = await this.wishItemModel
      .findOne({ wishlist: wishlist._id, slug: itemSlug, active: true })
      .select(PUBLIC_ITEM_FIELDS)
      .lean()
      .exec();
    if (!wishItem) throw new NotFoundException('Wish not found');

    const { owner, ...rest } = wishlist;
    return {
      wishItem,
      wishlist: rest,
      creator: await this.publicCreator(owner),
    };
  }

  async findOwned(ownerId: string, id: string): Promise<WishlistDocument> {
    const wishlist = await this.wishlistModel.findById(id).exec();
    if (!wishlist) throw new NotFoundException('Wishlist not found');
    if (wishlist.owner.toString() !== ownerId) {
      throw new ForbiddenException('You do not own this wishlist');
    }
    return wishlist;
  }

  private async publicCreator(ownerId: Types.ObjectId) {
    const user = await this.userModel
      .findById(ownerId)
      .select('name image')
      .lean()
      .exec();
    return user ? { name: user.name, image: user.image } : null;
  }

  private async uniqueSlug(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const slug = generateSlug();
      if (!(await this.wishlistModel.exists({ slug }))) return slug;
    }
    throw new Error('Could not generate a unique wishlist slug');
  }
}
