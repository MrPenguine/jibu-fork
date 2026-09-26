import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from '../core/auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  /**
   * Container liveness check — no DB/Redis dependency by design, so a
   * transient dependency outage doesn't flap the container's health state.
   */
  @Public()
  @Get('health')
  getHealth() {
    return { status: 'ok' };
  }
}
