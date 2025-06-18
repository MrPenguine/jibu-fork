import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../../../core/database/database.module';
import { CredentialModule } from '../../credential/credential.module';
import { FunctionToolController } from './function-tool.controller';
import { FunctionToolService } from './function-tool.service';

@Module({
  imports: [ConfigModule, DatabaseModule, CredentialModule],
  controllers: [FunctionToolController],
  providers: [FunctionToolService],
  exports: [FunctionToolService],
})
export class FunctionToolModule {}
