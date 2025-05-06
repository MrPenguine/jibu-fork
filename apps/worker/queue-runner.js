/**
 * Direct queue processor script
 * Bypasses the NestJS application and directly connects to Redis to process jobs
 */
console.log('Starting direct queue processor...');

// Create Redis client
const Redis = require('ioredis');

// Use environment variables with Docker-friendly defaults
// For local development running outside Docker, use localhost instead of 'redis'
const REDIS_HOST = process.env.REDIS_HOST || 'localhost'; // Changed from 'redis' to 'localhost'
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

console.log(`Connecting to Redis at ${REDIS_HOST}:${REDIS_PORT}`);

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD || undefined,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    console.log(`Redis connection retry in ${delay}ms (attempt ${times})`);
    return delay;
  }
});

// Define queue names
const QUEUE_NAMES = {
  DEFAULT: 'default',
  INDEXING: 'indexing',
};

// Define job names
const JOB_NAMES = {
  // Default queue jobs
  DEFAULT_JOB: 'default-job',
  EMAIL_JOB: 'email-job',
  
  // Indexing queue jobs
  INDEX_FILE_SOURCE: 'index-file-source',
  DEINDEX_SOURCE: 'deindex-source',
};

// Counter for heartbeat logging
let pollCount = 0;
const HEARTBEAT_INTERVAL = 20; // Log every 20 polls (approximately every 20 seconds)

// Active indexing jobs map
const activeIndexingJobs = new Map();

// Timestamp utility function
function getTimestamp() {
  return `[${new Date().toLocaleTimeString()}]`;
}

