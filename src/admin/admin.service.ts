import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditEntityType } from '../audit-log/schemas/audit-log.schema';
import { BankAccount } from '../bank-accounts/schemas/bank-account.schema';
import { pageWindow } from '../common/utils/paginate.util';
import { Payment, PaymentStatus } from '../payments/schemas/payment.schema';
import { AppSettings } from '../settings/schemas/app-settings.schema';
import { SettingsService } from '../settings/settings.service';
import { Transaction } from '../transactions/schemas/transaction.schema';
import { AccountStatus, User } from '../users/schemas/user.schema';
import { Wallet } from '../wallets/schemas/wallet.schema';
import { WishItem } from '../wishlists/schemas/wish-item.schema';
import { Wishlist } from '../wishlists/schemas/wishlist.schema';
import {
  AdminListTransactionsDto,
  AdminListUsersDto,
  AdminListWishlistsDto,
} from './dto/admin-query.dto';
import { AdminUpdateSettingsDto } from './dto/admin-update.dto';

const USER_FIELDS =
  'name email phone image emailVerified accountStatus inviteCode referralsCount createdAt deletedAt';
const OWNER_FIELDS = 'name email image';

interface Totals {
  count: number;
  volume: number;
  paidToWishers: number;
  paidToReferrers: number;
  revenue: number;
  processingFees: number;
}

const EMPTY_TOTALS: Totals = {
  count: 0,
  volume: 0,
  paidToWishers: 0,
  paidToReferrers: 0,
  revenue: 0,
  processingFees: 0,
};

