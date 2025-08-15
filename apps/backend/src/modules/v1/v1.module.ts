import { Module } from '@nestjs/common';
import { FileModule } from './file/file.module';
import { OrganizationModule } from './organization/organization.module';
import { UserModule } from './user/user.module';
import { AssistantModule } from './assistants/assistant.module';
import { KnowledgeBaseModule } from './knowledgeBase/knowledge-base.module';
import { AgentModule } from './agent/agent.module';
import { ChatsModule } from './chats/chats.module';
import { ConsoleModule } from './console/console.module';
import { ToolsModule } from './tools/tools.module';
import { VoicesModule } from './voices/voices.module';
import { FolderModule } from './folder/folder.module';
import { InvitationModule } from './invitation/invitation.module';


@Module({
  imports: [
    FileModule,
    OrganizationModule,
    UserModule,
    AssistantModule,
    KnowledgeBaseModule,
    AgentModule,
    ChatsModule,
    ConsoleModule,
    ToolsModule,
    VoicesModule,
    FolderModule,
    InvitationModule,
  ],
  exports: [
    FileModule,
    OrganizationModule,
    UserModule,
    AssistantModule,
    KnowledgeBaseModule,
    AgentModule,
    ChatsModule,
    ConsoleModule,
    ToolsModule,
    VoicesModule,
    FolderModule,
    InvitationModule,
  ],
})
export class V1Module {}