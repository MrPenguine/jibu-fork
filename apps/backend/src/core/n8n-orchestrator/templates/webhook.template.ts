import { N8nWebhookType } from "libs/types/n8n-types";

export const WebhookTemplate = {
  parameters: {
    path: '{{WEBHOOK_PATH}}',
    responsePropertyName: 'text',
    options: {},
  },
  name: 'Chat Trigger',
  type: N8nWebhookType.CHAT_TRIGGER,
  typeVersion: 1,
  webhookId: '{{WEBHOOK_ID}}',
};
