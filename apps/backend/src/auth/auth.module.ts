import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserSyncService } from './services/sync.service';
import { WebhookController } from './controllers/webhook.controller';
import { UserController } from './controllers/user.controller';
import { OrganizationController } from './controllers/organization.controller';
import { DatabaseModule } from '../database/database.module';
import { SupabaseWebhookGuard } from './guards/supabase-webhook.guard'; // Import the guard

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule,
    DatabaseModule,
  ],
  controllers: [WebhookController, UserController, OrganizationController],
  providers: [JwtStrategy, UserSyncService, SupabaseWebhookGuard], // Add SupabaseWebhookGuard here
  exports: [UserSyncService],
})
export class AuthModule {}