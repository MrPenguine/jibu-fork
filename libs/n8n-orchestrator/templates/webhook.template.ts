export const WebhookTemplate = {
  parameters: {
    httpMethod: 'POST', // IMPORTANT: Must be POST for webhook delivery
    path: '{{WEBHOOK_PATH}}',
    options: {},
  },
  name: 'Webhook',
  type: 'n8n-nodes-base.webhook',
  typeVersion: 2.1,
  webhookId: '{{WEBHOOK_ID}}',
};
