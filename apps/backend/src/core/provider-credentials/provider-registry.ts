import axios, { AxiosRequestConfig } from 'axios';

export type ProviderTestStatus = 'ok' | 'error' | 'unsupported';

export interface ProviderDefinition {
  key: string;
  label: string;
  envVars: string[];
  test?: (secret: string) => Promise<void>;
}

const request = async (url: string, config: AxiosRequestConfig = {}) => {
  const response = await axios.get(url, {
    ...config,
    timeout: 10_000,
    validateStatus: () => true,
  });

  if (response.status < 200 || response.status >= 300) {
    const error = new Error(`Provider request failed (${response.status})`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
};

export const PROVIDER_REGISTRY: readonly ProviderDefinition[] = [
  {
    key: 'gemini',
    label: 'Google Gemini',
    envVars: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    test: (secret) =>
      request('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: { 'x-goog-api-key': secret },
      }),
  },
  {
    key: 'openrouter',
    label: 'OpenRouter',
    envVars: ['OPENROUTER_API_KEY'],
    test: (secret) => request('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${secret}` } }),
  },
  {
    key: 'elevenlabs',
    label: 'ElevenLabs',
    envVars: ['ELEVENLABS_API_KEY'],
    test: (secret) => request('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': secret } }),
  },
  {
    key: 'xai',
    label: 'xAI',
    envVars: ['XAI_API_KEY'],
    test: (secret) => request('https://api.x.ai/v1/models', { headers: { Authorization: `Bearer ${secret}` } }),
  },
  {
    key: 'mistral',
    label: 'Mistral',
    envVars: ['MISTRAL_API_KEY'],
    test: (secret) => request('https://api.mistral.ai/v1/models', { headers: { Authorization: `Bearer ${secret}` } }),
  },
  {
    key: 'deepgram',
    label: 'Deepgram',
    envVars: ['DEEPGRAM_API_KEY'],
    test: (secret) => request('https://api.deepgram.com/v1/projects', { headers: { Authorization: `Token ${secret}` } }),
  },
  {
    key: 'azureSpeech',
    label: 'Azure Speech',
    envVars: [
      'AZURE_RESOURCE_KEY',
      'AZURE_REGION',
      'AZURE_RESOURCE_ENDPOINT',
      'AZURE_SPEECH_TO_TEXT_ENDPOINT',
      'AZURE_TEXT_TO_SPEECH_ENDPOINT',
    ],
  },
  {
    key: 'playht',
    label: 'PlayHT',
    envVars: ['PLAYHT_API_KEY', 'PLAYHT_USER_ID'],
  },
  {
    key: 'n8n',
    label: 'n8n',
    envVars: ['N8N_API_KEY'],
  },
  {
    // Two-field credential (Account SID + Auth Token) stored as a single
    // "accountSid:authToken" string — this registry's storage shape is a
    // single secret string, and the Account SID isn't sensitive on its own
    // (only the Auth Token is), so a combined string avoids touching the
    // shared single-secret storage/CRUD used by every other provider here
    // for the sake of one provider's two-field need. See
    // phone-number/twilio.service.ts for the split.
    key: 'twilio',
    label: 'Twilio (phone number pool)',
    // No env-var fallback: ProviderCredentialsResolver's generic fallback
    // returns the first env var that's set, which can't correctly assemble
    // a combined "sid:token" from two separate env vars — must be set via
    // the admin credentials UI (Vault-backed) instead.
    envVars: [],
    test: async (secret) => {
      const [accountSid, authToken] = secret.split(':');
      if (!accountSid || !authToken) {
        throw new Error('Expected "accountSid:authToken"');
      }
      await request(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
        auth: { username: accountSid, password: authToken },
      });
    },
  },
  {
    // No self-serve API exists for these — the platform's relationship with
    // each carrier is a manual process (KYC documents, IP whitelisting via
    // their support team). This entry just gives admins a place to record
    // that the relationship exists; there's deliberately no `test` function
    // since there's nothing to call.
    key: 'africastalking',
    label: "Africa's Talking (manual)",
    envVars: [],
  },
  {
    key: 'safaricom_sip',
    label: 'Safaricom SIP (manual)',
    envVars: [],
  },
  {
    key: 'airtel_sip',
    label: 'Airtel SIP (manual)',
    envVars: [],
  },
];

export function getProviderDefinition(provider: string): ProviderDefinition | undefined {
  return PROVIDER_REGISTRY.find((definition) => definition.key === provider);
}
