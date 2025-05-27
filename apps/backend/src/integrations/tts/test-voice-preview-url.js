/**
 * Simple script to test the voice preview URL endpoint
 * 
 * Run with: node test-voice-preview-url.js VOICE_ID
 */

const axios = require('axios');

// Get voice ID from command line arguments
const voiceId = process.argv[2];

if (!voiceId) {
  console.error('Please provide a voice ID as a command line argument');
  console.error('Usage: node test-voice-preview-url.js VOICE_ID');
  process.exit(1);
}

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:4000/api';
const ENDPOINT = `/v1/voices/${voiceId}/preview-url`;

async function testVoicePreviewUrl() {
  try {
    console.log(`Fetching preview URL for voice ID: ${voiceId}`);
    console.log(`Endpoint: ${API_URL}${ENDPOINT}`);
    
    const response = await axios.get(`${API_URL}${ENDPOINT}`, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('\nResponse:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.previewUrl) {
      console.log('\nPreview URL found!');
      
      // Check if it's a data URL
      if (response.data.previewUrl.startsWith('data:audio')) {
        console.log('This is a data URL containing the audio data');
        console.log(`Length: ${response.data.previewUrl.length} characters`);
      } else {
        console.log('This is a regular URL pointing to an audio file');
      }
    } else {
      console.log('\nNo preview URL found in the response');
    }
  } catch (error) {
    console.error('\nError fetching preview URL:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Run the test
testVoicePreviewUrl()
  .then(() => console.log('\nTest completed'))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
