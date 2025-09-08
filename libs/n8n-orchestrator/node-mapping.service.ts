import { compileTemplate, withNodeMeta } from './template-compiler.service';
import { PROVIDERS, getProviderConfig } from './model-name-registry';
import { compileGraphToN8n } from './graph-compiler.service';
import { AdapterRegistry, buildDefaultAdapterRegistry, InternalGraph, CompileContext } from './adapter-registry';
import { WebhookTemplate } from './templates/webhook.template';
import { AiAgentTemplate } from './templates/ai-agent.template';
import { GoogleGeminiChatModelTemplate } from './templates/google-gemini.template';
import { AnthropicChatModelTemplate } from './templates/anthropic.template';
import { OpenAiChatModelTemplate } from './templates/openai.template';

export interface AssistantConfig {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  systemPrompt?: string;
}

/**
 * Universal entrypoint: compile any internal graph (nodes/edges) to n8n JSON using adapters.
 * This avoids hardcoding flows. For MVP, we can enable synthesis of Assistant/Provider nodes
 * when the input graph only contains START.
 */
export function compileFromInternalGraph(
  graph: InternalGraph,
  ctx: CompileContext,
  registry?: AdapterRegistry,
): MappingOutput {
  const wf = compileGraphToN8n(graph, ctx, { synthesizeAssistantAndProvider: true }, registry ?? buildDefaultAdapterRegistry());
  return wf as unknown as MappingOutput;
}

export interface WebhookConfig {
  path: string;
  id: string;
}

export interface CredentialRef {
  id: string;
  name: string;
}

export interface ProviderCredentials {
  openai?: CredentialRef;
  anthropic?: CredentialRef;
  google?: CredentialRef;
}

export interface MappingInput {
  workflowName: string;
  webhook: WebhookConfig;
  assistant: AssistantConfig;
  credentials: ProviderCredentials; // supply the matching provider credential for selected provider
}

export interface MappingOutput {
  name: string;
  nodes: any[];
  connections: Record<string, any>;
  settings: Record<string, any>;
  active: boolean;
  pinData?: Record<string, any>;
  versionId?: string;
  meta?: Record<string, any>;
}

function selectProviderTemplate(provider: AssistantConfig['provider']) {
  switch (provider) {
    case 'google':
      return GoogleGeminiChatModelTemplate;
    case 'anthropic':
      return AnthropicChatModelTemplate;
    case 'openai':
    default:
      return OpenAiChatModelTemplate;
  }
}

function getProviderCredential(provider: AssistantConfig['provider'], creds: ProviderCredentials): CredentialRef | undefined {
  if (provider === 'google') return creds.google;
  if (provider === 'anthropic') return creds.anthropic;
  if (provider === 'openai') return creds.openai;
  return undefined;
}

export function mapWorkflowToN8n(input: MappingInput): MappingOutput {
  const { assistant, webhook, credentials } = input;

  const providerCfg = getProviderConfig(assistant.provider);
  if (!providerCfg) {
    throw new Error(`Unsupported provider: ${assistant.provider}`);
  }
  if (!providerCfg.models.includes(assistant.model)) {
    // allow proceeding but warn via throw for now
    // In production, consider normalizing/aliasing instead of throwing
    throw new Error(`Model '${assistant.model}' is not in the supported list for provider '${assistant.provider}'.`);
  }

  const cred = getProviderCredential(assistant.provider, credentials);
  if (!cred) {
    throw new Error(`Missing credential reference for provider '${assistant.provider}'.`);
  }

  // 1) Build Webhook (Start) node
  const webhookNodeBase = compileTemplate<any>(WebhookTemplate, {
    WEBHOOK_PATH: webhook.path,
    WEBHOOK_ID: webhook.id,
  });
  const webhookNode = withNodeMeta(webhookNodeBase, {
    id: 'webhook-node',
    name: 'Webhook',
    position: [-528, -240],
  });

  // 2) Build AI Agent node
  const aiAgentBase = compileTemplate<any>(AiAgentTemplate, {
    MESSAGE: "={{ $json.Prompt || $json.body.prompt }}",
    SYSTEM_PROMPT: assistant.systemPrompt ?? '',
  });
  const aiAgentNode = withNodeMeta(aiAgentBase, {
    id: 'ai-agent-node',
    name: 'AI Agent',
    position: [-288, -272],
  });

  // 3) Build Provider Model node
  const providerTemplate = selectProviderTemplate(assistant.provider);
  const modelVars: Record<string, string> = {};
  if (assistant.provider === 'google') {
    modelVars['MODEL_NAME'] = assistant.model; // google template expects MODEL_NAME
  } else {
    modelVars['MODEL'] = assistant.model; // openai/anthropic templates expect MODEL
  }
  const providerNodeBase = compileTemplate<any>(providerTemplate, {
    ...modelVars,
    CREDENTIAL_ID: cred.id,
    CREDENTIAL_NAME: cred.name,
  });
  const providerNodeName = assistant.provider === 'google'
    ? 'Google Gemini Chat Model'
    : assistant.provider === 'anthropic'
    ? 'Anthropic Chat Model'
    : 'OpenAI Chat Model';
  const providerNode = withNodeMeta(providerNodeBase, {
    id: 'provider-model-node',
    name: providerNodeName,
    position: [-288, -64],
  });

  // 4) Compose connections
  const connections: Record<string, any> = {
    [webhookNode.name]: {
      main: [
        [
          {
            node: aiAgentNode.name,
            type: 'main',
            index: 0,
          },
        ],
      ],
    },
    [providerNode.name]: {
      ai_languageModel: [
        [
          {
            node: aiAgentNode.name,
            type: 'ai_languageModel',
            index: 0,
          },
        ],
      ],
    },
  };

  // 5) Assemble workflow JSON
  const nodes = [webhookNode, aiAgentNode, providerNode];
  const workflow: MappingOutput = {
    name: input.workflowName,
    nodes,
    connections,
    settings: { executionOrder: 'v1' },
    active: false,
    pinData: {},
  };
  return workflow;
}
