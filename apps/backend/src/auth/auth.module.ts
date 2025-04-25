import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserSyncService } from './services/sync.service';
import { WebhookController } from './controllers/webhook.controller';
import { UserController } from './controllers/user.controller';
import { OrganizationController } from './controllers/organization.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule,
    DatabaseModule,
  ],
  controllers: [WebhookController, UserController, OrganizationController],
  providers: [JwtStrategy, UserSyncService],
  exports: [UserSyncService],
})
export class AuthModule {} 