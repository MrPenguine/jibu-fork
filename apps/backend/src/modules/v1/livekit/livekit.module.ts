import { Module } from '@nestjs/common';
import { LivekitService } from './livekit.service';
import { LivekitController } from './livekit.controller';
import { ConfigModule } from '@nestjs/config';
import { RoomManagerService } from './services/room-manager.service';

@Module({
  imports: [ConfigModule],
  controllers: [LivekitController],
  providers: [LivekitService, RoomManagerService],
  exports: [LivekitService, RoomManagerService],
})
export class LivekitModule {}
