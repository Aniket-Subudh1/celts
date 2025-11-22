// services/queue.js
const Queue = require('bull');
const redisClient = require('../config/redis');

let submissionQueue = null;
let usingRedis = false;

if (process.env.REDIS_URL && redisClient) {
  try {
    // Create Bull queue using REDIS
    submissionQueue = new Queue('submissionQueue', process.env.REDIS_URL, {
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });
    usingRedis = true;
    
    submissionQueue.on('error', (err) => {
      // Handle ECONNRESET errors more gracefully
      if (err.code === 'ECONNRESET') {
        console.warn('Queue Redis connection reset (this is usually normal during Redis restart)');
      } else {
        console.error('Queue error:', err.message);
      }
      // Don't crash the application, just log the error
    });
    
    submissionQueue.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err.message);
    });
    
    console.log('Bull queue initialized with Redis');
  } catch (error) {
    console.error('Failed to initialize Bull queue:', error.message);
    console.warn('Falling back to inline processing');
    usingRedis = false;
    submissionQueue = createInlineQueue();
  }
} else {
  console.warn('Redis not configured. Queue will fallback to inline processing.');
  submissionQueue = createInlineQueue();
}

function createInlineQueue() {
  return {
    add: async (job) => {
      try {
        // simple inline handler; worker will process synchronously later
        const { processSubmissionInline } = require('../workers/aiWorker');
        return processSubmissionInline(job.data);
      } catch (error) {
        console.error('Inline processing error:', error.message);
        throw error;
      }
    }
  };
}

module.exports = { submissionQueue, usingRedis };
