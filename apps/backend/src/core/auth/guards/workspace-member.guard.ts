import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { Reflector } from '@nestjs/core';
import { Logger } from '@nestjs/common';

/**
 * Guard that verifies the user is a member of the requested workspace/organization
 * This ensures users can only access resources within organizations they belong to
 */
@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  private readonly logger = new Logger(WorkspaceMemberGuard.name);

  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if the route has the isPublic metadata
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;
    
    // Extract workspace/organization ID from various possible locations
    const workspaceId = 
      request.params?.workspaceId || 
      request.params?.organizationId || 
      request.body?.workspaceId || 
      request.body?.organizationId ||
      request.query?.workspaceId ||
      request.headers['x-workspace-id'] ||
      request.headers['x-organization-id'] ||
      request.headers['workspace-id'] ||
      request.headers['organization-id'] ||
      user?.lastWorkspaceId; // final fallback

    // If no user or workspace ID, deny access
    if (!user || !workspaceId) {
      this.logger.warn('Access denied: Missing user or workspace ID');
      throw new ForbiddenException('Access denied: Missing user or workspace ID');
    }

    try {
      // Check if the user is a member of the workspace
      const membership = await this.prisma.workspaceMembership.findFirst({
        where: { 
          userId: user.id,
          workspaceId: workspaceId,
          status: 'active' // Only active memberships should grant access
        },
      });

      if (!membership) {
        this.logger.warn(`User ${user.id} attempted to access unauthorized workspace ${workspaceId}`);
        throw new ForbiddenException('You are not a member of this workspace');
      }

      // Store the membership in the request for potential use by other guards or controllers
      request.membership = membership;
      
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      
      this.logger.error(`Error verifying workspace membership: ${error.message}`, error.stack);
      throw new ForbiddenException('Error verifying workspace membership');
    }
  }
}

