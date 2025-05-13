import { Module } from '@nestjs/common';
import { ConsoleService } from './console.service';
import { ConsoleController } from './console.controller';
import { DatabaseModule } from '../../../core/database/database.module';
import { RedisModule } from '../../../core/redis/redis.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule
  ],
  providers: [ConsoleService],
  controllers: [ConsoleController],
  exports: [ConsoleService]
})
export class ConsoleModule {} 