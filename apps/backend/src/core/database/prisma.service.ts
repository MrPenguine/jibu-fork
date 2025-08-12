import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    // Add aliases for models with casing issues
    Object.defineProperty(this, 'Tool', {
      get: function() {
        return this.tool;
      }
    });
    
    Object.defineProperty(this, 'Credential', {
      get: function() {
        return this.credential;
      }
    });
    
    Object.defineProperty(this, 'Folder', {
      get: function() {
        return this.folder;
      }
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}