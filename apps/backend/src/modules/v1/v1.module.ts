import { Module } from '@nestjs/common';
import { FileModule } from './file/file.module';
import { OrganizationModule } from './organization/organization.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    FileModule,
    OrganizationModule,
    UserModule,
  ],
  exports: [
    FileModule,
    OrganizationModule,
    UserModule,
  ],
})
export class V1Module {} 