import { Module } from '@nestjs/common';
import { CredentialService } from './credential.service';
import { CredentialController } from './credential.controller';
import { DatabaseModule } from '../../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [CredentialService],
  controllers: [CredentialController],
  exports: [CredentialService],
})
export class CredentialModule {} 