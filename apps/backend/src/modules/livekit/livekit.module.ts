import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { RedisModule } from '../../core/redis/redis.module';
import { AgentRuntimeModule } from '../../integrations/agent/agent-runtime.module';
import { LiveKitService } from './livekit.service';
import { LiveKitController } from './livekit.controller';
import { LiveKitAgentService } from './livekit-agent.service';
import { CallConcurrencyService } from './call-concurrency.service';

@Module({
  imports: [PrismaModule, RedisModule, AgentRuntimeModule],
  providers: [LiveKitService, LiveKitAgentService, CallConcurrencyService],
  controllers: [LiveKitController],
  exports: [LiveKitService, LiveKitAgentService, CallConcurrencyService],
})
export class LiveKitModule {}
