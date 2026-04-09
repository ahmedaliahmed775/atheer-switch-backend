import redis from '../config/redis.js';

/**
 * S-05: Rate Limiting Middleware باستخدام Redis
 *
 * يحد من عدد الطلبات لكل عنوان IP لحماية النظام من هجمات Brute Force.
 * الحدود:
 * - 100 طلب / دقيقة لكل IP (قيمة افتراضية، قابلة للتعديل عبر متغيرات البيئة)
 */
export const rateLimiter = async (req, res, next) => {
  // تجاوز Rate Limiting لنقاط فحص النظام
  if (req.path === '/health' || req.path === '/') {
    return next();
  }

  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
  const windowSeconds = parseInt(process.env.RATE_LIMIT_WINDOW || '60', 10);

  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const key = `ratelimit:${ip}`;

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    // إضافة ترويسات Rate Limit القياسية
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - current)));

    if (current > maxRequests) {
      res.set('Retry-After', String(windowSeconds));
      return res.status(429).json({
        success: false,
        error: {
          message: 'تم تجاوز الحد المسموح من الطلبات. حاول مرة أخرى لاحقاً.',
          retryAfter: windowSeconds
        }
      });
    }

    next();
  } catch (error) {
    // في حال فشل Redis، نمرر الطلب لضمان استمرارية الخدمة (Fail-Open)
    console.error('⚠️ تعذّر تطبيق Rate Limiting:', error.message);
    next();
  }
};
