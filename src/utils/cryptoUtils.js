import crypto from 'crypto';

/**
 * إعادة بناء مفتاح الاستخدام المحدود (LUK — Limited Use Key)
 * يستخدم HMAC-SHA256 لاشتقاق مفتاح فريد لكل معاملة من seed الجهاز والعداد،
 * مطابقاً لمنطق Atheer Android SDK.
 *
 * @param {Buffer|string} deviceSeed     - الـ seed الخاص بالجهاز (Buffer أو hex string)
 * @param {number|string} incomingCounter - عداد المعاملة الحالي
 * @returns {Buffer|null} - مفتاح LUK (32 بايت) أو null في حالة الخطأ
 */
export function reconstructLUK(deviceSeed, incomingCounter) {
  if (!deviceSeed || incomingCounter === undefined || incomingCounter === null) return null;
  try {
    const seedBuf = Buffer.isBuffer(deviceSeed)
      ? deviceSeed
      : Buffer.from(deviceSeed, 'hex');
    const hmac = crypto.createHmac('sha256', seedBuf);
    hmac.update(String(incomingCounter));
    return hmac.digest(); // Buffer (32 بايت)
  } catch {
    return null;
  }
}

/**
 * التحقق من توقيع HMAC-SHA256 (مطابق لمنطق SDK — AtheerKeystoreManager.signWithLUK)
 *
 * SDK يوقّع:  signature = Base64( HMAC-SHA256(LUK, "deviceId|counter|timestamp") )
 * Backend:    يعيد حساب نفس الـ HMAC ويقارن بمقارنة آمنة ضد هجمات التوقيت.
 *
 * @param {Object} params
 * @param {string}        params.deviceId  - معرف الجهاز
 * @param {number|string} params.counter   - عداد المعاملة
 * @param {number|string} params.timestamp - الطابع الزمني للمعاملة
 * @param {string}        params.signature - التوقيع Base64 المُرسَل من SDK
 * @param {Buffer}        params.luk       - مفتاح LUK (32 بايت)
 * @returns {boolean} - true إذا كان التوقيع صالحاً، false في أي حالة أخرى
 */
export function verifyHmacSignature({ deviceId, counter, timestamp, signature, luk }) {
  if (!deviceId || counter === undefined || !timestamp || !signature || !luk) return false;
  try {
    const payload = `${deviceId}|${counter}|${timestamp}`;
    const hmac = crypto.createHmac('sha256', luk);
    hmac.update(payload);
    const expectedBuf = hmac.digest();

    // فك ترميز التوقيع المُستلم من Base64
    const sigBuf = Buffer.from(signature, 'base64');

    // مقارنة آمنة ضد هجمات التوقيت (Timing-Safe Comparison)
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}
