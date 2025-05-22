import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../../../core/database/database.module';
import { CredentialModule } from '../../credential/credential.module';
import { McpToolController } from './mcp-tool.controller';
import { McpToolService } from './mcp-tool.service';
import { McpApiKeyGuard } from './mcp-api-key.guard';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [ConfigModule, DatabaseModule, CredentialModule],
  controllers: [McpToolController],
  providers: [
    McpToolService,
    McpApiKeyGuard,
    {
      provide: APP_GUARD,
      useClass: McpApiKeyGuard,
    },
  ],
  exports: [McpToolService],
})
export class McpToolModule {}
