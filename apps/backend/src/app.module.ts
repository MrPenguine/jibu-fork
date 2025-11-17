import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { V1Module } from './modules/v1/v1.module';
import { RedisModule } from './core/redis/redis.module';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, 
    }),
    RedisModule,
    V1Module,
    ChatModule,
  ],
})
export class AppModule {}
