import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    QueueModule,
  ],
  controllers: [], // No controllers needed for worker
  providers: [],
})
export class AppModule {}
