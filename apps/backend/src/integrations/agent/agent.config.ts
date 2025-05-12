/**
 * Agent configuration specification
 * 
 * This file defines the environment variables needed for the agent service.
 * Add these variables to your .env file.
 */

export const agentConfigSpec = {
  // The URL of the Langflow API
  LANGFLOW_API_URL: {
    default: 'http://localhost:7860',
    description: 'URL of the Langflow API',
  },
  
  // The ID of the Langflow flow to use
  LANGFLOW_FLOW_ID: {
    default: 'a59a91f2-08a8-431d-bd4f-8da5eec9792d',
    description: 'ID of the Langflow flow to use',
  },
  
  // The agent provider to use (currently only langflow is supported)
  AGENT_PROVIDER: {
    default: 'langflow',
    description: 'Agent provider to use',
    options: ['langflow'],
  },
};

/**
 * Example .env configuration:
 * 
 * # Agent Configuration
 * LANGFLOW_API_URL=http://localhost:7860
 * LANGFLOW_FLOW_ID=a59a91f2-08a8-431d-bd4f-8da5eec9792d
 * AGENT_PROVIDER=langflow
 */
