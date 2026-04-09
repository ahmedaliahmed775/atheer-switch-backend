import redis from '../config/redis.js';

/**
 * System Status Middleware — التحكم في حالة النظام
 *
 * يتحقق من حالة النظام (ACTIVE / MAINTENANCE) قبل معالجة أي طلب.
 * الحالة تُقرأ أولاً من Redis (للتحديث الفوري دون إعادة التشغيل)،
 * وإذا فشل Redis تُستخدم القيمة من متغير البيئة كـ Fallback.
 *
 * طرق التحكم:
 * 1. متغير بيئي: SYSTEM_STATUS=ACTIVE (أو MAINTENANCE)
 * 2. Redis (أولوية أعلى): SET system:status "MAINTENANCE"
 * 3. نقطة نهاية إدارية: POST /api/v1/admin/system-status
 *
 * نقاط مستثناة من الحالة:
 * - GET /health (يجب أن تعمل دائماً للمراقبة)
 * - منطقة /switch-admin (لوحة التحكم)
 * - GET / (الصفحة الرئيسية)
 */

/** المسارات المستثناة من وضع الصيانة */
const EXEMPT_PATHS = ['/health', '/switch-admin', '/'];

export const systemStatusCheck = async (req, res, next) => {
  // تجاوز الفحص للمسارات المستثناة
  if (EXEMPT_PATHS.some(p => req.path === p || req.path.startsWith('/switch-admin'))) {
    return next();
  }

  try {
    // أولاً: قراءة الحالة من Redis (أولوية قصوى — يسمح بالتبديل الفوري)
    let status = await redis.get('system:status');
    if (!status) {
      // Fallback: قراءة من متغير البيئة
      status = process.env.SYSTEM_STATUS || 'ACTIVE';
    }

    if (status.toUpperCase() === 'MAINTENANCE') {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SYSTEM_MAINTENANCE',
          message: 'النظام في وضع الصيانة حالياً. سيعود للعمل قريباً.'
        }
      });
    }

    next();
  } catch (error) {
    // Fail-Open: في حال فشل Redis، نستمر في الخدمة
    console.error('⚠️ تعذّر قراءة حالة النظام:', error.message);
    next();
  }
};

/**
 * تبديل حالة النظام (للاستخدام في statsController أو adminRoutes)
 *
 * @param {'ACTIVE'|'MAINTENANCE'} newStatus الحالة الجديدة
 */
export const setSystemStatus = async (newStatus) => {
  const normalized = newStatus.toUpperCase();
  if (!['ACTIVE', 'MAINTENANCE'].includes(normalized)) {
    throw new Error('حالة غير صالحة. القيم المسموحة: ACTIVE, MAINTENANCE');
  }
  await redis.set('system:status', normalized);
  return normalized;
};
