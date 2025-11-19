import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { AdminDashboardController } from './controllers/dashboard.controller';
import { AdminDashboardService } from './services/dashboard.service';
import { AdminAuditMiddleware } from '../../core/middleware/admin-audit.middleware';
import { AdminGuard } from '../../core/auth/guards/admin.guard';
import { AdminRoleGuard } from '../../core/auth/guards/admin-role.guard';
import { AdminUsersController } from './controllers/users.controller';
import { AdminWorkspacesController } from './controllers/workspaces.controller';
import { AdminPlansController } from './controllers/plans.controller';
import { AdminSubscriptionsController } from './controllers/subscriptions.controller';
import { AdminAnalyticsController } from './controllers/analytics.controller';
import { AdminUsersService } from './services/users.service';
import { AdminWorkspacesService } from './services/workspaces.service';
import { AdminPlansService } from './services/plans.service';
import { AdminSubscriptionsService } from './services/subscriptions.service';
import { AdminUsageService } from './services/usage.service';
import { AdminAnalyticsService } from './services/analytics.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminWorkspacesController,
    AdminPlansController,
    AdminSubscriptionsController,
    AdminAnalyticsController,
  ],
  providers: [
    AdminDashboardService,
    AdminUsersService,
    AdminWorkspacesService,
    AdminPlansService,
    AdminSubscriptionsService,
    AdminUsageService,
    AdminAnalyticsService,
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
