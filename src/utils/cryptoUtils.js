import crypto from 'crypto';

/**
 * بادئة PKCS#8 لمفتاح Ed25519 الخاص (32 بايت seed).
 * الهيكل: SEQUENCE { INTEGER 0, SEQUENCE { OID 1.3.101.112 }, OCTET STRING { OCTET STRING { [32 bytes] } } }
 */
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

/**
 * إعادة بناء مفتاح الاستخدام المحدود (LUK — Limited Use Key)
 * يستخدم HMAC-SHA256 لاشتقاق مفتاح فريد لكل معاملة من seed الجهاز والعداد،
 * مطابقاً لمنطق Atheer Android SDK.
 *
 * @param {Buffer|string} deviceMasterSeed - الـ seed الخاص بالجهاز (Buffer أو hex string)
 * @param {number|string} incomingCounter  - عداد المعاملة الحالي
 * @returns {Buffer|null} - مفتاح LUK (32 بايت) أو null في حالة الخطأ
 */
export function reconstructLUK(deviceMasterSeed, incomingCounter) {
  if (!deviceMasterSeed || incomingCounter === undefined || incomingCounter === null) return null;
  try {
    const seedBuf = Buffer.isBuffer(deviceMasterSeed)
      ? deviceMasterSeed
      : Buffer.from(deviceMasterSeed, 'hex');
    const hmac = crypto.createHmac('sha256', seedBuf);
    hmac.update(String(incomingCounter));
    return hmac.digest(); // Buffer (32 بايت)
  } catch {
    return null;
  }
}

/**
 * التحقق من توقيع Ed25519 باستخدام مفتاح LUK المعاد بناؤه.
 * الحمولة الموقَّعة: `${deviceId}|${counter}|${timestamp}`
 *
 * يشتق المفتاح العام من seed الـ LUK (32 بايت) باستخدام تنسيق PKCS#8 المُمدَّد،
 * ثم يتحقق من التوقيع المُرسَل من SDK.
 *
 * @param {Object} params
 * @param {string}        params.deviceId  - معرف الجهاز
 * @param {number|string} params.counter   - عداد المعاملة
 * @param {number|string} params.timestamp - الطابع الزمني للمعاملة
 * @param {string}        params.signature - التوقيع Base64 المُرسَل من SDK
 * @param {Buffer}        params.luk       - مفتاح LUK (32 بايت)
 * @returns {boolean} - true إذا كان التوقيع صالحاً، false في أي حالة أخرى
 */
export function verifyEd25519Signature({ deviceId, counter, timestamp, signature, luk }) {
  if (!deviceId || counter === undefined || !timestamp || !signature || !luk) return false;
  try {
    const payload = Buffer.from(`${deviceId}|${counter}|${timestamp}`);
    const sigBuf = Buffer.from(signature, 'base64');

    // بناء مفتاح PKCS#8 من بادئة ثابتة + seed الـ LUK (32 بايت)
    const privateKeyDer = Buffer.concat([ED25519_PKCS8_PREFIX, luk]);
    const privateKey = crypto.createPrivateKey({ key: privateKeyDer, format: 'der', type: 'pkcs8' });
    const publicKey = crypto.createPublicKey(privateKey);

    return crypto.verify(null, payload, publicKey, sigBuf);
  } catch {
    return false;
  }
}

