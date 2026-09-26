import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ContactService } from './contact.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
