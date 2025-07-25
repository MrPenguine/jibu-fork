import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { WebhookModule } from '../../webhook/webhook.module';
import { UserModule } from '../../modules/v1/user/user.module';
import { OrganizationModule } from '../../modules/v1/organization/organization.module';
import { DatabaseModule } from '../database/database.module';
import { SupabaseWebhookGuard } from './guards/supabase-webhook.guard';
import { SyncModule } from '../sync/sync.module';
import { ApiKeyModule } from '../../modules/v1/api-key/api-key.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule,
    DatabaseModule,
    forwardRef(() => WebhookModule),
    UserModule,
    OrganizationModule,
    SyncModule,
    ApiKeyModule,
  ],
  controllers: [],
  providers: [JwtStrategy, SupabaseWebhookGuard],
  exports: [],
})
export class AuthModule {}