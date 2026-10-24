import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BankAccount, BankAccountSchema } from './schemas/bank-account.schema';
import { BankAccountsService } from './bank-accounts.service';
import { BankAccountsController } from './bank-accounts.controller';
import { BankDirectoryService } from './bank-directory.service';
import { PaystackModule } from '../paystack/paystack.module';
import { UsersModule } from '../users/users.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BankAccount.name, schema: BankAccountSchema },
    ]),
    PaystackModule,
    UsersModule,
    SettingsModule,
  ],
  controllers: [BankAccountsController],
  providers: [BankAccountsService, BankDirectoryService],
  exports: [BankAccountsService],
})
export class BankAccountsModule {}
