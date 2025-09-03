import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { WORKSPACE_RESOURCE_KEY } from '../decorators/workspace-resource.decorator';

/**
 * Guard that ensures a user can only access resources that belong to their workspace
 * This guard checks if the resource ID in the request params belongs to the user's workspace
 */
@Injectable()
export class WorkspaceResourceGuard implements CanActivate {
  private readonly logger = new Logger(WorkspaceResourceGuard.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resourceConfig = this.reflector.getAllAndOverride<{ model: string, paramName: string }>(WORKSPACE_RESOURCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!resourceConfig) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;
    const resourceId = request.params[resourceConfig.paramName];
    const workspaceId = request.headers['x-workspace-id'] as string;

    if (!resourceId || !user || !workspaceId) {
      this.logger.warn(`Access denied: Missing resourceId (${resourceId}), user (${!!user}), or workspaceId (${workspaceId})`);
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    try {
      const resource = await this.prisma[resourceConfig.model].findUnique({
        where: { id: resourceId },
        select: { workspaceId: true },
      });

      if (!resource || resource.workspaceId !== workspaceId) {
        this.logger.warn(`Access denied: Resource ${resourceId} does not belong to workspace ${workspaceId}`);
        throw new ForbiddenException('You do not have permission to access this resource');
      }

      return true;
    } catch (error) {
      this.logger.error(`Error checking resource access: ${error.message}`);
      throw new ForbiddenException('Error verifying resource access');
    }
  }
}
