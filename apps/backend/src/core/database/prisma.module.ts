import { Module, Global } from '@nestjs/common';
import { PrismaService, getSharedPrismaService } from './prisma.service';

@Global()
@Module({
  providers: [{ provide: PrismaService, useFactory: getSharedPrismaService }],
  exports: [PrismaService],
})
export class PrismaModule {}
