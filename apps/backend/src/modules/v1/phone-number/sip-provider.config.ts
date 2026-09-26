import { SIPTransport } from '@livekit/protocol';
import type { CreateSipInboundTrunkOptions, CreateSipOutboundTrunkOptions } from 'livekit-server-sdk';
import type { SipProvider } from './dto/phone-number.dto';

/**
 * Per-provider mapping into LiveKit's trunk-creation options. Adding a 5th
 * SIP provider means adding one entry here, not a migration — auth/address
 * shape genuinely differs per provider (Twilio/Africa's Talking authenticate
 * with username+password against a SIP domain; Safaricom/Airtel-style
 * carrier-direct trunks are more likely to authenticate by source-IP
 * allowlist), which is why PhoneNumber.providerConfig is a Json field rather
 * than fixed columns.
 *
 * Exact transport/address values below are placeholders pending each
 * provider's real SIP trunking docs — verify before using in production.
 */
export interface ProviderTrunkDefaults {
  transport: SIPTransport;
  outboundAddress: (config: Record<string, unknown>) => string;
}

export const PROVIDER_DEFAULTS: Record<SipProvider, ProviderTrunkDefaults> = {
  twilio: {
    transport: SIPTransport.SIP_TRANSPORT_TLS,
    outboundAddress: (config) => (config.sipDomain as string) || 'sip.twilio.com',
  },
  africastalking: {
    transport: SIPTransport.SIP_TRANSPORT_UDP,
    outboundAddress: (config) => (config.sipDomain as string) || 'sip.africastalking.com',
  },
  safaricom_sip: {
    transport: SIPTransport.SIP_TRANSPORT_UDP,
    outboundAddress: (config) => config.sipDomain as string,
  },
  airtel_sip: {
    transport: SIPTransport.SIP_TRANSPORT_UDP,
    outboundAddress: (config) => config.sipDomain as string,
  },
};

export function buildInboundTrunkOptions(
  provider: SipProvider,
  providerConfig: Record<string, unknown> | undefined,
  authUsername: string | undefined,
  authPassword: string | undefined,
  metadata: string,
): CreateSipInboundTrunkOptions {
  const config = providerConfig || {};
  return {
    authUsername,
    authPassword,
    allowedAddresses: config.allowedAddresses as string[] | undefined,
    metadata,
  };
}

export function buildOutboundTrunkOptions(
  provider: SipProvider,
  providerConfig: Record<string, unknown> | undefined,
  authUsername: string | undefined,
  authPassword: string | undefined,
  metadata: string,
): CreateSipOutboundTrunkOptions {
  const config = providerConfig || {};
  return {
    transport: (config.transport as SIPTransport) ?? PROVIDER_DEFAULTS[provider].transport,
    authUsername,
    authPassword,
    metadata,
  };
}

export function resolveOutboundAddress(provider: SipProvider, providerConfig: Record<string, unknown> | undefined): string {
  const address = PROVIDER_DEFAULTS[provider].outboundAddress(providerConfig || {});
  if (!address) {
    throw new Error(`No SIP outbound address configured for provider "${provider}" — set providerConfig.sipDomain`);
  }
  return address;
}
