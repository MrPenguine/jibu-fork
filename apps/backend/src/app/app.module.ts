import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_GUARD } from '@nestjs/core';
import { SessionAuthGuard } from '../core/auth/guards/session-auth.guard';
import { AuthModule } from '../core/auth/auth.module';
import { DatabaseModule } from '../core/database/database.module';
import { V1Module } from '../modules/v1/v1.module';
import { EncryptionModule } from '../core/encryption/encryption.module';
import { RedisModule } from '../core/redis/redis.module';
import { AdminModule } from '../modules/admin/admin.module';
import { VoiceModule } from '../modules/voice/voice.module';
import { LiveKitModule } from '../modules/livekit/livekit.module';
import { WhatsAppModule } from '../modules/channels/whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    EncryptionModule,
    AuthModule,
    V1Module,
    VoiceModule,
    LiveKitModule,
    WhatsAppModule,
    RedisModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
    },
  ],
})
export class AppModule {}
