import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { UserSyncService } from '../../sync/sync.service';
import type { Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  // Short-lived cache of validated users to avoid repeated DB lookups per token
  private readonly validatedCache = new Map<string, { user: any; exp: number }>();
  // Deduplicate background sync attempts per subject
  private readonly inflightSync = new Set<string>();
  // Rate-limit debug logs per subject
  private readonly lastDebugLogAt = new Map<string, number>();
  private readonly cacheTtlMs: number;
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly userSyncService: UserSyncService,
  ) {
    const jwtKeyStr = configService.get<string>('SUPABASE_JWT_KEY');
    let secretOrKey: string | Buffer | undefined;
    let algorithms: any[] = ['HS256'];

    if (jwtKeyStr) {
      try {
        const jwkContainer = JSON.parse(jwtKeyStr);
        const jwk = jwkContainer.keys?.[0] || jwkContainer;
        const keyObject = crypto.createPublicKey({
          format: 'jwk',
          key: jwk,
        });
        // Export to SPKI PEM format to satisfy string | Buffer type constraints
        secretOrKey = keyObject.export({
          type: 'spki',
          format: 'pem',
        }) as string;
        algorithms = ['ES256'];
        // eslint-disable-next-line no-console
        console.log('JWT Strategy: Loaded JWK for ES256 verification.');
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('JWT Strategy: Failed to load SUPABASE_JWT_KEY, falling back to SUPABASE_JWT_SECRET:', err);
      }
    }

    if (!secretOrKey) {
      secretOrKey = configService.get<string>('SUPABASE_JWT_SECRET');
      if (!secretOrKey) {
        const msg = 'Neither SUPABASE_JWT_KEY nor SUPABASE_JWT_SECRET is configured. JWT verification will fail.';
        // eslint-disable-next-line no-console
        console.error(msg);
        throw new Error(msg);
      }
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey,
      algorithms,
      passReqToCallback: true,
    });

    // Now it's safe to use the logger
    this.logger.log(`Supabase JWT secret/key loaded (length=${secretOrKey.length}).`);
    this.cacheTtlMs = Number(this.configService.get('AUTH_CACHE_TTL_MS') ?? 10_000);
  }

  async validate(req: Request, payload: any) {
    const sub = payload?.sub ?? 'N/A';
    // Rate-limit the noisy debug log (once every 2s per subject)
    const now = Date.now();
    const last = this.lastDebugLogAt.get(sub) || 0;
    if (now - last > 2000) {
      this.logger.debug(`Validating JWT payload for sub=${sub}`);
      this.lastDebugLogAt.set(sub, now);
    }
    // Supabase JWT payload contains 'sub' (subject) which is the user ID
    if (!payload.sub) {
      this.logger.warn('JWT payload missing required claim: sub');
      throw new UnauthorizedException('Invalid token payload');
    }

    // Prefer caching by the exact token value; fallback to subject if missing
    const authHeader = (req?.headers?.authorization || '') as string;
    const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;
    const cacheKey = bearer || payload.sub;

    // Return cached user if present and not expired
    const cached = cacheKey ? this.validatedCache.get(cacheKey) : undefined;
    if (cached && cached.exp > now) {
      return cached.user;
    }

    // Get user data with last workspace info
    let user = await this.prismaService.user.findUnique({
      where: { id: payload.sub },
      include: { lastWorkspace: true },
    });

    // If not found by ID, try resolving by identity mapping (providerIds contains sub)
    if (!user) {
      user = await this.prismaService.user.findFirst({
        where: { providerIds: { has: payload.sub } },
        include: { lastWorkspace: true },
      });
      if (user) {
        this.logger.debug(`Resolved user by providerIds mapping for sub=${payload.sub} -> id=${user.id}`);
      }
    }

    // If still not found, try resolving by unique email (normalize to lowercase)
    if (!user && payload.email) {
      const emailLower = (payload.email || '').toLowerCase();
      const byEmail = await this.prismaService.user.findUnique({
        where: { email: emailLower },
        include: { lastWorkspace: true },
      });
      if (byEmail) {
        // Link current sub to this user for fast future lookups
        if (!Array.isArray(byEmail.providerIds) || !byEmail.providerIds.includes(payload.sub)) {
          await this.prismaService.user.update({
            where: { id: byEmail.id },
            data: { providerIds: { push: payload.sub } },
          });
        }
        user = byEmail;
        this.logger.debug(`Resolved user by email=${emailLower} for sub=${payload.sub} -> id=${byEmail.id}`);
      }
    }

    // If user doesn't exist, trigger a non-blocking background sync and return immediately
    if (!user) {
      const subKey = payload.sub as string;
      if (!this.inflightSync.has(subKey)) {
        this.inflightSync.add(subKey);
        const supabaseUserForSync = { id: payload.sub, email: payload.email, ...payload };
        // Fire-and-forget sync to avoid blocking the request
        this.userSyncService
          .syncUserFromSupabase(supabaseUserForSync)
          .then(() => this.logger.debug(`Background sync completed for sub=${subKey}`))
          .catch((e) => this.logger.error(`Background user sync failed for ${subKey}: ${e?.message || e}`))
          .finally(() => this.inflightSync.delete(subKey));
      }
      throw new UnauthorizedException('User provisioning in progress. Please retry shortly.');
    }

    // The strategy now returns the basic user object. The controller will be
    // responsible for fetching the full, enriched context.
    // Cache the validated user for a short period to avoid repeated DB hits
    if (cacheKey) {
      this.validatedCache.set(cacheKey, { user, exp: Date.now() + this.cacheTtlMs });
    }
    return user;
  }
}
 