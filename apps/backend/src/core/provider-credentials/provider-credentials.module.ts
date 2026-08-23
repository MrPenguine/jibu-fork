import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { EncryptionModule } from '../encryption/encryption.module';
import { ProviderCredentialsResolver } from './provider-credentials.resolver';

@Global()
@Module({
  imports: [ConfigModule, DatabaseModule, EncryptionModule],
  providers: [ProviderCredentialsResolver],
  exports: [ProviderCredentialsResolver],
})
export class ProviderCredentialsModule {}
