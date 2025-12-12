import { Controller, Get, Query } from '@nestjs/common';
import { LiveKitService } from './livekit.service';
import { Public } from '../../core/auth/decorators/public.decorator';

@Controller('livekit')
export class LiveKitController {
  constructor(private readonly livekitService: LiveKitService) {}

  @Public()
  @Get('token')
  async getToken(@Query('room') room: string, @Query('user') user: string) {
    return { token: await this.livekitService.createToken(user, room) };
  }
}
