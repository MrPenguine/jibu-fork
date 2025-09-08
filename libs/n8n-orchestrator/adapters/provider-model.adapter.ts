import { NodeAdapter, InternalNode, CompileContext, CompiledNode } from '../adapter-registry';
import { compileTemplate, withNodeMeta } from '../template-compiler.service';
import { OpenAiChatModelTemplate } from '../templates/openai.template';
import { AnthropicChatModelTemplate } from '../templates/anthropic.template';
import { GoogleGeminiChatModelTemplate } from '../templates/google-gemini.template';
import { getProviderConfig } from '../model-name-registry';

export class ProviderModelAdapter implements NodeAdapter {
  type = 'PROVIDER_MODEL';

  supports(node: InternalNode): boolean {
    return (node.type || '').toUpperCase() === this.type;
  }

  compile(node: InternalNode, ctx: CompileContext): CompiledNode {
    const provider = ctx.assistant.provider;
    const cfg = getProviderConfig(provider);
    if (!cfg) throw new Error(`Unsupported provider: ${provider}`);

    const cred = (provider === 'openai' ? ctx.credentials.openai
      : provider === 'anthropic' ? ctx.credentials.anthropic
      : ctx.credentials.google);

    if (!cred) throw new Error(`Missing credential reference for provider '${provider}'.`);

    // Choose template and set model variable key appropriately
    let template: any;
    const vars: Record<string, string> = {
      CREDENTIAL_ID: cred.id,
      CREDENTIAL_NAME: cred.name,
    };

    if (provider === 'google') {
      template = GoogleGeminiChatModelTemplate;
      vars['MODEL_NAME'] = ctx.assistant.model;
    } else if (provider === 'anthropic') {
      template = AnthropicChatModelTemplate;
      vars['MODEL'] = ctx.assistant.model;
    } else {
      template = OpenAiChatModelTemplate;
      vars['MODEL'] = ctx.assistant.model;
    }

    const compiled = compileTemplate<any>(template, vars);

    const name = provider === 'google'
      ? 'Google Gemini Chat Model'
      : provider === 'anthropic'
      ? 'Anthropic Chat Model'
      : 'OpenAI Chat Model';

    const n8nNode = withNodeMeta(compiled, {
      id: this.makeDeterministicId(node.id, name),
      name,
      position: node.position ? [node.position.x, node.position.y] : [-288, -64],
    });

    return {
      id: n8nNode.id,
      name: n8nNode.name,
      n8n: n8nNode,
      portMap: {
        outputs: {
          model: 'ai_languageModel',
        },
      },
    };
  }

  private makeDeterministicId(nodeId: string, label: string) {
    return `${label.toLowerCase().replace(/\s+/g, '-')}-${nodeId}`;
  }
}
