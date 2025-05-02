const fetch = require('node-fetch');

/**
 * Simple script to debug file operations with different organization IDs
 */

// Configuration - Replace with actual values
const API_URL = 'http://localhost:4000';
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN'; // Replace with actual token

// Test organization IDs
const testOrgIds = [
  '43624419-2b34-46ad-9033-97485b1eb180', // From the logs
  '2fe12c4d-5b76-4d8b-a254-0060d279464d'  // The ID that's actually used
];

/**
 * List files for a specific organization
 */
async function listFiles(orgId) {
  console.log(`Testing listFiles for organization: ${orgId}`);
  
  try {
    const response = await fetch(`${API_URL}/files?orgId=${orgId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'X-Organization-ID': orgId
      }
    });
    
    if (!response.ok) {
      console.error(`Error: ${response.status} - ${response.statusText}`);
      const text = await response.text();
      console.error(`Response: ${text}`);
      return;
    }
    
    const data = await response.json();
    console.log(`Found ${data.length || 0} files for organization ${orgId}`);
    console.log(JSON.stringify(data, null, 2).substring(0, 500) + '...');
  } catch (error) {
    console.error(`Error listing files for ${orgId}:`, error);
  }
}

/**
 * Main function to run the tests
 */
async function runTests() {
  console.log('Starting file operations tests...');
  
  // Test listing files for each org ID
  for (const orgId of testOrgIds) {
    await listFiles(orgId);
    console.log('------------------------');
  }
}

// Run the tests
runTests().catch(console.error); 