import { Module } from '@nestjs/common';
import { N8nController } from './n8n.controller';
import { N8nService } from './n8n.service';
import { N8nIntegrationModule } from '../../../integrations/n8n/n8n-integration.module';
import { N8nOrchestratorModule } from '../../../core/n8n-orchestrator/n8n-orchestrator.module';

@Module({
  imports: [N8nIntegrationModule, N8nOrchestratorModule],
  controllers: [N8nController],
  providers: [N8nService],
  exports: [N8nService],
})
export class N8nModule {}
