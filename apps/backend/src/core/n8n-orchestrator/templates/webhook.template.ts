export const WebhookTemplate = {
  parameters: {
    httpMethod: 'POST',
    path: '{{WEBHOOK_PATH}}',
    responseMode: 'onReceived',
    options: {}
  },
  name: 'Webhook',
  type: 'n8n-nodes-base.webhook',
  typeVersion: 1.1,
  webhookId: '{{WEBHOOK_ID}}',
};
