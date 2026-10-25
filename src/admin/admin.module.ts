import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import {
  BankAccount,
  BankAccountSchema,
} from '../bank-accounts/schemas/bank-account.schema';
import {
  AppSettings,
  AppSettingsSchema,
} from '../settings/schemas/app-settings.schema';
import { SettingsModule } from '../settings/settings.module';
import {
  Transaction,
  TransactionSchema,
} from '../transactions/schemas/transaction.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Wallet, WalletSchema } from '../wallets/schemas/wallet.schema';
import {
  WishItem,
  WishItemSchema,
} from '../wishlists/schemas/wish-item.schema';
import { Wishlist, WishlistSchema } from '../wishlists/schemas/wishlist.schema';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

// The admin dashboard's data (admin-wishers). Reads the other modules' collections directly.
@Module({
  imports: [
    AdminAuthModule,
    SettingsModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: BankAccount.name, schema: BankAccountSchema },
      { name: Wishlist.name, schema: WishlistSchema },
      { name: WishItem.name, schema: WishItemSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: AppSettings.name, schema: AppSettingsSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
