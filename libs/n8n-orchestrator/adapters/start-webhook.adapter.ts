import { NodeAdapter, InternalNode, CompileContext, CompiledNode } from '../adapter-registry';
import { compileTemplate, withNodeMeta } from '../template-compiler.service';
import { WebhookTemplate } from '../templates/webhook.template';

export class StartWebhookAdapter implements NodeAdapter {
  type = 'START';

  supports(node: InternalNode): boolean {
    return (node.type || '').toUpperCase() === this.type;
  }

  compile(node: InternalNode, ctx: CompileContext): CompiledNode {
    const compiled = compileTemplate<any>(WebhookTemplate, {
      WEBHOOK_PATH: ctx.webhook.path,
      WEBHOOK_ID: ctx.webhook.id,
    });

    const name = 'Webhook';
    const n8nNode = withNodeMeta(compiled, {
      id: this.makeDeterministicId(node.id, name),
      name,
      position: node.position ? [node.position.x, node.position.y] : [-528, -240],
    });

    return {
      id: n8nNode.id,
      name: n8nNode.name,
      n8n: n8nNode,
      portMap: {
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
