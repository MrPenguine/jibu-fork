import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { WebhookUrlModule } from '../../../core/webhook/webhook-url.module';
import { ServicesModule } from '../../../core/services/services.module';

/**
 * ChatsModule now only exposes empty controller/service shells so we can
 * repurpose the route for webhook experiments without legacy behavior.
 */
@Module({
  imports: [WebhookUrlModule, ServicesModule],
  controllers: [ChatsController],
  providers: [ChatsService],
  exports: [ChatsService],
})
export class ChatsModule {}