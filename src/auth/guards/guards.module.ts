import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordResetTokenService } from '../password-reset-token.service';

// Global so any module can use JwtAuthGuard without importing AuthModule (which depends on UsersModule — a cycle).
// JwtModule is global too: a guard's dependencies resolve in the consuming module's scope.
@Global()
@Module({
  imports: [JwtModule.register({ global: true })],
  providers: [JwtAuthGuard, PasswordResetTokenService],
  exports: [JwtAuthGuard, PasswordResetTokenService],
})
export class AuthGuardsModule {}
