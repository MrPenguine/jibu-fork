import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, Matches, IsObject } from 'class-validator';

export const SIP_PROVIDERS = ['twilio', 'africastalking', 'safaricom_sip', 'airtel_sip'] as const;
export type SipProvider = (typeof SIP_PROVIDERS)[number];

// E.164: + followed by 8-15 digits.
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/** Admin-only: register an already-acquired manual-carrier number (Africa's
 * Talking/Safaricom/Airtel) into the pool. There is no live purchase for
 * these — the platform's relationship with the carrier is established
 * outside this system, this just records the result of that. */
export class ManualAddPhoneNumberDto {
  @IsString()
  @Matches(E164_PATTERN, { message: 'number must be E.164 format, e.g. +254700123456' })
  number: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsEnum(SIP_PROVIDERS)
  provider: SipProvider;

  @IsOptional()
  @IsArray()
  capabilities?: string[];

  // Non-secret only (transport, SIP address, IP allowlist). Auth creds are
  // platform-level (provider-credentials/Vault), not stored per-number.
  @IsOptional()
  @IsObject()
  providerConfig?: Record<string, unknown>;
}

/** Workspace-facing: claim a number from the pool. For an already-pooled
 * (manual-carrier) number this is an atomic ownership transfer; for a
 * not-yet-purchased Twilio search result, this triggers the live purchase
 * first. See PhoneNumberService.claim(). */
export class ClaimPhoneNumberDto {
  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  // Set when claiming a live Twilio search result that has no PhoneNumber
  // row yet — omitted when claiming an already-pooled manual-carrier number.
  @IsOptional()
  @IsString()
  twilioNumber?: string;

  // Required alongside twilioNumber: Twilio's purchase response has no
  // iso_country field, so the country the frontend already saw in the
  // search result must be carried through here instead.
  @IsOptional()
  @IsString()
  twilioCountry?: string;

  @IsOptional()
  @IsString()
  agentId?: string;
}

export class AssignAgentDto {
  @IsOptional()
  @IsString()
  agentId?: string | null;
}
