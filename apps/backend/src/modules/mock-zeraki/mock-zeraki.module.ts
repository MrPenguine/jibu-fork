import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { MockZerakiController } from './mock-zeraki.controller';
import { MockZerakiService } from './mock-zeraki.service';

@Module({
  imports: [PrismaModule],
  controllers: [MockZerakiController],
  providers: [MockZerakiService],
  exports: [MockZerakiService],
})
export class MockZerakiModule {}
