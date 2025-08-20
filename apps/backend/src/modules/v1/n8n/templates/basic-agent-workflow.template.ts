/**
 * Basic n8n workflow template for new agents
 * This template creates a simple webhook-based workflow that can be triggered by the agent
 */
export const createBasicAgentWorkflowTemplate = (agentId: string, agentName: string): any => {
  // Base position for nodes
  let positionX = 0;
  const positionY = 0;
  const horizontalGap = 200;

  // Create the workflow structure
  const workflow = {
    name: `${agentName} Workflow`,
    nodes: [],
    connections: {},
    settings: {
      saveManualExecutions: true,
      timezone: 'UTC',
      executionTimeout: 120,
    },
  };

  // 1. Create Chat Trigger node (entry point)
  const chatTriggerNode = {
    parameters: {
      responseMode: 'onReceived',
      responseData: 'allEntries',
      responseContentType: 'application/json',
      options: {},
    },
    name: 'Chat Trigger',
    type: 'n8n-nodes-base.chatTrigger',
    typeVersion: 1,
    position: [positionX, positionY],
  };
  workflow.nodes.push(chatTriggerNode);
  positionX += horizontalGap;

  // 2. Create Set node to prepare data
  const setNode = {
    parameters: {
      values: {
        string: [
          {
            name: 'agentId',
            value: agentId,
          },
          {
            name: 'agentName',
            value: agentName,
          },
          {
            name: 'timestamp',
            value: '={{$now}}',
          },
        ],
      },
    },
    name: 'Prepare Data',
    type: 'n8n-nodes-base.set',
    typeVersion: 1,
    position: [positionX, positionY],
  };
  workflow.nodes.push(setNode);
  positionX += horizontalGap;

  // 3. Create HTTP Request node for demonstration
  const httpRequestNode = {
    parameters: {
      url: '={{$json["webhookUrl"]}}',
      method: 'POST',
      sendBody: true,
      bodyParameters: {
        parameters: [
          {
            name: 'agentId',
            value: '={{$node["Prepare Data"].json["agentId"]}}',
          },
          {
            name: 'agentName',
            value: '={{$node["Prepare Data"].json["agentName"]}}',
          },
          {
            name: 'data',
            value: '={{$json}}',
          },
          {
            name: 'timestamp',
            value: '={{$node["Prepare Data"].json["timestamp"]}}',
          },
        ],
      },
      options: {},
    },
    name: 'Send Webhook',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 1,
    position: [positionX, positionY],
  };
  workflow.nodes.push(httpRequestNode);
  positionX += horizontalGap;


  // Set up connections between nodes
  workflow.connections = {
    'Chat Trigger': {
      main: [
        [
          {
            node: 'Prepare Data',
            type: 'main',
            index: 0,
          },
        ],
      ],
    },
    'Prepare Data': {
      main: [
        [
          {
            node: 'Send Webhook',
            type: 'main',
            index: 0,
          },
        ],
      ],
    },
  };

  return workflow;
};
