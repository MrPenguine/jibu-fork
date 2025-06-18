import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VectorDbService } from './vector-db.service';
import { VectorDbController } from './vector-db.controller';

@Module({
  imports: [ConfigModule],
  providers: [VectorDbService],
  exports: [VectorDbService],
  controllers: [VectorDbController],
})
export class VectorDbModule {}