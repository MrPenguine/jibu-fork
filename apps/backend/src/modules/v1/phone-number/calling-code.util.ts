/**
 * E.164 calling-code → ISO 3166-1 alpha-2 country, for deriving `country`
 * from a bare phone number. Needed because neither Twilio's purchase nor
 * list-numbers response includes an iso_country field (confirmed against
 * Twilio's own API schema) — only the AvailablePhoneNumbers *search*
 * response does, and that's not always available (e.g. syncing numbers
 * bought outside this app). Not a full libphonenumber replacement — covers
 * the calling codes this platform actually deals with (East Africa +
 * common Twilio inventory markets), longest-prefix-first so multi-digit
 * codes (e.g. +254 Kenya) aren't shadowed by their single-digit region
 * code (+2xx Africa has no single-digit code, but +1 NANPA does need the
 * "default to US" fallback below).
 */
const CALLING_CODE_TO_COUNTRY: Array<[string, string]> = [
  ['+1', 'US'], // NANPA: US/CA/etc. share +1 — no reliable sub-split without a full area-code table
  ['+254', 'KE'],
  ['+255', 'TZ'],
  ['+256', 'UG'],
  ['+250', 'RW'],
  ['+251', 'ET'],
  ['+257', 'BI'],
  ['+211', 'SS'],
  ['+27', 'ZA'],
  ['+234', 'NG'],
  ['+233', 'GH'],
  ['+44', 'GB'],
  ['+33', 'FR'],
  ['+49', 'DE'],
  ['+34', 'ES'],
  ['+39', 'IT'],
  ['+31', 'NL'],
  ['+61', 'AU'],
  ['+91', 'IN'],
  ['+971', 'AE'],
  ['+966', 'SA'],
  ['+20', 'EG'],
];

/** Longest calling-code prefix match on an E.164 number; null if unrecognized. */
export function countryFromE164(phoneNumber: string): string | null {
  const sorted = [...CALLING_CODE_TO_COUNTRY].sort((a, b) => b[0].length - a[0].length);
  const match = sorted.find(([prefix]) => phoneNumber.startsWith(prefix));
  return match ? match[1] : null;
}
