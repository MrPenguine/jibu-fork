import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { UserSyncService } from '../../sync/sync.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly userSyncService: UserSyncService,
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
    let user = await this.prismaService.user.findUnique({
      where: { id: payload.sub },
      include: { 
        lastOrg: true,
      },
    });

    // If user doesn't exist, sync them from Supabase. This will create the user
    // and their default organization.
    if (!user) {
      // The JWT payload (`payload`) has the user ID in `sub`, but the sync service
      // expects it in `id`. We must transform the payload to the correct format.
      const supabaseUserForSync = {
        id: payload.sub, // Map `sub` to `id`
        email: payload.email,
        email_confirmed_at: payload.email_verified ? new Date().toISOString() : null,
        user_metadata: payload.user_metadata || {},
        app_metadata: payload.app_metadata || {},
        last_sign_in_at: new Date().toISOString(),
        phone: payload.phone || null,
        phone_confirmed_at: payload.phone_verified ? new Date().toISOString() : null,
        is_anonymous: payload.is_anonymous || false,
      };

      await this.userSyncService.syncUserFromSupabase(supabaseUserForSync);

      // Re-fetch the user to get all relations, including the new organization
      user = await this.prismaService.user.findUnique({
        where: { id: payload.sub },
        include: {
          lastOrg: true,
        },
      });

      // If user is still not found after sync, something went wrong.
      if (!user) {
        throw new UnauthorizedException('Could not sync user from Supabase.');
      }
    }

    // The strategy now returns the basic user object. The controller will be
    // responsible for fetching the full, enriched context.
    return user;
  }
} 