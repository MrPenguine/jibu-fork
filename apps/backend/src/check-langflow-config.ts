import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env file
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment from ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.log('No .env file found');
  dotenv.config();
}

// Create a simple config service
const configService = {
  get: (key: string, defaultValue?: string) => process.env[key] || defaultValue,
};

// Check Langflow configuration
const langflowUrl = configService.get('LANGFLOW_API_URL', 'http://localhost:7860');
const langflowFlowId = configService.get('LANGFLOW_FLOW_ID', 'a59a91f2-08a8-431d-bd4f-8da5eec9792d');

console.log('Langflow Configuration:');
console.log(`LANGFLOW_API_URL: ${langflowUrl}`);
console.log(`LANGFLOW_FLOW_ID: ${langflowFlowId}`);

// Check if Langflow is running
const checkLangflow = async () => {
  try {
    console.log(`Checking Langflow health at ${langflowUrl}/api/v1/health`);
    const response = await fetch(`${langflowUrl}/api/v1/health`);
    
    if (response.ok) {
      console.log('Langflow is running!');
      const data = await response.json();
      console.log('Health check response:', data);
    } else {
      console.error(`Langflow health check failed: ${response.status} ${response.statusText}`);
    }
    
    // Check if the flow exists
    console.log(`Checking flow at ${langflowUrl}/api/v1/flows/${langflowFlowId}`);
    const flowResponse = await fetch(`${langflowUrl}/api/v1/flows/${langflowFlowId}`);
    
    if (flowResponse.ok) {
      console.log('Flow exists!');
      const flowData = await flowResponse.json();
      console.log('Flow name:', flowData.name);
    } else {
      console.error(`Flow check failed: ${flowResponse.status} ${flowResponse.statusText}`);
    }
  } catch (error) {
    console.error('Error checking Langflow:', error.message);
  }
};

checkLangflow();
