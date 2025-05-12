import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { IntegrationsModule } from '../../../integrations/integrations.module';

@Module({
  imports: [IntegrationsModule],
  controllers: [AgentController],
})
export class AgentModule {}
