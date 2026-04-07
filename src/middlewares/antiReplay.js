import redis from '../config/redis.js';

/**
 * Anti-Replay Firewall Middleware — جدار الحماية من هجمات إعادة التشغيل
 *
 * يتحقق بشكل ذري (Atomic) من عَدَّاد الجهاز (Counter) في Redis.
 * - إذا كان incoming_counter <= last_counter  → يرفض الطلب بـ HTTP 403 "Replay Attack Detected"
 * - إذا كان incoming_counter > last_counter   → يُحدِّث العداد في Redis ويُمرِّر الطلب
 *
 * يستخدم سكريبت Lua لضمان العملية الذرية (Check-and-Set) وتجنب حالات السباق (Race Conditions).
 */

// سكريبت Lua لفحص العداد وتحديثه بشكل ذري
const ATOMIC_CHECK_AND_SET = `
  local key = KEYS[1]
  local incoming = tonumber(ARGV[1])
  local current = tonumber(redis.call('GET', key))
  if current == nil then current = -1 end
  if incoming <= current then
    return 0
  end
  redis.call('SET', key, tostring(incoming))
  return 1
`;

export const antiReplayCheck = async (req, res, next) => {
  const data = req.body.body || req.body;
  const { DeviceID, Counter } = data;

  if (!DeviceID || Counter === undefined || Counter === null) {
    return res.status(400).json({
      success: false,
      error: { message: 'DeviceID و Counter مطلوبان للتحقق من مكافحة إعادة التشغيل.' }
    });
  }

  const incomingCounter = parseInt(Counter, 10);
  if (isNaN(incomingCounter)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Counter يجب أن يكون رقماً صحيحاً.' }
    });
  }

  const redisKey = `device:counter:${DeviceID}`;

  try {
    // تنفيذ الفحص الذري عبر سكريبت Lua
    const result = await redis.eval(ATOMIC_CHECK_AND_SET, 1, redisKey, String(incomingCounter));

    if (result === 0) {
      return res.status(403).json({
        success: false,
        error: { message: 'Replay Attack Detected' }
      });
    }

    next();
  } catch (error) {
    console.error('❌ خطأ في التحقق من مكافحة إعادة التشغيل:', error.message);
    return res.status(500).json({
      success: false,
      error: { message: 'خطأ داخلي في التحقق من الأمان.' }
    });
  }
};
