import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { MemoryService } from '../../../core/memory/memory.service';
import { ContactService, type ContactChannel } from '../../../core/contact/contact.service';

export interface ContactListOptions {
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Workspace-scoped Contact browsing for the new "Contacts" dashboard page —
 * unified call/chat history and mem0 memory state for a resolved end-customer
 * identity (Contact, see core/contact/contact.service.ts). Always
 * workspace-filtered; a Contact never crosses tenants.
 */
@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memory: MemoryService,
    private readonly contactService: ContactService,
  ) {}

  /** Thin wrapper over the shared ContactService.resolve — lets the
   * floating agent tester (and any other caller) name/create a test
   * persona directly, not just resolve one implicitly from a chat/call. */
  async createOrUpdate(workspaceId: string, externalId: string, channel: ContactChannel, displayName?: string) {
    return this.contactService.resolve(workspaceId, externalId, channel, displayName);
  }

  async list(workspaceId: string, opts: ContactListOptions = {}) {
    const page = opts.page && opts.page > 0 ? opts.page : 1;
    const pageSize = opts.pageSize && opts.pageSize > 0 ? Math.min(opts.pageSize, 100) : 20;

    const where: Record<string, unknown> = { workspaceId };
    if (opts.search) {
      where.OR = [
        { externalId: { contains: opts.search, mode: 'insensitive' } },
        { displayName: { contains: opts.search, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.contact.count({ where }),
    ]);

    return { contacts, total, page, pageSize };
  }

  /** Unified timeline merging this contact's Call[] and Chat[] rows by
   * timestamp — sorted newest first, matching the list's own ordering. */
  async getDetail(workspaceId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, workspaceId },
      include: {
        calls: { orderBy: { createdAt: 'desc' }, take: 50 },
        chats: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!contact) return null;

    const { calls, chats, ...rest } = contact;
    const timeline = [
      ...calls.map((c) => ({
        type: 'call' as const,
        id: c.id,
        at: (c.startedAt ?? c.createdAt).toISOString(),
        status: c.status,
        disconnectReason: c.disconnectReason,
      })),
      ...chats.map((c) => ({
        type: 'chat' as const,
        id: c.id,
        at: c.createdAt.toISOString(),
        status: c.status,
        disconnectReason: c.disconnectReason,
      })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1));

    return { ...rest, timeline };
  }

  /** Returns null when the contact doesn't exist (or isn't in this
   * workspace) so the controller can 404/400 rather than leak another
   * tenant's memories via a raw contactId. */
  async getMemories(workspaceId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, workspaceId }, select: { id: true } });
    if (!contact) return null;
    return this.memory.listAll(workspaceId, contactId);
  }
}
