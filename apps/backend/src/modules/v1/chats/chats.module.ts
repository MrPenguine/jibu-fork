import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { DatabaseModule } from '../../../core/database/database.module';
import { RedisModule } from '../../../core/redis/redis.module';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [ChatsController],
  providers: [ChatsService],
  exports: [ChatsService]
})
export class ChatsModule {} 