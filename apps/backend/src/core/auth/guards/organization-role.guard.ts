import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

export function OrganizationRoleGuard(...roles: string[]) {
  @Injectable()
  class OrganizationRoleGuardClass implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest<{
        membership?: { role?: string };
        user?: { workspaceRole?: string };
      }>();
      const requiredRoles =
        roles.length > 0
          ? roles
          : this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
              context.getHandler(),
              context.getClass(),
            ]) || [];
      if (requiredRoles.length === 0) return true;

      const actualRole = request.membership?.role || request.user?.workspaceRole;
      if (!actualRole || !requiredRoles.some((role) => role.toLowerCase() === actualRole.toLowerCase())) {
        throw new ForbiddenException(
          `Access denied. Required role(s): ${requiredRoles.join(', ')}`,
        );
      }
      return true;
    }
  }

  return OrganizationRoleGuardClass;
}
