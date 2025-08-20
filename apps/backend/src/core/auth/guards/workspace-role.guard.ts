import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are specified, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // If no user or user has no workspace role, deny access
    if (!user || !user.workspaceRole) {
      throw new ForbiddenException('You do not have the required role to access this resource');
    }

    // Check if user's role is in the required roles
    const hasPermission = requiredRoles.includes(user.workspaceRole);
    
    if (!hasPermission) {
      throw new ForbiddenException(`Required role: ${requiredRoles.join(' or ')}. Your role: ${user.workspaceRole}`);
    }
    
    return true;
  }
}
