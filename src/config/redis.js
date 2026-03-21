import Redis from 'ioredis';
import dotenv from 'dotenv';

// تحميل المتغيرات البيئية
dotenv.config();

/**
 * إعداد الاتصال بخادم Redis
 * يتم استخدام Redis لإدارة التحقق من تكرار الطلبات (Idempotency)
 * وتخزين الإحصائيات اللحظية لمزودي الخدمة.
 */
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASS || undefined,
  retryStrategy: (times) => {
    // استراتيجية إعادة المحاولة في حال فشل الاتصال
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
});

// معالجة أحداث الاتصال
redis.on('connect', () => {
  console.log('✅ تم الاتصال بخادم Redis بنجاح.');
});

redis.on('error', (error) => {
  console.error('❌ خطأ في اتصال Redis:', error.message);
});

export default redis;
