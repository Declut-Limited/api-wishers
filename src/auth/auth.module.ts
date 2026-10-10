import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { WalletsModule } from '../wallets/wallets.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [UsersModule, EmailModule, WalletsModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
