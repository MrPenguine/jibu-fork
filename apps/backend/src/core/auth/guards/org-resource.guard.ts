import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
// Define the key here to avoid circular dependency
export const ORG_RESOURCE_KEY = 'orgResource';

/**
 * Guard that ensures a user can only access resources that belong to their organization
 * This guard checks if the resource ID in the request params belongs to the user's organization
 */
@Injectable()
export class OrgResourceGuard implements CanActivate {
  private readonly logger = new Logger(OrgResourceGuard.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resourceConfig = this.reflector.getAllAndOverride<{ model: string, paramName: string }>(
      ORG_RESOURCE_KEY,
      [context.getHandler(), context.getClass()]
    );

    // If no resource config is specified, allow access
    if (!resourceConfig) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;
    const resourceId = request.params[resourceConfig.paramName];

    // If no resource ID or user, deny access
    if (!resourceId || !user || !user.lastWorkspaceId) {
      this.logger.warn(`Access denied: Missing resourceId (${resourceId}), user (${!!user}), or workspace ID (${user?.lastWorkspaceId})`);
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    try {
      // Check if the resource belongs to the user's workspace
      const resource = await this.prisma[resourceConfig.model].findUnique({
        where: { id: resourceId },
        select: { workspaceId: true }
      });

      // If resource doesn't exist or doesn't belong to user's workspace, deny access
      if (!resource || resource.workspaceId !== user.lastWorkspaceId) {
        this.logger.warn(`Access denied: Resource ${resourceId} does not belong to workspace ${user.lastWorkspaceId}`);
        throw new ForbiddenException('You do not have permission to access this resource');
      }

      return true;
    } catch (error) {
      this.logger.error(`Error checking resource access: ${error.message}`);
      throw new ForbiddenException('Error verifying resource access');
    }
  }
}

