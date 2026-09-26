import { Injectable, Logger, ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../../core/database/prisma.service';
import { ProviderCredentialsResolver } from '../../../core/provider-credentials/provider-credentials.resolver';
import { LiveKitService } from '../../livekit/livekit.service';
import { TwilioService } from './twilio.service';
import { ManualAddPhoneNumberDto, SipProvider } from './dto/phone-number.dto';
import { countryFromE164 } from './calling-code.util';
import {
  buildInboundTrunkOptions,
  buildOutboundTrunkOptions,
  resolveOutboundAddress,
} from './sip-provider.config';

interface ProviderCatalogEntry {
  provider: string;
  label: string;
  connected: boolean;
  liveSearch: boolean; // can browse/purchase-on-demand via a real API (Twilio) vs. manual-add only
}

@Injectable()
export class PhoneNumberService {
  private readonly logger = new Logger(PhoneNumberService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: ProviderCredentialsResolver,
    private readonly liveKit: LiveKitService,
    private readonly twilio: TwilioService,
  ) {}

  // ── Workspace-facing reads ────────────────────────────────────────────

  /** Numbers currently owned by a workspace. */
  async listOwned(workspaceId: string) {
    return this.prisma.phoneNumber.findMany({
      where: { workspaceId },
      include: { agent: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Unowned, already-pooled numbers (manual carriers) — not scoped to any
   * workspace, visible to any authenticated user browsing on behalf of any
   * workspace. Does not include Twilio's live search results — those are a
   * separate call (searchTwilio) since they don't exist as PhoneNumber rows
   * until purchased. */
  async browsePool(country?: string, provider?: string) {
    return this.prisma.phoneNumber.findMany({
      where: {
        workspaceId: null,
        status: 'active',
        ...(country ? { country } : {}),
        ...(provider ? { provider } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchTwilio(country: string, areaCode?: string) {
    return this.twilio.searchAvailableNumbers({ country, areaCode });
  }

  getProviderCatalog(): ProviderCatalogEntry[] {
    return [
      { provider: 'twilio', label: 'Twilio', connected: false, liveSearch: true },
      { provider: 'africastalking', label: "Africa's Talking", connected: false, liveSearch: false },
      { provider: 'safaricom_sip', label: 'Safaricom SIP', connected: false, liveSearch: false },
      { provider: 'airtel_sip', label: 'Airtel SIP', connected: false, liveSearch: false },
    ];
  }

  async getProviderCatalogWithStatus(): Promise<ProviderCatalogEntry[]> {
    const catalog = this.getProviderCatalog();
    return Promise.all(
      catalog.map(async (entry) => ({
        ...entry,
        connected: Boolean(await this.credentials.getSecret(entry.provider)),
      })),
    );
  }

  private async get(id: string) {
    const phoneNumber = await this.prisma.phoneNumber.findUnique({
      where: { id },
      include: { agent: { select: { id: true, name: true } } },
    });
    if (!phoneNumber) throw new NotFoundException('Phone number not found');
    return phoneNumber;
  }

  // ── Claim / release (the core marketplace mechanic) ──────────────────

  /**
   * Claim a number into a workspace. Two paths:
   *  - Already-pooled (manual-carrier) number: atomic compare-and-swap via
   *    `updateMany({ where: { id, workspaceId: null } })` — Postgres's
   *    row-level update is atomic, so a `count` of 0 means someone else
   *    claimed it first between listing and this call. No advisory lock
   *    needed for a single-row conditional update.
   *  - `twilioNumber` given, no existing row: live-purchases from Twilio
   *    right now (billed instantly to the platform's master account), then
   *    creates the PhoneNumber row already owned by this workspace — no
   *    unowned window exists for these at all.
   * Either path provisions the LiveKit trunk/dispatch rule the same way.
   */
  async claim(params: {
    phoneNumberId?: string;
    twilioNumber?: string;
    twilioCountry?: string;
    workspaceId: string;
    agentId?: string;
  }) {
    let phoneNumber: Awaited<ReturnType<PhoneNumberService['get']>>;

    if (params.twilioNumber) {
      if (!params.twilioCountry) {
        throw new BadRequestException('twilioCountry is required when claiming a Twilio search result');
      }
      phoneNumber = await this.purchaseAndClaimTwilioNumber(params.twilioNumber, params.twilioCountry, params.workspaceId);
    } else {
      if (!params.phoneNumberId) throw new BadRequestException('phoneNumberId or twilioNumber is required');
      const claimed = await this.prisma.phoneNumber.updateMany({
        where: { id: params.phoneNumberId, workspaceId: null },
        data: { workspaceId: params.workspaceId, claimedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new ConflictException('This number was just claimed by someone else — pick another one');
      }
      phoneNumber = await this.get(params.phoneNumberId);
      phoneNumber = await this.provisionTrunksIfMissing(phoneNumber);
    }

    if (params.agentId) {
      phoneNumber = await this.assignAgent(params.workspaceId, phoneNumber.id, params.agentId);
    }

    return phoneNumber;
  }

  private async purchaseAndClaimTwilioNumber(number: string, country: string, workspaceId: string) {
    const existing = await this.prisma.phoneNumber.findUnique({ where: { number } });
    if (existing) throw new ConflictException(`${number} is already provisioned`);

    const purchased = await this.twilio.purchaseNumber(number);
    await this.twilio.attachToSharedTrunk(purchased.sid);

    // Twilio's purchase response has no iso_country field — `country` here is
    // the caller-supplied value from the AvailablePhoneNumbers search result
    // that preceded this call, not anything read off `purchased`.
    let created: Awaited<ReturnType<PhoneNumberService['get']>>;
    try {
      created = await this.prisma.phoneNumber.create({
        data: {
          workspaceId,
          number: purchased.phoneNumber,
          country: country.toUpperCase(),
          provider: 'twilio',
          capabilities: ['voice'],
          claimedAt: new Date(),
        },
        include: { agent: { select: { id: true, name: true } } },
      });
    } catch (e) {
      // The Twilio purchase already succeeded and was billed — surface that
      // clearly rather than a generic 500, since the number is real and
      // owned on Twilio's side even though our own record failed to save.
      this.logger.error(
        `Twilio purchase of ${purchased.phoneNumber} (sid ${purchased.sid}) succeeded but saving the PhoneNumber row failed: ${(e as Error).message}`,
      );
      throw new BadRequestException(
        `${purchased.phoneNumber} was purchased from Twilio but could not be saved — contact an admin to register it manually (Twilio SID: ${purchased.sid})`,
      );
    }

    return this.provisionTrunksIfMissing(created);
  }

  /** Release a number back to the pool: clears ownership, tears down the
   * dispatch rule, keeps the LiveKit trunks (platform infrastructure now,
   * not workspace-owned — they persist across claim/release cycles). */
  async release(workspaceId: string, id: string) {
    const phoneNumber = await this.get(id);
    if (phoneNumber.workspaceId !== workspaceId) {
      throw new ForbiddenException('This number is not owned by your workspace');
    }
    return this.doRelease(phoneNumber);
  }

  /** Admin-only: reclaim a number regardless of who owns it (billing/abuse). */
  async forceRelease(id: string) {
    const phoneNumber = await this.get(id);
    return this.doRelease(phoneNumber);
  }

  private async doRelease(phoneNumber: Awaited<ReturnType<PhoneNumberService['get']>>) {
    if (phoneNumber.sipDispatchRuleId) {
      await this.liveKit.deleteDispatchRule(phoneNumber.sipDispatchRuleId).catch((e) =>
        this.logger.error(`Failed to delete dispatch rule on release: ${(e as Error).message}`),
      );
    }
    return this.prisma.phoneNumber.update({
      where: { id: phoneNumber.id },
      data: { workspaceId: null, agentId: null, sipDispatchRuleId: null, releasedAt: new Date() },
    });
  }

  // ── Agent assignment (unchanged from PR 3 — reused by claim()) ───────

  async assignAgent(workspaceId: string, id: string, agentId: string | null) {
    const phoneNumber = await this.get(id);
    if (phoneNumber.workspaceId !== workspaceId) {
      throw new ForbiddenException('This number is not owned by your workspace');
    }

    await this.prisma.phoneNumber.update({ where: { id: phoneNumber.id }, data: { agentId } });

    if (!agentId) {
      if (phoneNumber.sipDispatchRuleId) {
        await this.liveKit.deleteDispatchRule(phoneNumber.sipDispatchRuleId).catch((e) =>
          this.logger.error(`Failed to delete dispatch rule ${phoneNumber.sipDispatchRuleId}: ${(e as Error).message}`),
        );
        await this.prisma.phoneNumber.update({ where: { id: phoneNumber.id }, data: { sipDispatchRuleId: null } });
      }
      return this.get(id);
    }

    if (!phoneNumber.sipInboundTrunkId) {
      throw new BadRequestException('Phone number has no inbound trunk provisioned yet');
    }

    const roomName = `voice_sip_${phoneNumber.id}`;
    const roomMetadata = JSON.stringify({ agent_id: agentId, workspace_id: workspaceId, phone_number_id: phoneNumber.id });

    // Pre-seed the room's metadata now, at admin-action time — not on the
    // per-call critical path. The Python worker's existing room-metadata-
    // read-on-join logic (already proven for browser calls) then works for
    // SIP-originated calls with zero Python-side changes.
    await this.liveKit.seedRoomMetadata(roomName, roomMetadata);

    try {
      if (phoneNumber.sipDispatchRuleId) {
        await this.liveKit.deleteDispatchRule(phoneNumber.sipDispatchRuleId);
      }
      const rule = await this.liveKit.createDirectDispatchRule(phoneNumber.sipInboundTrunkId, roomName, roomMetadata);
      await this.prisma.phoneNumber.update({ where: { id: phoneNumber.id }, data: { sipDispatchRuleId: rule.sipDispatchRuleId } });
    } catch (e) {
      this.logger.error(`Failed to (re)create dispatch rule for phone number ${phoneNumber.id}: ${(e as Error).message}`);
    }

    return this.get(id);
  }

  // ── Admin: manual-add pooled numbers (Africa's Talking / Safaricom / Airtel) ──

  async adminManualAdd(dto: ManualAddPhoneNumberDto) {
    const existing = await this.prisma.phoneNumber.findUnique({ where: { number: dto.number } });
    if (existing) throw new ConflictException(`${dto.number} is already provisioned`);

    const created = await this.prisma.phoneNumber.create({
      data: {
        workspaceId: null,
        number: dto.number,
        country: dto.country,
        provider: dto.provider,
        capabilities: dto.capabilities || ['voice'],
        providerConfig: dto.providerConfig as any,
      },
    });

    return this.provisionTrunksIfMissing(created);
  }

  async adminList() {
    return this.prisma.phoneNumber.findMany({
      include: {
        workspace: { select: { id: true, name: true } },
        agent: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Twilio sync — catches numbers the DB doesn't know about yet ───────

  /**
   * Reconciles our PhoneNumber table against what's actually on the
   * platform's Twilio account. Handles two cases without any manual admin
   * form-filling:
   *  - A number bought directly in the Twilio console (outside this app).
   *  - A number purchaseAndClaimTwilioNumber() bought successfully but then
   *    failed to save locally (Twilio billing isn't transactional with our
   *    DB) — previously required an admin to manually re-add it; this now
   *    picks it up automatically on the next sync.
   * New numbers land unowned in the pool (workspaceId: null), same as a
   * manual-add — sync never assigns ownership, since Twilio has no concept
   * of "which workspace wanted this."
   */
  async syncTwilioNumbers(): Promise<{ added: string[]; skipped: boolean }> {
    const connected = Boolean(await this.credentials.getSecret('twilio'));
    if (!connected) return { added: [], skipped: true };

    const accountNumbers = await this.twilio.listAccountNumbers();
    const existing = await this.prisma.phoneNumber.findMany({
      where: { number: { in: accountNumbers.map((n) => n.phoneNumber) } },
      select: { number: true },
    });
    const existingSet = new Set(existing.map((n) => n.number));
    const missing = accountNumbers.filter((n) => !existingSet.has(n.phoneNumber));

    const added: string[] = [];
    for (const n of missing) {
      const country = countryFromE164(n.phoneNumber) || 'XX'; // XX = unrecognized calling code, not a real ISO country
      const capabilities = Object.entries(n.capabilities)
        .filter(([, v]) => v)
        .map(([k]) => k);
      try {
        const created = await this.prisma.phoneNumber.create({
          data: {
            workspaceId: null,
            number: n.phoneNumber,
            country,
            provider: 'twilio',
            capabilities: capabilities.length ? capabilities : ['voice'],
          },
          include: { agent: { select: { id: true, name: true } } },
        });
        await this.twilio.attachToSharedTrunk(n.sid);
        await this.provisionTrunksIfMissing(created);
        added.push(n.phoneNumber);
      } catch (e) {
        this.logger.error(`Failed to sync Twilio number ${n.phoneNumber} into the pool: ${(e as Error).message}`);
      }
    }

    return { added, skipped: false };
  }

  /** Runs every 10 minutes so a manually-purchased or save-failed Twilio
   * number never needs a human to notice and re-add it by hand. */
  @Interval(600_000)
  private async scheduledTwilioSync() {
    try {
      const result = await this.syncTwilioNumbers();
      if (result.added.length) {
        this.logger.log(`Twilio sync added ${result.added.length} number(s) to the pool: ${result.added.join(', ')}`);
      }
    } catch (e) {
      this.logger.error(`Scheduled Twilio sync failed: ${(e as Error).message}`);
    }
  }

  // ── LiveKit provisioning (unchanged shape from PR 3) ──────────────────

  private async provisionTrunksIfMissing(phoneNumber: { id: string; number: string; provider: string; providerConfig: unknown; sipInboundTrunkId?: string | null }) {
    if (phoneNumber.sipInboundTrunkId) return this.get(phoneNumber.id);

    const provider = phoneNumber.provider as SipProvider;
    const providerConfig = phoneNumber.providerConfig as Record<string, unknown> | undefined;
    const secret = await this.credentials.getSecret(provider);
    const [authUsername, authPassword] = provider === 'twilio' && secret ? secret.split(':') : [undefined, undefined];
    const metadata = JSON.stringify({ provider });

    let sipInboundTrunkId: string | undefined;
    let sipOutboundTrunkId: string | undefined;

    try {
      // No authUsername/authPassword on the inbound side: Twilio's
      // Origination (PSTN → your SIP infra) has no mechanism to respond to a
      // SIP digest challenge — that's a Termination-only feature. Setting
      // credentials here would make LiveKit challenge every inbound INVITE
      // for an answer Twilio can never give, and the call would just 401.
      // The number allowlist passed below (this trunk only accepts calls
      // for this specific E.164 number) is the real security boundary for
      // inbound, same as it would be for any IP-based-origination carrier.
      const inbound = await this.liveKit.createInboundTrunk(
        `${provider}-${phoneNumber.number}`,
        [phoneNumber.number],
        buildInboundTrunkOptions(provider, providerConfig, undefined, undefined, metadata),
      );
      sipInboundTrunkId = inbound.sipTrunkId;
    } catch (e) {
      this.logger.error(`Failed to create inbound trunk for ${phoneNumber.number}: ${(e as Error).message}`);
      await this.prisma.phoneNumber.update({ where: { id: phoneNumber.id }, data: { status: 'provisioning_partial' } });
      return this.get(phoneNumber.id);
    }

    try {
      const outboundAddress = resolveOutboundAddress(provider, providerConfig);
      const outbound = await this.liveKit.createOutboundTrunk(
        `${provider}-${phoneNumber.number}-out`,
        outboundAddress,
        [phoneNumber.number],
        buildOutboundTrunkOptions(provider, providerConfig, authUsername, authPassword, metadata),
      );
      sipOutboundTrunkId = outbound.sipTrunkId;
    } catch (e) {
      this.logger.error(`Failed to create outbound trunk for ${phoneNumber.number}: ${(e as Error).message}`);
      await this.prisma.phoneNumber.update({
        where: { id: phoneNumber.id },
        data: { sipInboundTrunkId, status: 'provisioning_partial' },
      });
      return this.get(phoneNumber.id);
    }

    await this.prisma.phoneNumber.update({
      where: { id: phoneNumber.id },
      data: { sipInboundTrunkId, sipOutboundTrunkId, status: 'active' },
    });
    return this.get(phoneNumber.id);
  }

  async retryProvisioning(id: string) {
    const phoneNumber = await this.get(id);
    if (phoneNumber.status !== 'provisioning_partial') {
      throw new BadRequestException('Phone number is not in a partial-provisioning state');
    }
    return this.provisionTrunksIfMissing(phoneNumber);
  }
}
