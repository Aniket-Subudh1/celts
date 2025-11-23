const Redis = require('ioredis');

let redisClient = null;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, {
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
    keepAlive: 30000,
    enableOfflineQueue: false,
  });
  
  redisClient.on('connect', () => {
    console.log('Redis connected successfully');
  });
  
  redisClient.on('error', (err) => {
    if (err.code === 'ECONNRESET') {
      console.warn('Redis connection reset (this is usually normal):', err.message);
    } else {
      console.error('Redis connection error:', err.message);
    }
  });
  
  redisClient.on('close', () => {
    console.warn('Redis connection closed');
  });
  
  redisClient.on('reconnecting', () => {
    console.log('Redis reconnecting...');
  });
  
  redisClient.on('ready', () => {
    console.log('Redis ready for commands');
  });
} else {
  console.warn('REDIS_URL not set; queue will fallback to inline processing.');
}

module.exports = redisClient;
