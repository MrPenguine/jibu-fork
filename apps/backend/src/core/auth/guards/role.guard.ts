import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Logger } from '@nestjs/common';

// Define a constant for the metadata key
export const ROLES_KEY = 'roles';

/**
 * Factory function to create a RoleGuard with specific required roles
 * @param roles The roles required to access the route
 * @returns A guard that checks if the user has the required roles
 */
export function RoleGuard(...roles: string[]) {
  @Injectable()
  class RoleGuardClass implements CanActivate {
    private readonly logger = new Logger('RoleGuard');
    
    constructor(private reflector: Reflector) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest();
      const { user, membership } = request;

      // If no user or membership, deny access
      if (!user || !membership) {
        this.logger.warn('Access denied: Missing user or membership information');
        throw new ForbiddenException('Access denied: Missing user or membership information');
      }

      // Get the user's role from the membership
      const userRoleRaw = membership.role;
      const userRole = typeof userRoleRaw === 'string' ? userRoleRaw.toLowerCase() : '';
      const requiredRoles = roles.map(r => (typeof r === 'string' ? r.toLowerCase() : ''));

      // Check if the user has any of the required roles
      const hasRequiredRole = requiredRoles.includes(userRole);

      if (!hasRequiredRole) {
        const userIdentifier = user?.userId ?? user?.id ?? 'unknown';
        const requestedRolesLog = roles.join(', ');
        this.logger.warn(`User ${userIdentifier} with role ${userRoleRaw} attempted to access route requiring roles: ${requestedRolesLog}`);
        throw new ForbiddenException(`Access denied: Required role(s): ${requestedRolesLog}`);
      }

      return true;
    }
  }

  return RoleGuardClass;
}

/**
 * Decorator to specify required roles for a route
 * @param roles The roles required to access the route
 */
export const Roles = (...roles: string[]) => {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      // Method decorator
      Reflect.defineMetadata(ROLES_KEY, roles, descriptor.value);
      return descriptor;
    }
    // Class decorator
    Reflect.defineMetadata(ROLES_KEY, roles, target);
    return target;
  };
};
