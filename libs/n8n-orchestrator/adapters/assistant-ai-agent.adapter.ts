import { NodeAdapter, InternalNode, CompileContext, CompiledNode } from '../adapter-registry';
import { compileTemplate, withNodeMeta } from '../template-compiler.service';
import { AiAgentTemplate } from '../templates/ai-agent.template';

export class AssistantAiAgentAdapter implements NodeAdapter {
  type = 'ASSISTANT';

  supports(node: InternalNode): boolean {
    return (node.type || '').toUpperCase() === this.type;
  }

  compile(node: InternalNode, ctx: CompileContext): CompiledNode {
    const compiled = compileTemplate<any>(AiAgentTemplate, {
      MESSAGE: "={{ $json.Prompt || $json.body.text }}",
      SYSTEM_MESSAGE_EXPR: "={{ $json.body.aiContext.systemPrompt }}",
    });

    const name = 'AI Agent';
    const n8nNode = withNodeMeta(compiled, {
      id: this.makeDeterministicId(node.id, name),
      name,
      position: node.position ? [node.position.x, node.position.y] : [-288, -272],
    });

    return {
      id: n8nNode.id,
      name: n8nNode.name,
      n8n: n8nNode,
      portMap: {
        inputs: {
          main: 'main',
          ai_languageModel: 'ai_languageModel',
        },
        outputs: {
          main: 'main',
        },
      },
    };
  }

  private makeDeterministicId(nodeId: string, label: string) {
    return `${label.toLowerCase().replace(/\s+/g, '-')}-${nodeId}`;
  }
}
