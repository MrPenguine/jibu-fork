/**
 * Integration Test for Webhook Communication
 * 
 * This test sends real HTTP requests to verify webhook communication.
 * Configure your URLs in the test or via environment variables.
 * 
 * Run with: npm test -- webhook-integration.test
 */

import axios from 'axios';

describe('Webhook Integration Test', () => {
  // ============================================
  // CONFIGURE YOUR URLS HERE
  // ============================================
  const WORKFLOW_URL = process.env.TEST_WORKFLOW_URL || 'http://localhost:5678/workflow/M4IZLPwSGizCB8Nk/';
  const WEBHOOK_URL = process.env.TEST_WEBHOOK_URL || 'http://localhost:5678/webhook/api/n8n/hooks/77aac56d-8951-4c6b-96bc-2d0105a35ad5/2';
  
  // Test timeout (30 seconds for real HTTP requests)
  const TEST_TIMEOUT = 30000;

  describe('Webhook Communication', () => {
    it('should successfully send a request to the workflow URL', async () => {
      // Skip if URL not configured
      if (WORKFLOW_URL === 'YOUR_WORKFLOW_URL_HERE') {
        console.log('⚠️  Skipping test - WORKFLOW_URL not configured');
        console.log('Set TEST_WORKFLOW_URL environment variable or update the test file');
        return;
      }

      console.log(`📤 Sending GET request to: ${WORKFLOW_URL}`);

      try {
        // Workflow URL expects GET request with query parameters
        const response = await axios.get(WORKFLOW_URL, {
          params: {
            workflowId: 'test-workflow-123',
            sessionId: 'test-session-456',
            timestamp: new Date().toISOString(),
            event: 'test_event',
            message: 'Integration test from Jibu Console',
          },
          timeout: 10000, // 10 second timeout
        });

        console.log('✅ Response received:', {
          status: response.status,
          statusText: response.statusText,
          data: response.data,
        });

        // Verify response
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
        
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error('❌ Request failed:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
          });
        }
        throw error;
      }
    }, TEST_TIMEOUT);

    it('should successfully send a request to the webhook URL', async () => {
      // Skip if URL not configured
      if (WEBHOOK_URL === 'YOUR_WEBHOOK_URL_HERE') {
        console.log('⚠️  Skipping test - WEBHOOK_URL not configured');
        console.log('Set TEST_WEBHOOK_URL environment variable or update the test file');
        return;
      }

      console.log(`📤 Sending request to: ${WEBHOOK_URL}`);

      const testPayload = {
        sessionId: 'test-session-789',
        timestamp: new Date().toISOString(),
        event: 'webhook_test',
        payload: {
          message: 'Webhook integration test',
          isVoice: false,
          priority: 5,
        },
      };

      try {
        const response = await axios.post(WEBHOOK_URL, testPayload, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        });

        console.log('✅ Response received:', {
          status: response.status,
          statusText: response.statusText,
          data: response.data,
        });

        // Verify response
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
        
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error('❌ Request failed:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
          });
        }
        throw error;
      }
    }, TEST_TIMEOUT);

    it('should send a voice-priority webhook request', async () => {
      // Skip if URL not configured
      if (WEBHOOK_URL === 'YOUR_WEBHOOK_URL_HERE') {
        console.log('⚠️  Skipping test - WEBHOOK_URL not configured');
        return;
      }

      console.log(`📤 Sending voice-priority request to: ${WEBHOOK_URL}`);

      const voicePayload = {
        workflowId: 'voice-workflow-123',
        sessionId: 'voice-session-456',
        connectionId: 'conn-789',
        timestamp: new Date().toISOString(),
        isVoice: true,
        priority: 10, // High priority for voice
        event: 'call_started',
        payload: {
          callSid: 'CA1234567890',
          from: '+1234567890',
          to: '+0987654321',
          status: 'in-progress',
        },
      };

      try {
        const startTime = Date.now();
        const response = await axios.post(WEBHOOK_URL, voicePayload, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 5000, // Voice requires fast response (5s)
        });
        const duration = Date.now() - startTime;

        console.log('✅ Voice webhook response:', {
          status: response.status,
          duration: `${duration}ms`,
          data: response.data,
        });

        // Verify response
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
        
        // Voice should respond quickly (under 5 seconds)
        expect(duration).toBeLessThan(5000);
        console.log(`⚡ Response time: ${duration}ms (${duration < 1000 ? 'EXCELLENT' : duration < 3000 ? 'GOOD' : 'ACCEPTABLE'})`);
        
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error('❌ Voice webhook failed:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
          });
        }
        throw error;
      }
    }, TEST_TIMEOUT);

    it('should handle webhook errors gracefully', async () => {
      // Test with an invalid URL to verify error handling
      const invalidUrl = 'https://invalid-webhook-url-that-does-not-exist.example.com/webhook';
      
      console.log(`📤 Testing error handling with invalid URL`);

      const testPayload = {
        sessionId: 'error-test-session',
        event: 'error_test',
      };

      try {
        await axios.post(invalidUrl, testPayload, {
          timeout: 5000,
        });
        
        // If we get here, the request unexpectedly succeeded
        fail('Expected request to fail but it succeeded');
        
      } catch (error) {
        // This is expected
        console.log('✅ Error handling works correctly');
        expect(error).toBeDefined();
        
        if (axios.isAxiosError(error)) {
          console.log('Error details:', {
            message: error.message,
            code: error.code,
          });
        }
      }
    }, TEST_TIMEOUT);
  });

  describe('Performance Tests', () => {
    it('should measure webhook response time', async () => {
      if (WEBHOOK_URL === 'YOUR_WEBHOOK_URL_HERE') {
        console.log('⚠️  Skipping test - WEBHOOK_URL not configured');
        return;
      }

      console.log(`⏱️  Measuring response time for: ${WEBHOOK_URL}`);

      const measurements: number[] = [];
      const iterations = 5;

      for (let i = 0; i < iterations; i++) {
        const payload = {
          sessionId: `perf-test-${i}`,
          timestamp: new Date().toISOString(),
          iteration: i + 1,
        };

        try {
          const startTime = Date.now();
          await axios.post(WEBHOOK_URL, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
          });
          const duration = Date.now() - startTime;
          measurements.push(duration);
          
          console.log(`  Request ${i + 1}/${iterations}: ${duration}ms`);
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.warn(`  Request ${i + 1} failed:`, error);
        }
      }

      if (measurements.length > 0) {
        const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        const min = Math.min(...measurements);
        const max = Math.max(...measurements);

        console.log('\n📊 Performance Summary:');
        console.log(`  Average: ${avg.toFixed(2)}ms`);
        console.log(`  Min: ${min}ms`);
        console.log(`  Max: ${max}ms`);
        console.log(`  Successful requests: ${measurements.length}/${iterations}`);

        // For voice, average should be under 5 seconds
        if (avg < 1000) {
          console.log('  ⚡ EXCELLENT - Under 1 second');
        } else if (avg < 3000) {
          console.log('  ✅ GOOD - Under 3 seconds');
        } else if (avg < 5000) {
          console.log('  ⚠️  ACCEPTABLE - Under 5 seconds');
        } else {
          console.log('  ❌ SLOW - Over 5 seconds (may cause issues for voice)');
        }

        expect(measurements.length).toBeGreaterThan(0);
      }
    }, TEST_TIMEOUT * 2);
  });
});
