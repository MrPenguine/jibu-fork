// Central registry for provider -> node type, credential key, model param key, and allowed model IDs
// Used by the orchestrator compiler/mapping to produce n8n-compatible nodes

export type ProviderKey = 'openai' | 'anthropic' | 'google';

export interface ProviderConfig {
  provider: ProviderKey;
  nodeType: string; // n8n node type
  modelParamKey: string; // e.g., 'model' | 'modelName'
  credentialKey: string; // e.g., 'openAiApi' | 'anthropicApi' | 'googlePalmApi'
  credentialUiName: string; // friendly name displayed in n8n UI
  models: string[]; // exact model IDs supported
}

export const PROVIDERS: Record<ProviderKey, ProviderConfig> = {
  openai: {
    provider: 'openai',
    nodeType: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
    modelParamKey: 'model',
    credentialKey: 'openAiApi',
    credentialUiName: 'OpenAi account',
    models: [
      'gpt-3.5-turbo',
      'gpt-4',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'gpt-5',
      'gpt-5-nano-2025-08-07',
      'o3-mini',
      'o1-mini',
    ],
  },
  anthropic: {
    provider: 'anthropic',
    nodeType: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
    modelParamKey: 'model',
    credentialKey: 'anthropicApi',
    credentialUiName: 'Anthropic account',
    models: [
      'claude-opus-4-1-20250805',
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
    ],
  },
  google: {
    provider: 'google',
    nodeType: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
    modelParamKey: 'modelName',
    credentialKey: 'googlePalmApi',
    credentialUiName: 'Google Gemini(PaLM) Api account',
    models: [
      // In many examples Gemini can be omitted to use defaults, but we support explicit IDs below
      'models/gemini-2.5-pro',
      'models/gemini-2.5-flash',
      'models/gemini-1.5-flash',
    ],
  },
};

export function getProviderConfig(provider: string): ProviderConfig | undefined {
  const key = provider?.toLowerCase() as ProviderKey;
  return PROVIDERS[key];
}

export function isSupportedModel(provider: string, model: string): boolean {
  const cfg = getProviderConfig(provider);
  if (!cfg) return false;
  return cfg.models.includes(model);
}
