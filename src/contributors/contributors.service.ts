import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contributor, ContributorDocument } from './schemas/contributor.schema';
import { WishItem } from '../wishlists/schemas/wish-item.schema';
import { Wishlist } from '../wishlists/schemas/wishlist.schema';
import { pageWindow } from '../common/utils/paginate.util';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { ContributorDetailsDto } from './dto/contributor-details.dto';

// A giver can add their details for this long after paying.
export const DETAILS_WINDOW_MS = 24 * 60 * 60 * 1000;
// Wish items and wishlists show the first few givers' photos.
const MAX_CONTRIBUTOR_IMAGES = 6;

@Injectable()
export class ContributorsService {
  constructor(
    @InjectModel(Contributor.name)
    private readonly contributorModel: Model<Contributor>,
    @InjectModel(WishItem.name) private readonly wishItemModel: Model<WishItem>,
    @InjectModel(Wishlist.name) private readonly wishlistModel: Model<Wishlist>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly config: ConfigService,
  ) {}

  // --- public: the giver's details step, keyed by the payment reference ----------------------
  // The contributor record itself is created (anonymous) by the payment flow once the payment is
  // verified; this step only fills in the name, photo and message, once, within DETAILS_WINDOW_MS.

  // A selfie upload signature that only works for this gift's own folder.
  async detailsUploadSignature(reference: string) {
    const contributor = await this.findOpenForDetails(reference);
    return this.cloudinaryService.generateUploadSignature(
      this.imageFolder(contributor),
    );
  }

  async addDetails(reference: string, dto: ContributorDetailsDto) {
    const contributor = await this.findOpenForDetails(reference);

    const anonymous = dto.isAnonymous;
    const image = anonymous ? undefined : dto.image;
    if (image && !this.isOwnUpload(image, contributor)) {
      throw new BadRequestException(
        "That photo wasn't uploaded for this contribution",
      );
    }

    const set: Partial<Contributor> = {
      isAnonymous: anonymous,
      detailsAddedAt: new Date(),
      ...(!anonymous && { name: dto.name?.trim() }),
      ...(!anonymous && dto.message?.trim() && { message: dto.message.trim() }),
      ...(image && { image }),
    };
    // Atomic once-only: a second (or simultaneous) submit finds detailsAddedAt already set.
    const updated = await this.contributorModel
      .findOneAndUpdate(
        { _id: contributor._id, detailsAddedAt: { $exists: false } },
        { $set: set },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new ConflictException(
        'Details were already added for this contribution',
      );
    }

    if (image) {
      // $slice keeps the first MAX_CONTRIBUTOR_IMAGES photos, like the old app did.
      const push = {
        $push: {
          contributorsImages: {
            $each: [image],
            $slice: MAX_CONTRIBUTOR_IMAGES,
          },
        },
      };
      await Promise.all([
        this.wishItemModel.updateOne({ _id: updated.wishItem }, push).exec(),
        this.wishlistModel.updateOne({ _id: updated.wishlist }, push).exec(),
      ]);
    }

    return {
      reference,
      isAnonymous: updated.isAnonymous,
      name: updated.isAnonymous ? undefined : updated.name,
    };
  }

  private async findOpenForDetails(reference: string) {
    const contributor = await this.contributorModel
      .findOne({ reference })
      .exec();
    if (!contributor) throw new NotFoundException('Contribution not found');
    if (contributor.detailsAddedAt) {
      throw new ConflictException(
        'Details were already added for this contribution',
      );
    }
    const createdAt = (contributor as unknown as { createdAt?: Date })
      .createdAt;
    if (createdAt && Date.now() - createdAt.getTime() > DETAILS_WINDOW_MS) {
      throw new ForbiddenException(
        'Details can no longer be added to this contribution',
      );
    }
    return contributor;
  }

  private imageFolder(contributor: ContributorDocument) {
    return `contributors/${contributor._id.toString()}`;
  }

  // Only a photo uploaded to our own Cloudinary, into this gift's folder, is accepted.
  private isOwnUpload(url: string, contributor: ContributorDocument) {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    if (!cloudName) return false;
    return (
      url.startsWith(`https://res.cloudinary.com/${cloudName}/image/upload/`) &&
      url.includes(`/${this.imageFolder(contributor)}/`)
    );
  }

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
