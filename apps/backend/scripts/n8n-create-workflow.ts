#!/usr/bin/env ts-node
/*
 Simple connectivity test script to CREATE a workflow in n8n using the public API.
 Usage examples:
   N8N_API_URL=http://localhost:5678 N8N_API_KEY=xxx pnpm ts-node apps/backend/scripts/n8n-create-workflow.ts
   pnpm ts-node apps/backend/scripts/n8n-create-workflow.ts --name "Test Workflow" --path test/webhook/path

 Notes:
 - This script only tests creation (POST /workflows). It does not activate the workflow.
 - It uses only schema-allowed fields and avoids read-only props like `active`.
*/

import axios from 'axios';

// HARD-CODED TEST CREDS (delete this file after testing)
// These are used only for quick local connectivity verification.
const HARDCODED = {
  N8N_URL: 'http://localhost:5678',
  N8N_API_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0OWYxY2Y5OC0zMzI2LTQ0NDEtODcyYy1jNzMwYzg1NTFhODgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU2OTk1MDQ5fQ.BoDLx0zIAotAbd574SaPC56-ny7jQbcdwxJMBYzkbcs',
};

type Args = {
  name?: string;
  path?: string;
};

function parseArgs(): Args {
  const out: Args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--name') out.name = process.argv[++i];
    else if (arg === '--path') out.path = process.argv[++i];
  }
  return out;
}

async function main() {
  const { name, path } = parseArgs();
  const baseRaw = (HARDCODED.N8N_URL || 'http://localhost:5678').replace(/\/$/, '');
  const apiBase = /\/api(\/v\d+)?$/.test(baseRaw) ? baseRaw : `${baseRaw}/api/v1`;
  const apiKey = HARDCODED.N8N_API_KEY;
  if (!apiKey) {
    console.error('Missing N8N_API_KEY in environment');
    process.exit(1);
  }

  const headers = { 'X-N8N-API-KEY': apiKey, 'Content-Type': 'application/json' };

  // Minimal webhook -> AI Agent skeleton with expressions for prompt/systemmessage
  const workflow = {
    name: name || 'Connectivity Test Workflow',
    nodes: [
      {
        id: 'webhook-start',
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2.1,
        position: [ -528, -240 ],
        parameters: {
          path: path || 'connectivity-test-webhook',
          options: {},
        },
        webhookId: 'connectivity-test-webhook',
      },
      {
        id: 'ai-agent',
        name: 'AI Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        typeVersion: 2,
        position: [ -288, -272 ],
        parameters: {
          promptType: 'define',
          text: '={{ $json.Prompt || $json.body.prompt }}',
          options: {
            systemMessage: '={{ $json.systemmessage || $json.body.systemmessage }}',
          },
        },
      },
    ],
    // For creation, keep the object minimal and schema-compliant
    connections: {
      Webhook: {
        main: [ [ { node: 'AI Agent', type: 'main', index: 0 } ] ],
      },
    },
    settings: { executionOrder: 'v1' },
  } as any;

  const url = `${apiBase}/workflows`;
  try {
    const res = await axios.post(url, workflow, { headers });
    console.log('Created workflow in n8n:', res.data);
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error(`Failed to create workflow [POST ${url}] status=${status}:`, data || err.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
