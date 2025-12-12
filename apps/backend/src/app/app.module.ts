import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '../core/auth/auth.module';
import { DatabaseModule } from '../core/database/database.module';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { V1Module } from '../modules/v1/v1.module';
import { EncryptionModule } from '../core/encryption/encryption.module';
import { RedisModule } from '../core/redis/redis.module';
import { AdminModule } from '../modules/admin/admin.module';
import { VoiceModule } from '../modules/voice/voice.module';
import { LiveKitModule } from '../modules/livekit/livekit.module';

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
    RedisModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
