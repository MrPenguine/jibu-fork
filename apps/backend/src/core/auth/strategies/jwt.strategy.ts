import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('SUPABASE_JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Supabase JWT payload contains 'sub' (subject) which is the user ID
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Get user data with organization info
    const user = await this.prismaService.user.findUnique({
      where: { id: payload.sub },
      include: { 
        lastOrg: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Get organization role if a last organization is set
    let orgRole = null;
    let membershipStatus = null;
    if (user.lastOrgId) {
      const membership = await this.prismaService.organizationMembership.findFirst({
        where: {
          userId: user.id,
          organizationId: user.lastOrgId,
        },
      });
      
      orgRole = membership?.role;
      membershipStatus = membership?.status;
    }

    // Return enriched user information with org context
    return {
      id: payload.sub,
      email: payload.email,
      firstName: user.firstName,
      lastName: user.lastName,
      orgId: user.lastOrgId,
      orgName: user.lastOrg?.name,
      orgRole: orgRole,
      membershipStatus: membershipStatus,
    };
  }
} 