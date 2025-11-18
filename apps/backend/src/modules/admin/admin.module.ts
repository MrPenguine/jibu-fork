import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { AdminDashboardController } from './controllers/dashboard.controller';
import { AdminDashboardService } from './services/dashboard.service';
import { AdminAuditMiddleware } from '../../core/middleware/admin-audit.middleware';
import { AdminGuard } from '../../core/auth/guards/admin.guard';
import { AdminRoleGuard } from '../../core/auth/guards/admin-role.guard';
import { AdminUsersController } from './controllers/users.controller';
import { AdminWorkspacesController } from './controllers/workspaces.controller';
import { AdminUsersService } from './services/users.service';
import { AdminWorkspacesService } from './services/workspaces.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminDashboardController, AdminUsersController, AdminWorkspacesController],
  providers: [
    AdminDashboardService,
    AdminUsersService,
    AdminWorkspacesService,
    AdminGuard,
    AdminRoleGuard,
    AdminAuditMiddleware,
  ],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AdminAuditMiddleware).forRoutes('admin/*');
  }
}
