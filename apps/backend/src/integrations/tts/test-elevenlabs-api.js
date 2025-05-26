/**
 * Simple script to test the ElevenLabs API directly
 * 
 * Run with: node test-elevenlabs-api.js YOUR_API_KEY
 */

const axios = require('axios');

// Get API key from command line arguments
const apiKey = process.argv[2];

if (!apiKey) {
  console.error('Please provide your ElevenLabs API key as a command line argument');
  console.error('Usage: node test-elevenlabs-api.js YOUR_API_KEY');
  process.exit(1);
}

async function testGetVoices() {
  try {
    console.log('Fetching voices from ElevenLabs API...');
    
    const response = await axios.get('https://api.elevenlabs.io/v2/voices', {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      params: {
        page_size: 100,
        include_total_count: true,
      },
    });
    
    const { voices, has_more, next_page_token } = response.data;
    
    console.log(`Found ${voices.length} voices`);
    console.log(`Has more: ${has_more}`);
    
    // Print a summary of each voice
    voices.forEach((voice, index) => {
      console.log(`\nVoice ${index + 1}:`);
      console.log(`  ID: ${voice.voice_id}`);
      console.log(`  Name: ${voice.name}`);
      console.log(`  Category: ${voice.category}`);
      console.log(`  Gender: ${voice.labels?.gender || 'Unknown'}`);
      console.log(`  Accent: ${voice.labels?.accent || 'Unknown'}`);
      console.log(`  Preview URL: ${voice.preview_url || 'None'}`);
    });
    
    // Save the full JSON response to a file for inspection
    const fs = require('fs');
    fs.writeFileSync('elevenlabs-voices-response.json', JSON.stringify(response.data, null, 2));
    console.log('\nFull response saved to elevenlabs-voices-response.json');
    
    return voices;
  } catch (error) {
    console.error('Error fetching voices:');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error message:', error.message);
    }
    throw error;
  }
}

// Run VError: Failed to play audio: Unknown error
    at Audio.eval (webpack-internal:///(app-pages-browser)/./src/utils/voicesApi.ts:185:20)the test
testGetVoices()
  .then(() => console.log('\nTest completed successfully'))
  .catch(error => {
    console.error('\nTest failed:', error.message);
    process.exit(1);
  });
