import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (!user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    if (user.isSuspended) {
      throw new ForbiddenException('Account suspended');
    }

    const allowedIPs =
      this.configService
        .get<string>('ADMIN_ALLOWED_IPS')
        ?.split(',')
        .map((ip) => ip.trim())
        .filter((ip) => ip.length > 0) ?? [];

    if (allowedIPs.length > 0 && process.env.NODE_ENV === 'production') {
      const clientIP = this.getClientIP(request);
      const isAllowed = this.isIPAllowed(clientIP, allowedIPs);

      if (!isAllowed) {
        throw new ForbiddenException(`Access denied from IP: ${clientIP}`);
      }
    }

    return true;
  }

  private getClientIP(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.ip
    );
  }

  private isIPAllowed(clientIP: string, allowedIPs: string[]): boolean {
    return allowedIPs.some((allowedIP) => {
      if (allowedIP.includes('/')) {
        return false;
      }
      return clientIP === allowedIP;
    });
  }
}
