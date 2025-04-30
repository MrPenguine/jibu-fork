import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
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

    // Return user information from the token
    // This will be attached to the request object
    return {
      id: payload.sub,
      email: payload.email,
      // Add any additional claims from the token that you need
      // You can also fetch additional user data from your database here
    };
  }
} 