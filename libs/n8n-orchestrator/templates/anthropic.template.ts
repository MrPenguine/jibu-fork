export const AnthropicChatModelTemplate = {
  parameters: {
    model: '{{MODEL}}',
    options: {},
  },
  name: 'Anthropic Chat Model',
  type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  typeVersion: 1,
  credentials: {
    anthropicApi: {
      id: '{{CREDENTIAL_ID}}',
      name: '{{CREDENTIAL_NAME}}',
    },
  },
};
