export const ChatTriggerTemplate = {
  parameters: {
    public: true,
    options: {
      responseMode: 'lastNode',
    },
  },
  name: 'When chat message received',
  type: '@n8n/n8n-nodes-langchain.chatTrigger',
  typeVersion: 1.1,
  webhookId: '{{WEBHOOK_ID}}',
};
