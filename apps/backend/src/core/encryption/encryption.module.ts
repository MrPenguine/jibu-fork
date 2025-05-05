import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VaultService } from './vault.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [VaultService],
    exports: [VaultService],
})
export class EncryptionModule {} 