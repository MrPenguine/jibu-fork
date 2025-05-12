import { Module } from '@nestjs/common';
import { FileModule } from './file/file.module';
import { OrganizationModule } from './organization/organization.module';
import { UserModule } from './user/user.module';
import { AssistantModule } from './assistants/assistant.module';
import { KnowledgeBaseModule } from './knowledgeBase/knowledge-base.module';
import { AgentModule } from './agent/agent.module';

@Module({
  imports: [
    FileModule,
    OrganizationModule,
    UserModule,
    AssistantModule,
    KnowledgeBaseModule,
    AgentModule,
  ],
  exports: [
    FileModule,
    OrganizationModule,
    UserModule,
    AssistantModule,
    KnowledgeBaseModule,
    AgentModule,
  ],
})
export class V1Module {} 