// Simple job processing logic
async function processJob(queue, jobData) {
  const jobId = jobData.id || 'unknown';
  const jobName = jobData.name || 'unknown';
  const jobType = `${queue}:${jobName}`;
  
  console.log(`${getTimestamp()} Processing job from queue ${jobType}:`, jobId);
  
  // Handle different job types
  if (queue === QUEUE_NAMES.INDEXING && jobName === JOB_NAMES.INDEX_FILE_SOURCE) {
    // Handle knowledge base indexing job
    return processIndexingJob(jobData);
  } else if (queue === QUEUE_NAMES.INDEXING && jobName === JOB_NAMES.DEINDEX_SOURCE) {
    // Handle deindexing job
    console.log(`${getTimestamp()} Processing deindexing job`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log(`${getTimestamp()} Deindexing job completed successfully: ${jobId}`);
    return { success: true };
  } else {
    // Generic job handling
    console.log(`${getTimestamp()} Processing generic job: ${jobType}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`${getTimestamp()} Job completed successfully: ${jobId}`);
    return { success: true };
  }
}

// Process knowledge base indexing job - simulates a 10-minute indexing process
async function processIndexingJob(jobData) {
  const jobId = jobData.id || `job-${Date.now()}`;
  const sourceId = jobData.data?.knowledgeBaseSourceId || 'unknown-source';
  const orgId = jobData.data?.organizationId || 'unknown-org';
  const knowledgeBaseId = jobData.data?.knowledgeBaseId || 'unknown-kb';
  
  console.log(`${getTimestamp()} Starting knowledge base indexing job:`);
  console.log(`  - Job ID: ${jobId}`);
  console.log(`  - Source ID: ${sourceId}`);
  console.log(`  - Knowledge Base ID: ${knowledgeBaseId}`);
  console.log(`  - Organization ID: ${orgId}`);
  
  // Update source status to PROCESSING in Redis
  try {
    await redis.set(`kb:source:${sourceId}:status`, 'PROCESSING');
    await redis.set(`kb:source:${sourceId}:progress`, '0');
    console.log(`${getTimestamp()} Set knowledge base source status to PROCESSING`);
  } catch (err) {
    console.error(`${getTimestamp()} Failed to update source status:`, err);
  }
  
  // Create indexing progress tracker - runs for 10 minutes
  const totalTime = 600000; // 10 minutes (600 seconds)
  const updateInterval = 5000; // 5 seconds
  const totalSteps = totalTime / updateInterval;
  
  // Store job in active jobs map
  activeIndexingJobs.set(jobId, {
    jobId,
    sourceId,
    orgId,
    knowledgeBaseId,
    startedAt: Date.now(),
    progress: 0,
    steps: 0,
    totalSteps
  });
  
  // Setup progress reporting function
  return new Promise((resolve) => {
    const progressTimer = setInterval(async () => {
      const jobInfo = activeIndexingJobs.get(jobId);
      if (!jobInfo) {
        clearInterval(progressTimer);
        return;
      }
      
      // Update progress
      jobInfo.steps++;
      jobInfo.progress = Math.floor((jobInfo.steps / jobInfo.totalSteps) * 100);
      
      // Calculate time remaining
      const timeRemaining = Math.ceil((totalSteps - jobInfo.steps) * (updateInterval/1000));
      const minutesRemaining = Math.floor(timeRemaining / 60);
      const secondsRemaining = timeRemaining % 60;
      
      // Log progress with more details
      console.log(`${getTimestamp()} Indexing job for source ${sourceId} is ongoing`);
      console.log(`  - Progress: ${jobInfo.progress}%`);
      console.log(`  - Time remaining: ${minutesRemaining}m ${secondsRemaining}s`);
      
      // Store progress in Redis for external checking
      try {
        await redis.set(`kb:source:${sourceId}:progress`, jobInfo.progress.toString());
      } catch (err) {
        console.error(`${getTimestamp()} Failed to update progress in Redis:`, err);
      }
      
      // Check if job is complete
      if (jobInfo.steps >= jobInfo.totalSteps) {
        clearInterval(progressTimer);
        activeIndexingJobs.delete(jobId);
        
        // Update source status to COMPLETED in Redis
        try {
          await redis.set(`kb:source:${sourceId}:status`, 'COMPLETED');
          console.log(`${getTimestamp()} Set knowledge base source status to COMPLETED`);
        } catch (err) {
          console.error(`${getTimestamp()} Failed to update final status:`, err);
        }
        
        console.log(`${getTimestamp()} Knowledge base indexing job completed successfully after 10 minutes`);
        console.log(`  - Job ID: ${jobId}`);
        console.log(`  - Source ID: ${sourceId}`);
        console.log(`  - Knowledge Base ID: ${knowledgeBaseId}`);
        
        resolve({ success: true, jobId, sourceId });
      }
    }, updateInterval);
  });
}

// Listen for direct API requests to queue a file for indexing
async function setupIndexingJobsListener() {
  // Subscribe to a channel for indexing requests
  const pubsub = new Redis({
    host: REDIS_HOST, // Use configured Redis host
    port: REDIS_PORT,
    password: REDIS_PASSWORD || undefined,
  });
  
  console.log(`${getTimestamp()} Setting up listener for indexing job requests on Redis at ${REDIS_HOST}:${REDIS_PORT}`);
  
  // Subscribe to indexing channel
  await pubsub.subscribe('kb:indexing:requests');
  
  // Handle messages
  pubsub.on('message', async (channel, message) => {
    if (channel === 'kb:indexing:requests') {
      try {
        console.log(`${getTimestamp()} Received indexing request:`, message);
        const request = JSON.parse(message);
        
        if (request.sourceId && request.knowledgeBaseId) {
          // Create a synthetic job for processing
          const jobId = `manual-job-${Date.now()}`;
          const jobData = {
            id: jobId,
            name: JOB_NAMES.INDEX_FILE_SOURCE,
            data: {
              knowledgeBaseSourceId: request.sourceId, // Use sourceId as knowledgeBaseSourceId
              organizationId: request.organizationId || 'unknown',
              knowledgeBaseId: request.knowledgeBaseId
            }
          };
          
          console.log(`${getTimestamp()} Created indexing job for source ${request.sourceId} with job ID: ${jobId}`);
          
          // Process the job immediately
          processJob(QUEUE_NAMES.INDEXING, jobData);
        } else {
          console.error(`${getTimestamp()} Received invalid indexing request, missing required fields:`, request);
        }
      } catch (err) {
        console.error(`${getTimestamp()} Error processing indexing request:`, err);
      }
    }
  });
  
  console.log(`${getTimestamp()} Now listening for indexing job requests on kb:indexing:requests channel`);
}

// Check Bull queues for jobs
async function checkBullQueues() {
  try {
    // Check default queue
    const defaultJob = await redis.lpop(`bull:${QUEUE_NAMES.DEFAULT}:wait`);
    if (defaultJob) {
      try {
        const jobData = JSON.parse(defaultJob);
        await processJob(QUEUE_NAMES.DEFAULT, jobData);
      } catch (err) {
        console.error(`${getTimestamp()} Error processing default job:`, err);
      }
    }
    
    // Check indexing queue
    const indexingJob = await redis.lpop(`bull:${QUEUE_NAMES.INDEXING}:wait`);
    if (indexingJob) {
      try {
        const jobData = JSON.parse(indexingJob);
        await processJob(QUEUE_NAMES.INDEXING, jobData);
      } catch (err) {
        console.error(`${getTimestamp()} Error processing indexing job:`, err);
      }
    }
  } catch (error) {
    console.error(`${getTimestamp()} Error checking Bull queues:`, error);
  }
}

// Poll for jobs
async function pollForJobs() {
  // Show heartbeat periodically
  pollCount++;
  if (pollCount % HEARTBEAT_INTERVAL === 0) {
    const activeJobs = activeIndexingJobs.size;
    console.log(`${getTimestamp()} Worker is active and monitoring queues - heartbeat #${Math.floor(pollCount/HEARTBEAT_INTERVAL)} ${activeJobs > 0 ? `(${activeJobs} active indexing jobs)` : ''}`);
  }
  
  // Check Bull queues
  await checkBullQueues();
  
  // Poll again after delay
  setTimeout(pollForJobs, 1000);
}

// Provide an API to manually trigger indexing for a source
async function setupIndexingAPI() {
  // Register a command handler for Redis
  redis.defineCommand('triggerIndexing', {
    numberOfKeys: 0,
    lua: `
      local sourceId = ARGV[1]
      local knowledgeBaseId = ARGV[2]
      local organizationId = ARGV[3]
      
      -- Create a request payload 
      local payload = '{"sourceId":"' .. sourceId .. '","knowledgeBaseId":"' .. knowledgeBaseId .. '","organizationId":"' .. organizationId .. '"}'
      
      -- Publish to the indexing channel
      redis.call('PUBLISH', 'kb:indexing:requests', payload)
      
      return 'Triggered indexing for source: ' .. sourceId
    `
  });
  
  console.log(`${getTimestamp()} Registered triggerIndexing command in Redis`);
}

// Show initial connection status
redis.on('connect', async () => {
  console.log(`${getTimestamp()} Successfully connected to Redis at ${REDIS_HOST}:${REDIS_PORT}`);
  console.log(`${getTimestamp()} Worker is active and monitoring queues...`);
  console.log(`${getTimestamp()} Ready to process knowledge base indexing jobs (10-minute simulation)`);
  console.log('Press Ctrl+C to stop the worker');
  
  // Setup indexing jobs listener
  await setupIndexingJobsListener();
  
  // Setup Redis API for triggering indexing
  await setupIndexingAPI();
  
  // Start polling for jobs
  pollForJobs();
});

redis.on('error', (err) => {
  console.error(`${getTimestamp()} Redis connection error:`, err);
});

// Handle termination
process.on('SIGINT', () => {
  console.log(`${getTimestamp()} Stopping queue processor...`);
  redis.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`${getTimestamp()} Stopping queue processor...`);
  redis.disconnect();
  process.exit(0);
});