import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { PrismaModule } from '../../../core/database/prisma.module';
import { MemoryModule } from '../../../core/memory/memory.module';

@Module({
  imports: [PrismaModule, MemoryModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
