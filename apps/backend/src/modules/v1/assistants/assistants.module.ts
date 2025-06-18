import { Module } from '@nestjs/common';
import { AssistantsService } from './assistants.service';
import { PrismaModule } from '../../../core/database/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AssistantsService],
  exports: [AssistantsService],
})
export class AssistantsModule {}
