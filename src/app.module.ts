import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { AuthGuardsModule } from './auth/guards/guards.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MediaModule } from './media/media.module';
import { SettingsModule } from './settings/settings.module';
import { RealtimeModule } from './realtime/realtime.module';
import { WishlistsModule } from './wishlists/wishlists.module';
import { ContributorsModule } from './contributors/contributors.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WalletsModule } from './wallets/wallets.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { PaymentsModule } from './payments/payments.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { AdminModule } from './admin/admin.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
      }),
    }),
    // Global baseline; auth and money endpoints get stricter @Throttle() overrides.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    HealthModule,
    CloudinaryModule,
    AuthGuardsModule,
    AuthModule,
    UsersModule,
    MediaModule,
    SettingsModule,
    RealtimeModule,
    WishlistsModule,
    ContributorsModule,
    TransactionsModule,
    AuditLogModule,
    NotificationsModule,
    WalletsModule,
    BankAccountsModule,
    PaymentsModule,
    AdminAuthModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
