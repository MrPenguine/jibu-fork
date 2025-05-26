/**
 * Simple script to test the backend voices endpoint
 * 
 * Run with: node test-backend-voices-endpoint.js
 */

const axios = require('axios');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:4000/api';
const ENDPOINT = '/v1/voices';

async function testBackendVoicesEndpoint() {
  try {
    console.log(`Fetching voices from backend endpoint: ${API_URL}${ENDPOINT}`);
    
    // Get auth token if you have authentication enabled
    // const token = 'your-auth-token'; // Replace with actual token if needed
    
    const response = await axios.get(`${API_URL}${ENDPOINT}`, {
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${token}` // Uncomment if authentication is required
      }
    });
    
    const voices = response.data;
    
    console.log(`Received ${voices.length} voices from the backend`);
    
    // Print a summary of each voice
    voices.forEach((voice, index) => {
      console.log(`\nVoice ${index + 1}:`);
      console.log(`  ID: ${voice.voiceId}`);
      console.log(`  Name: ${voice.name}`);
      console.log(`  Provider: ${voice.provider || 'Unknown'}`);
      console.log(`  Category: ${voice.category || 'Unknown'}`);
      console.log(`  Gender: ${voice.labels?.gender || 'Unknown'}`);
      console.log(`  Accent: ${voice.labels?.accent || 'Unknown'}`);
      console.log(`  Preview URL: ${voice.previewUrl || 'None'}`);
    });
    
    // Save the full JSON response to a file for inspection
    const fs = require('fs');
    fs.writeFileSync('backend-voices-response.json', JSON.stringify(response.data, null, 2));
    console.log('\nFull response saved to backend-voices-response.json');
    
    // Compare with the raw ElevenLabs data
    console.log('\nComparing with raw ElevenLabs data:');
    try {
      const rawData = fs.readFileSync('elevenlabs-voices-response.json', 'utf8');
      const rawVoices = JSON.parse(rawData).voices;
      
      console.log(`Raw ElevenLabs voices: ${rawVoices.length}`);
      console.log(`Backend voices: ${voices.length}`);
      
      if (rawVoices.length !== voices.length) {
        console.log('⚠️ Warning: The number of voices differs between raw data and backend response');
      } else {
        console.log('✅ The number of voices matches between raw data and backend response');
      }
      
      // Check if all voice IDs from raw data are present in backend response
      const backendVoiceIds = new Set(voices.map(v => v.voiceId));
      const missingVoiceIds = rawVoices
        .filter(v => !backendVoiceIds.has(v.voice_id))
        .map(v => v.voice_id);
      
      if (missingVoiceIds.length > 0) {
        console.log(`⚠️ Warning: ${missingVoiceIds.length} voice IDs from raw data are missing in backend response`);
        console.log('Missing voice IDs:', missingVoiceIds);
      } else {
        console.log('✅ All voice IDs from raw data are present in backend response');
      }
      
    } catch (err) {
      console.log('Could not compare with raw data:', err.message);
    }
    
    return voices;
  } catch (error) {
    console.error('Error fetching voices from backend:');
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

// Run the test
testBackendVoicesEndpoint()
  .then(() => console.log('\nTest completed successfully'))
  .catch(error => {
    console.error('\nTest failed:', error.message);
    process.exit(1);
  });
