import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { RedisModule } from '../../../core/redis/redis.module';
import { N8nConfigService } from './n8n-config.service';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [ConfigModule, HttpModule, RedisModule, forwardRef(() => WorkflowModule)],
  controllers: [],
  providers: [N8nConfigService],
  exports: [N8nConfigService],
})
export class N8nModule {}

