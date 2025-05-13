import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { IntegrationsModule } from '../../../integrations/integrations.module';
import { ChatsModule } from '../chats/chats.module';

@Module({
  imports: [
    IntegrationsModule,
    ChatsModule
  ],
  controllers: [AgentController],
})
export class AgentModule {}