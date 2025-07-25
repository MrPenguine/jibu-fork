import { Module, forwardRef } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../core/database/database.module';
import { AuthModule } from '../core/auth/auth.module';
import { SyncModule } from '../core/sync/sync.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    forwardRef(() => AuthModule),
    SyncModule
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService]
})
export class WebhookModule {} 