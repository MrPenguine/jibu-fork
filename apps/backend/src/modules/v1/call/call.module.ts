import { Module } from '@nestjs/common';
import { CallController } from './call.controller';
import { CallService } from './call.service';
import { PrismaModule } from '../../../core/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CallController],
  providers: [CallService],
  exports: [CallService],
})
export class CallModule {}
