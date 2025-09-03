import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../database/prisma.service';

// Define the request with user property
interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
    orgId?: string; // legacy
    orgRole?: string; // legacy
    orgName?: string; // legacy
    currentOrgRole?: string; // legacy
    lastWorkspaceId?: string;
    currentWorkspaceRole?: string;
    [key: string]: any;
  };
}

@Injectable()
export class OrganizationParamMiddleware implements NestMiddleware {
  constructor(private prismaService: PrismaService) {}

  async use(req: RequestWithUser, res: Response, next: NextFunction) {
    // Only process if there's a relevant workspace/organization param and a user
    const targetWorkspaceId = req.params.workspaceId || req.params.orgId;
    if (!targetWorkspaceId || !req.user) {
      next();
      return;
    }

    try {
      // Check if user has access to this workspace
      const membership = await this.prismaService.workspaceMembership.findFirst({
        where: {
          userId: req.user.id,
          workspaceId: targetWorkspaceId,
        },
      });

      if (!membership) {
        throw new ForbiddenException('You do not have access to this workspace');
      }

      // Enhance the request with membership role information
      req.user.currentWorkspaceRole = membership.role;
      // Maintain legacy field for any remaining org-based code paths
      req.user.currentOrgRole = membership.role;
      next();
    } catch (error) {
      next(error);
    }
  }
}