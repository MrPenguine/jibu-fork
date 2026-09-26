import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export type ContactChannel = 'phone' | 'whatsapp' | 'widget';

/**
 * Find-or-create a Contact for a caller/chatter identity. Used by both the
 * voice path (Call.contactId, keyed off the SIP caller number) and WhatsApp
 * (Chat.contactId, keyed off the sender's WhatsApp number) — the two
 * channels that already carry a stable phone-number identity today. An
 * authenticated web-widget user id would use channel "widget" the same way;
 * an anonymous browser session has no resolvable identity and should never
 * call this — stays contact-less, not fabricated (see PhoneNumberService /
 * WhatsAppService callers for that check).
 */
@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Normalizes to a single leading "+" — matches the convention already
   * used for WhatsApp session ids (`whatsapp:+254...`). */
  normalizeExternalId(raw: string): string {
    return `+${raw.trim().replace(/^\+/, '')}`;
  }

  /** displayName is optional — when given (e.g. naming a test persona
   * "Riley"), it's set on both create and update; existing real-caller call
   * sites (voice/WhatsApp) never pass it, so their upserts stay update: {}
   * exactly as before. */
  async resolve(workspaceId: string, externalId: string, channel: ContactChannel, displayName?: string) {
    const normalized = this.normalizeExternalId(externalId);
    try {
      return await this.prisma.contact.upsert({
        where: { workspaceId_externalId: { workspaceId, externalId: normalized } },
        update: displayName ? { displayName } : {},
        create: { workspaceId, externalId: normalized, channel, displayName },
      });
    } catch (e) {
      this.logger.error(`Failed to resolve Contact for ${normalized}: ${(e as Error).message}`);
      return null;
    }
  }
}
