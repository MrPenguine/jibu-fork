import { Module } from '@nestjs/common';
import { FileModule } from './file/file.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { UserModule } from './user/user.module';
import { KnowledgeBaseModule } from './knowledgeBase/knowledge-base.module';
import { AgentModule } from './agent/agent.module';
import { ChatsModule } from './chats/chats.module';
import { ConsoleModule } from './console/console.module';
import { VoicesModule } from './voices/voices.module';
import { FolderModule } from './folder/folder.module';
import { InvitationModule } from './invitation/invitation.module';


@Module({
  imports: [
    FileModule,
    WorkspaceModule,
    UserModule,
    KnowledgeBaseModule,
    AgentModule,
    ChatsModule,
    ConsoleModule,
    VoicesModule,
    FolderModule,
    InvitationModule,
  ],
  exports: [
    FileModule,
    WorkspaceModule,
    UserModule,
    KnowledgeBaseModule,
    AgentModule,
    ChatsModule,
    ConsoleModule,
    VoicesModule,
    FolderModule,
    InvitationModule,
  ],
})
export class V1Module {}