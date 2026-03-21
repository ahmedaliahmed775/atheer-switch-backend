import redis from '../config/redis.js';

/**
 * Middleware للتحقق من تكرار الطلبات (Idempotency)
 * يمنع معالجة نفس الطلب أكثر من مرة باستخدام قيمة فريدة (nonce).
 * يتم تخزين الـ nonce في Redis لمدة 24 ساعة.
 */
export const checkIdempotency = async (req, res, next) => {
  const nonce = req.headers['x-atheer-nonce'] || req.body.nonce;

  if (!nonce) {
    return res.status(400).json({
      success: false,
      message: 'قيمة الـ nonce مفقودة. يرجى إرسال قيمة فريدة لكل طلب.'
    });
  }

  try {
    // التحقق من وجود الـ nonce في Redis
    const existingStatus = await redis.get(`nonce:${nonce}`);

    if (existingStatus) {
      // إذا وجد الـ nonce، يتم إرجاع حالة الطلب السابقة مباشرة
      const response = JSON.parse(existingStatus);
      return res.status(200).json({
        success: true,
        isDuplicate: true,
        message: 'تمت معالجة هذا الطلب مسبقاً.',
        data: response
      });
    }

    // إضافة دالة لحفظ النتيجة في Redis بعد انتهاء المعالجة
    res.saveIdempotency = async (data) => {
      await redis.set(`nonce:${nonce}`, JSON.stringify(data), 'EX', 86400); // صلاحية 24 ساعة
    };

    next();
  } catch (error) {
    console.error('خطأ في التحقق من تكرار الطلب:', error);
    next(); // الاستمرار في المعالجة في حال فشل Redis لضمان استمرارية الخدمة
  }
};
