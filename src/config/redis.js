import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const retryStrategy = (times) => Math.min(times * 50, 2000);

function buildRedis() {
  const url = process.env.REDIS_URL;
  if (url) {
    return new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy
    });
  }

  const useTls = process.env.REDIS_TLS === 'true';

  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASS || undefined,
    tls: useTls ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: 3,
    retryStrategy
  });
}

const redis = buildRedis();

redis.on('connect', () => {
  console.log('✅ تم الاتصال بخادم Redis بنجاح.');
});

redis.on('error', (error) => {
  console.error('❌ خطأ في اتصال Redis:', error.message);
});

export default redis;
