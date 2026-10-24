import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  WishItem,
  WishItemSchema,
} from '../wishlists/schemas/wish-item.schema';
import { Wishlist, WishlistSchema } from '../wishlists/schemas/wishlist.schema';
import {
  Contributor,
  ContributorSchema,
} from '../contributors/schemas/contributor.schema';
import {
  Transaction,
  TransactionSchema,
} from '../transactions/schemas/transaction.schema';
import { PaystackModule } from '../paystack/paystack.module';
import { SettingsModule } from '../settings/settings.module';
import { BankAccountsModule } from '../bank-accounts/bank-accounts.module';
import { WalletsModule } from '../wallets/wallets.module';
import { WishlistsModule } from '../wishlists/wishlists.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsService } from './payments.service';
import { SettlementsService } from './settlements.service';
import { PublicPaymentsController } from './public-payments.controller';
import { PaystackWebhookController } from './paystack-webhook.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: User.name, schema: UserSchema },
      { name: WishItem.name, schema: WishItemSchema },
      { name: Wishlist.name, schema: WishlistSchema },
      { name: Contributor.name, schema: ContributorSchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    PaystackModule,
    SettingsModule,
    BankAccountsModule,
    WalletsModule,
    WishlistsModule,
    NotificationsModule,
  ],
  controllers: [PublicPaymentsController, PaystackWebhookController],
  providers: [PaymentsService, SettlementsService],
})
export class PaymentsModule {}
