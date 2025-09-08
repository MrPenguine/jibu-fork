export const OpenAiChatModelTemplate = {
  parameters: {
    model: '{{MODEL}}',
    options: {},
  },
  name: 'OpenAI Chat Model',
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  typeVersion: 1,
  credentials: {
    openAiApi: {
      id: '{{CREDENTIAL_ID}}',
      name: '{{CREDENTIAL_NAME}}',
    },
  },
};
