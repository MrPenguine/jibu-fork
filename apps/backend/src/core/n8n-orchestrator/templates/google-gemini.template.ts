export const GoogleGeminiChatModelTemplate = {
  parameters: {
    modelName: '{{MODEL_NAME}}',
    options: {},
  },
  name: 'Google Gemini Chat Model',
  type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
  typeVersion: 1,
  credentials: {
    googlePalmApi: {
      id: '{{CREDENTIAL_ID}}',
      name: '{{CREDENTIAL_NAME}}',
    },
  },
};
