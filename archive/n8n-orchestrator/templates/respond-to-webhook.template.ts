export const RespondToWebhookTemplate = {
  parameters: {
    responseCode: 200,
    options: {},
    body: '={{$json.output}}'
  },
  name: 'Respond to Webhook',
  type: 'n8n-nodes-base.respondToWebhook',
  typeVersion: 1,
};
