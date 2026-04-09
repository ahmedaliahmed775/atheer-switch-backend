import crypto from 'crypto';
import redis from '../config/redis.js';

/**
 * وحدة تحكم تسجيل الأجهزة (Device Enrollment Controller)
 *
 * بروتوكول تسجيل الجهاز (Device Enrollment Protocol):
 * 1. يُرسل الـ SDK معرف الجهاز (deviceId) إلى هذه النقطة.
 * 2. يُشتَق deviceSeed = HMAC-SHA256(DEVICE_MASTER_SEED, deviceId).
 * 3. يُرسَل الـ deviceSeed إلى الجهاز عبر قناة TLS مشفرة.
 * 4. يُخزَّن الـ deviceSeed في Android Keystore / EncryptedSharedPrefs.
 * 5. بعد ذلك: كلا الطرفين يشتقان LUK = HMAC-SHA256(deviceSeed, counter).
 *
 * حمايات إضافية (Fix #3):
 * - حد 5 تسجيلات/ساعة لكل جهاز (Rate Limit per Device)
 * - حد 20 جهاز مسجل لكل تاجر (Max Devices per Merchant)
 * - ربط كل جهاز بالتاجر الذي سجله
 */

/** الحد الأقصى لعدد الأجهزة المسجلة لكل تاجر */
const MAX_DEVICES_PER_MERCHANT = parseInt(process.env.MAX_DEVICES_PER_MERCHANT || '20', 10);

export const enrollDevice = async (req, res) => {
  try {
    const data = req.body.body || req.body;
    const { deviceId } = data;

    // التحقق من صحة معرف الجهاز
    if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length < 8) {
      return res.status(400).json({
        success: false,
        error: { message: 'deviceId مطلوب ويجب أن يكون نصاً بطول 8 أحرف على الأقل.' }
      });
    }

    const masterSeed = process.env.DEVICE_MASTER_SEED;
    if (!masterSeed) {
      console.error('❌ DEVICE_MASTER_SEED غير محدد في المتغيرات البيئية.');
      return res.status(500).json({
        success: false,
        error: { message: 'خطأ في إعداد الخادم.' }
      });
    }

    // ─── Fix #3: حماية endpoint التسجيل ────────────────────────────

    // (أ) Rate Limiting: حد أقصى 5 محاولات تسجيل لكل جهاز في الساعة
    const rateLimitKey = `enroll:ratelimit:${deviceId}`;
    const attempts = await redis.incr(rateLimitKey);
    if (attempts === 1) await redis.expire(rateLimitKey, 3600);
    if (attempts > 5) {
      return res.status(429).json({
        success: false,
        error: { message: 'تم تجاوز الحد المسموح لتسجيل الجهاز. حاول بعد ساعة.' }
      });
    }

    // (ب) حد الأجهزة لكل تاجر: التحقق من أن التاجر لم يتجاوز العدد المسموح
    const merchantId = req.merchant?.id || 'unknown';
    const merchantDevicesKey = `merchant:devices:${merchantId}`;

    // التحقق: هل الجهاز مسجل بالفعل لهذا التاجر؟
    const isAlreadyEnrolled = await redis.sismember(merchantDevicesKey, deviceId);
    if (isAlreadyEnrolled) {
      // الجهاز مسجل سابقاً — نعطيه الـ seed مرة أخرى (idempotent)
      const hmac = crypto.createHmac('sha256', Buffer.from(masterSeed, 'hex'));
      hmac.update(deviceId);
      const deviceSeed = hmac.digest('base64');

      return res.status(200).json({
        success: true,
        data: {
          deviceSeed,
          message: 'الجهاز مسجل مسبقاً. تم إعادة إرسال الـ seed.'
        }
      });
    }

    // التحقق: هل وصل التاجر للحد الأقصى من الأجهزة المسجلة؟
    const currentDeviceCount = await redis.scard(merchantDevicesKey);
    if (currentDeviceCount >= MAX_DEVICES_PER_MERCHANT) {
      return res.status(403).json({
        success: false,
        error: {
          message: `تم بلوغ الحد الأقصى للأجهزة المسجلة (${MAX_DEVICES_PER_MERCHANT}). تواصل مع الدعم لزيادة الحد.`
        }
      });
    }

    // ─── اشتقاق seed الجهاز ───────────────────────────────────────

    const hmac = crypto.createHmac('sha256', Buffer.from(masterSeed, 'hex'));
    hmac.update(deviceId);
    const deviceSeed = hmac.digest('base64');

    // تسجيل حدث التسجيل في Redis
    const pipeline = redis.pipeline();
    // (ج) ربط الجهاز بالتاجر (Set membership)
    pipeline.sadd(merchantDevicesKey, deviceId);
    // تسجيل بيانات التسجيل
    pipeline.set(
      `device:enrolled:${deviceId}`,
      JSON.stringify({
        enrolledAt: new Date().toISOString(),
        merchantId,
        ip: req.ip
      }),
      'EX',
      parseInt(process.env.DEVICE_COUNTER_TTL_SECONDS || '31536000', 10) // سنة
    );
    await pipeline.exec();

    console.log(`✅ تم تسجيل الجهاز: ${deviceId.substring(0, 8)}... [تاجر: ${merchantId}] [الأجهزة: ${currentDeviceCount + 1}/${MAX_DEVICES_PER_MERCHANT}]`);

    return res.status(200).json({
      success: true,
      data: {
        deviceSeed,
        message: 'تم تسجيل الجهاز بنجاح. خزّن الـ seed في بيئة آمنة.'
      }
    });
  } catch (error) {
    console.error('❌ خطأ في تسجيل الجهاز:', error.message);
    return res.status(500).json({
      success: false,
      error: { message: 'خطأ داخلي أثناء تسجيل الجهاز.' }
    });
  }
};
