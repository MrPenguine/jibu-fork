import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../database/prisma.service';

// Define the request with user property
interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
    orgId?: string;
    orgRole?: string;
    orgName?: string;
    currentOrgRole?: string;
    [key: string]: any;
  };
}

@Injectable()
export class OrganizationParamMiddleware implements NestMiddleware {
  constructor(private prismaService: PrismaService) {}

  async use(req: RequestWithUser, res: Response, next: NextFunction) {
    // Only process if there's an :orgId param and a user
    if (!req.params.orgId || !req.user) {
      next();
      return;
    }

    try {
      // Check if user has access to this organization
      const membership = await this.prismaService.organizationMembership.findFirst({
        where: {
          userId: req.user.id,
          organizationId: req.params.orgId,
        },
      });

      if (!membership) {
        throw new ForbiddenException('You do not have access to this organization');
      }

      // Enhance the request with membership role information
      req.user.currentOrgRole = membership.role;
      next();
    } catch (error) {
      next(error);
    }
  }
} 