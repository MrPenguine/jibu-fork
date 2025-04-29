import { Injectable, CanActivate, ExecutionContext, Logger, UnauthorizedException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class SupabaseWebhookGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseWebhookGuard.name);

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
    const signature = request.headers['webhook-signature'] as string;
    const timestamp = request.headers['webhook-timestamp'] as string;
    const rawBody = request.rawBody;

    if (!rawBody) {
      this.logger.error('Raw body is not available. Ensure rawBody: true is set in NestFactory.create.');
      throw new UnauthorizedException('Internal server error: Raw body missing for webhook verification');
    }

    if (!signature || !timestamp) {
        this.logger.warn('Request missing signature or timestamp headers');
        // Allow in non-production if verification is explicitly disabled
        if (process.env.NODE_ENV !== 'production' || process.env.DISABLE_WEBHOOK_VERIFICATION === 'true') {
            this.logger.warn('Allowing webhook request without signature/timestamp in non-production or when verification disabled.');
            return true;
        }
        throw new UnauthorizedException('Missing webhook signature or timestamp headers');
    }

    // Optional: Bypass verification in development/testing if needed
    if (process.env.DISABLE_WEBHOOK_VERIFICATION === 'true') {
      this.logger.warn('Webhook verification explicitly disabled via environment variable.');
      return true;
    }

    try {
      this.verifySignature(rawBody, signature, timestamp);
      this.logger.log('Webhook signature verified successfully.');
      return true;
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      throw new UnauthorizedException(`Invalid webhook signature: ${error.message}`);
    }
  }

  private verifySignature(rawBody: Buffer, signature: string, timestamp: string): void {
    const webhookSecret = this.configService.get<string>('SUPABASE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      this.logger.error('SUPABASE_WEBHOOK_SECRET not configured. Cannot verify webhook signature.');
      // Depending on policy, you might allow or deny here. Denying is safer.
      throw new UnauthorizedException('Webhook secret not configured on server.');
    }

    try {
        // Supabase typically uses 'v1=<signature>' format
        const signatureParts = signature.split('=');
        if (signatureParts.length !== 2 || signatureParts[0] !== 'v1') {
            this.logger.error(`Invalid signature format: ${signature}`);
            throw new Error('Invalid signature format');
        }
        const receivedSignatureHex = signatureParts[1]; // Supabase uses hex

        const hmac = crypto.createHmac('sha256', webhookSecret);
        // IMPORTANT: Supabase uses timestamp + '.' + rawBody
        const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
        hmac.update(signedPayload);
        const computedSignatureHex = hmac.digest('hex');

        this.logger.debug(`Received Signature: ${receivedSignatureHex}`);
        this.logger.debug(`Computed Signature: ${computedSignatureHex}`);

        const expectedBuffer = Buffer.from(computedSignatureHex, 'hex');
        const receivedBuffer = Buffer.from(receivedSignatureHex, 'hex');

        if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
            throw new Error('Signature mismatch');
        }
    } catch (error) {
        this.logger.error(`Signature verification calculation error: ${error.message}`);
        throw new UnauthorizedException(`Signature verification failed: ${error.message}`);
    }
  }
}