const PAYMENT_TOTALS = {
  _id: null,
  count: { $sum: 1 },
  volume: { $sum: '$giftAmount' },
  paidToWishers: { $sum: '$wisherShare' },
  paidToReferrers: { $sum: '$referrerShare' },
  revenue: { $sum: '$appShare' },
  processingFees: { $sum: '$charges' },
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Read-mostly admin views across every user. Writes: suspend/restore a user, edit app settings.
@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Wallet.name) private readonly walletModel: Model<Wallet>,
    @InjectModel(BankAccount.name)
    private readonly bankModel: Model<BankAccount>,
    @InjectModel(Wishlist.name) private readonly wishlistModel: Model<Wishlist>,
    @InjectModel(WishItem.name) private readonly wishItemModel: Model<WishItem>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<Payment>,
    @InjectModel(AppSettings.name)
    private readonly settingsModel: Model<AppSettings>,
    private readonly settingsService: SettingsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async stats() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [
      users,
      verifiedUsers,
      suspendedUsers,
      newUsers,
      wishlists,
      completedWishlists,
      wishItems,
      payments,
      recentUsers,
      recentTransactions,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ emailVerified: true }),
      this.userModel.countDocuments({ accountStatus: AccountStatus.SUSPENDED }),
      this.userModel.countDocuments({ createdAt: { $gte: weekAgo } }),
      this.wishlistModel.countDocuments(),
      this.wishlistModel.countDocuments({ isCompleted: true }),
      this.wishItemModel.countDocuments(),
      // Revenue comes from successful payments: each one records Wishers' own share (appShare).
      this.paymentModel.aggregate<{
        all: Totals[];
        month: Totals[];
      }>([
        { $match: { status: PaymentStatus.SUCCESS } },
        {
          $facet: {
            all: [{ $group: PAYMENT_TOTALS }],
            month: [
              { $match: { paidAt: { $gte: monthStart } } },
              { $group: PAYMENT_TOTALS },
            ],
          },
        },
      ]),
      this.userModel
        .find()
        .select(USER_FIELDS)
        .sort({ createdAt: -1 })
        .limit(5)
        .exec(),
      this.transactionModel
        .find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('owner', OWNER_FIELDS)
        .exec(),
    ]);

    const all = payments[0]?.all[0] ?? EMPTY_TOTALS;
    const month = payments[0]?.month[0] ?? EMPTY_TOTALS;
    return {
      users: {
        total: users,
        verified: verifiedUsers,
        suspended: suspendedUsers,
        newThisWeek: newUsers,
      },
      wishlists: { total: wishlists, completed: completedWishlists, wishItems },
      // Naira. volume = contributions made (before fees); revenue = Wishers' share;
      // processingFees = Paystack fees, paid by givers on top of the contribution.
      contributions: {
        count: all.count,
        volume: all.volume,
        paidToWishers: all.paidToWishers,
        paidToReferrers: all.paidToReferrers,
        revenue: all.revenue,
        processingFees: all.processingFees,
      },
      thisMonth: {
        count: month.count,
        volume: month.volume,
        revenue: month.revenue,
      },
      recentUsers,
      recentTransactions,
    };
  }

  async listUsers(dto: AdminListUsersDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const filter: QueryFilter<User> = {};
    if (dto.status) filter.accountStatus = dto.status;
    if (dto.q?.trim()) {
      const rx = new RegExp(escapeRegex(dto.q.trim()), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }
    const { skip } = pageWindow(page, limit);
    const [results, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select(USER_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter),
    ]);
    return { results, total, page, limit };
  }

  async getUser(id: string) {
    const user = await this.userModel
      .findById(id)
      .select(USER_FIELDS + ' referredBy')
      .populate('referredBy', OWNER_FIELDS)
      .exec();
    if (!user) throw new NotFoundException('User not found');
    const [wallet, bankAccount, wishlists] = await Promise.all([
      this.walletModel.findOne({ owner: id }).exec(),
      this.bankModel.findOne({ owner: id }).exec(),
      this.wishlistModel
        .find({ owner: id })
        .sort({ createdAt: -1 })
        .limit(50)
        .exec(),
    ]);
    return { user, wallet, bankAccount, wishlists };
  }

  // Suspending also ends their sessions: the refresh token is cleared, so they're out within one access-token lifetime.
  async setUserStatus(
    adminId: string,
    id: string,
    accountStatus: 'active' | 'suspended',
  ) {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    if (user.accountStatus === AccountStatus.DEACTIVATED) {
      throw new BadRequestException('This account was deleted by its owner');
    }
    await this.userModel
      .updateOne(
        { _id: id },
        accountStatus === 'suspended'
          ? { accountStatus, $unset: { refreshToken: 1 } }
          : { accountStatus },
      )
      .exec();
    await this.auditLog.record({
      entityType: AuditEntityType.USER,
      entityId: id,
      event:
        accountStatus === 'suspended'
          ? 'user.suspended_by_admin'
          : 'user.restored_by_admin',
      actor: adminId,
    });
    return this.userModel.findById(id).select(USER_FIELDS).exec();
  }

  async listWishlists(dto: AdminListWishlistsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const filter: QueryFilter<Wishlist> = {};
    if (dto.status) filter.isCompleted = dto.status === 'completed';
    if (dto.q?.trim())
      filter.title = new RegExp(escapeRegex(dto.q.trim()), 'i');
    const { skip } = pageWindow(page, limit);
    const [results, total] = await Promise.all([
      this.wishlistModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('owner', OWNER_FIELDS)
        .exec(),
      this.wishlistModel.countDocuments(filter),
    ]);
    return { results, total, page, limit };
  }

  async getWishlist(id: string) {
    const wishlist = await this.wishlistModel
      .findById(id)
      .populate('owner', OWNER_FIELDS)
      .exec();
    if (!wishlist) throw new NotFoundException('Wishlist not found');
    const wishItems = await this.wishItemModel
      .find({ wishlist: id })
      .sort({ createdAt: 1 })
      .exec();
    return { ...wishlist.toObject(), wishItems };
  }

  async listTransactions(dto: AdminListTransactionsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const filter: QueryFilter<Transaction> = {};
    if (dto.type) filter.type = dto.type;
    if (dto.status) filter.status = dto.status;
    const { skip } = pageWindow(page, limit);
    const [results, total] = await Promise.all([
      this.transactionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('owner', OWNER_FIELDS)
        .exec(),
      this.transactionModel.countDocuments(filter),
    ]);
    return { results, total, page, limit };
  }

  getSettings() {
    return this.settingsService.get();
  }

  async updateSettings(adminId: string, dto: AdminUpdateSettingsDto) {
    const current = await this.settingsService.get();
    const min = dto.minGoalAmount ?? current.minGoalAmount;
    const max = dto.maxGoalAmount ?? current.maxGoalAmount;
    if (min > max)
      throw new BadRequestException(
        'minGoalAmount cannot be more than maxGoalAmount',
      );
    const wisher = dto.wisherSharePercentage ?? current.wisherSharePercentage;
    const referrer =
      dto.referrerSharePercentage ?? current.referrerSharePercentage;
    if (wisher + referrer > 100) {
      throw new BadRequestException(
        'wisherSharePercentage + referrerSharePercentage cannot exceed 100',
      );
    }

    const updated = await this.settingsModel
      .findOneAndUpdate({ key: 'app' }, { $set: dto }, { new: true })
      .exec();
    await this.auditLog.record({
      entityType: AuditEntityType.ADMIN,
      entityId: adminId,
      event: 'settings.updated',
      actor: adminId,
      metadata: { fields: Object.keys(dto) },
    });
    return updated;
  }
}
