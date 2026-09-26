import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { SessionAuthGuard } from '../core/auth/guards/session-auth.guard';
import { AuthModule } from '../core/auth/auth.module';
import { DatabaseModule } from '../core/database/database.module';
import { V1Module } from '../modules/v1/v1.module';
import { EncryptionModule } from '../core/encryption/encryption.module';
import { RedisModule } from '../core/redis/redis.module';
import { AdminModule } from '../modules/admin/admin.module';
import { LiveKitModule } from '../modules/livekit/livekit.module';
import { WhatsAppModule } from '../modules/channels/whatsapp/whatsapp.module';
import { ProviderCredentialsModule } from '../core/provider-credentials/provider-credentials.module';
import { ContactModule } from '../core/contact/contact.module';
import { MemoryModule } from '../core/memory/memory.module';
import { MockZerakiModule } from '../modules/mock-zeraki/mock-zeraki.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Global rate limit: 120 requests / 60s per IP, applied to every route
    // via the APP_GUARD below. Per-route overrides use @Throttle()/@SkipThrottle().
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    EncryptionModule,
    AuthModule,
    V1Module,
    LiveKitModule,
    WhatsAppModule,
    RedisModule,
    ProviderCredentialsModule,
    ContactModule,
    MemoryModule,
    MockZerakiModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
    },
  ],
})
export class AppModule {}
