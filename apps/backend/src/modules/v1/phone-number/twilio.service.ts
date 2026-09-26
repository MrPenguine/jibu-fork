import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { ProviderCredentialsResolver } from '../../../core/provider-credentials/provider-credentials.resolver';

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

export interface AvailableTwilioNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string | null;
  region: string | null;
  isoCountry: string;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
}

export interface PurchasedTwilioNumber {
  sid: string;
  phoneNumber: string;
}

export interface OwnedTwilioNumber {
  sid: string;
  phoneNumber: string;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
}

/**
 * Thin wrapper over Twilio's REST API, using the platform's single master
 * account (credentials from ProviderCredentialsResolver, not per-workspace —
 * see provider-registry.ts's "twilio" entry for why they're stored as one
 * combined "accountSid:authToken" string). Raw axios + Basic Auth, matching
 * every other provider in this codebase — no vendor SDK, since only a
 * handful of calls are needed (search, purchase, fetch-for-health-check).
 */
@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);

  constructor(private readonly credentials: ProviderCredentialsResolver) {}

  private async getAuth(): Promise<{ accountSid: string; authToken: string }> {
    const secret = await this.credentials.getSecret('twilio');
    if (!secret) {
      throw new ServiceUnavailableException('Twilio is not configured — a platform admin must add credentials first');
    }
    const [accountSid, authToken] = secret.split(':');
    if (!accountSid || !authToken) {
      throw new ServiceUnavailableException('Twilio credentials are malformed — expected "accountSid:authToken"');
    }
    return { accountSid, authToken };
  }

  /** GET /AvailablePhoneNumbers/{country}/Local — numbers not yet owned by anyone. */
  async searchAvailableNumbers(params: {
    country: string; // ISO 3166-1 alpha-2, e.g. "US"
    areaCode?: string;
    contains?: string;
    limit?: number;
  }): Promise<AvailableTwilioNumber[]> {
    const { accountSid, authToken } = await this.getAuth();
    const country = params.country.toUpperCase();
    try {
      const res = await axios.get(`${TWILIO_API_BASE}/Accounts/${accountSid}/AvailablePhoneNumbers/${country}/Local.json`, {
        auth: { username: accountSid, password: authToken },
        params: {
          AreaCode: params.areaCode,
          Contains: params.contains,
          VoiceEnabled: true,
          PageSize: params.limit || 20,
        },
        timeout: 10_000,
      });
      return (res.data?.available_phone_numbers || []).map((n: any) => ({
        phoneNumber: n.phone_number,
        friendlyName: n.friendly_name,
        locality: n.locality || null,
        region: n.region || null,
        isoCountry: n.iso_country,
        capabilities: {
          voice: Boolean(n.capabilities?.voice),
          sms: Boolean(n.capabilities?.SMS ?? n.capabilities?.sms),
          mms: Boolean(n.capabilities?.MMS ?? n.capabilities?.mms),
        },
      }));
    } catch (e) {
      this.logger.error(`Twilio available-numbers search failed for ${country}: ${(e as Error).message}`);
      throw new BadRequestException(
        `Could not search Twilio numbers for ${country} — Twilio may not offer self-serve local numbers there`,
      );
    }
  }

  /**
   * POST /IncomingPhoneNumbers — the actual purchase. Billed instantly and
   * fully (not prorated) to the master account the moment this succeeds —
   * this is why the claim flow calls this only when a workspace has
   * genuinely committed to claiming the number, never speculatively.
   *
   * Twilio's create-number response does NOT include an iso_country field
   * (confirmed against Twilio's own API schema — it's present on the
   * AvailablePhoneNumbers *search* response only). Callers must pass the
   * country they already know from the search step; don't try to read it
   * off this response.
   */
  async purchaseNumber(phoneNumber: string): Promise<PurchasedTwilioNumber> {
    const { accountSid, authToken } = await this.getAuth();
    try {
      const res = await axios.post(
        `${TWILIO_API_BASE}/Accounts/${accountSid}/IncomingPhoneNumbers.json`,
        new URLSearchParams({ PhoneNumber: phoneNumber }),
        { auth: { username: accountSid, password: authToken }, timeout: 15_000 },
      );
      return { sid: res.data.sid, phoneNumber: res.data.phone_number };
    } catch (e) {
      const detail = (e as any)?.response?.data?.message || (e as Error).message;
      this.logger.error(`Twilio number purchase failed for ${phoneNumber}: ${detail}`);
      throw new BadRequestException(`Failed to purchase ${phoneNumber} from Twilio: ${detail}`);
    }
  }

  /**
   * GET /IncomingPhoneNumbers — every number actually owned on the master
   * account right now, paginated. This is the source of truth used to sync
   * numbers into the pool: it catches numbers purchased directly in the
   * Twilio console, or ones a prior purchase-and-claim call bought on
   * Twilio's side but then failed to save locally (Twilio billing isn't
   * transactional with our own database — see purchaseAndClaimTwilioNumber's
   * error handling in PhoneNumberService).
   */
  async listAccountNumbers(): Promise<OwnedTwilioNumber[]> {
    const { accountSid, authToken } = await this.getAuth();
    const results: OwnedTwilioNumber[] = [];
    let url: string | null = `${TWILIO_API_BASE}/Accounts/${accountSid}/IncomingPhoneNumbers.json`;
    let params: Record<string, unknown> | undefined = { PageSize: 100 };

    while (url) {
      try {
        const res: any = await axios.get(url, { auth: { username: accountSid, password: authToken }, params, timeout: 15_000 });
        for (const n of res.data?.incoming_phone_numbers || []) {
          results.push({
            sid: n.sid,
            phoneNumber: n.phone_number,
            capabilities: {
              voice: Boolean(n.capabilities?.voice),
              sms: Boolean(n.capabilities?.SMS ?? n.capabilities?.sms),
              mms: Boolean(n.capabilities?.MMS ?? n.capabilities?.mms),
            },
          });
        }
        url = res.data?.next_page_uri ? `https://api.twilio.com${res.data.next_page_uri}` : null;
        params = undefined; // next_page_uri already carries its own query params
      } catch (e) {
        this.logger.error(`Failed to list Twilio account numbers: ${(e as Error).message}`);
        throw new BadRequestException(`Could not list numbers from Twilio: ${(e as Error).message}`);
      }
    }

    return results;
  }

  /** Attach a purchased number to the platform's single shared Elastic SIP
   * Trunk (all pool numbers share one Twilio-side trunk — confirmed
   * supported via trunk_sid reassignment, no per-number trunk needed on
   * Twilio's side). trunkSid comes from TWILIO_SHARED_TRUNK_SID — set once,
   * manually, when the platform's shared trunk is created (trunk creation
   * itself is a one-time admin setup action, not automated here). */
  async attachToSharedTrunk(numberSid: string): Promise<void> {
    const trunkSid = process.env.TWILIO_SHARED_TRUNK_SID;
    if (!trunkSid) {
      this.logger.warn('TWILIO_SHARED_TRUNK_SID is not set — purchased number will not route calls until attached manually');
      return;
    }
    const { accountSid, authToken } = await this.getAuth();
    try {
      await axios.post(
        `${TWILIO_API_BASE}/Accounts/${accountSid}/IncomingPhoneNumbers/${numberSid}.json`,
        new URLSearchParams({ TrunkSid: trunkSid }),
        { auth: { username: accountSid, password: authToken }, timeout: 10_000 },
      );
    } catch (e) {
      this.logger.error(`Failed to attach ${numberSid} to shared trunk ${trunkSid}: ${(e as Error).message}`);
      // Not fatal to the claim — the number is purchased and owned either
      // way; routing can be reattached manually if this one call failed.
    }
  }
}
