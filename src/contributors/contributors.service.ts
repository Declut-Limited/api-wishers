import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contributor, ContributorDocument } from './schemas/contributor.schema';
import { WishItem } from '../wishlists/schemas/wish-item.schema';
import { pageWindow } from '../common/utils/paginate.util';

@Injectable()
export class ContributorsService {
  constructor(
    @InjectModel(Contributor.name)
    private readonly contributorModel: Model<Contributor>,
    @InjectModel(WishItem.name) private readonly wishItemModel: Model<WishItem>,
  ) {}

  async listMine(ownerId: string, page = 1, limit = 20) {
    return this.paginate({ owner: ownerId }, page, limit);
  }

  async getMine(ownerId: string, id: string) {
    const contributor = await this.contributorModel.findById(id).exec();
    if (!contributor) throw new NotFoundException('Contributor not found');
    if (contributor.owner.toString() !== ownerId) {
      throw new ForbiddenException('You do not own this contribution');
    }
    return this.mask(contributor);
  }

  async listForWishItem(
    ownerId: string,
    wishItemId: string,
    page = 1,
    limit = 20,
  ) {
    const wishItem = await this.wishItemModel
      .findById(wishItemId)
      .select('owner')
      .exec();
    if (!wishItem) throw new NotFoundException('Wish not found');
    if (wishItem.owner.toString() !== ownerId) {
      throw new ForbiddenException('You do not own this wish');
    }
    return this.paginate({ wishItem: wishItemId }, page, limit);
  }

  private async paginate(
    filter: Record<string, string>,
    page: number,
    limit: number,
  ) {
    const { skip } = pageWindow(page, limit);
    const [docs, total] = await Promise.all([
      this.contributorModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.contributorModel.countDocuments(filter),
    ]);
    return { results: docs.map((d) => this.mask(d)), total, page, limit };
  }

  // Anonymous givers stay anonymous to the owner too.
  private mask(doc: ContributorDocument) {
    const c = doc.toObject();
    if (!c.isAnonymous) return c;
    return { ...c, name: 'Anonymous', email: undefined, image: undefined };
  }
}
