export const AiAgentTemplate = {
  parameters: {
    promptType: 'define',
    text: '{{MESSAGE}}',
    options: {
      systemMessage: '{{SYSTEM_PROMPT}}',
    },
  },
  name: 'AI Agent',
  type: '@n8n/n8n-nodes-langchain.agent',
  typeVersion: 2,
};
