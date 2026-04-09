import crypto from 'crypto';
import Transaction from '../models/Transaction.js';
import routerService from '../services/routerService.js';
import { reconstructLUK, verifyHmacSignature } from '../utils/cryptoUtils.js';

/**
 * محرك التحقق عديم الحالة (Stateless Anti-Replay Verification Engine)
 *
 * ## اتفاقية المعرفات في بيئة التطبيق الموحد (Unified App):
 *
 *   deviceId        = رقم هاتف العميل (الدافع / Payer)
 *                     → يُستخدم لاشتقاق deviceSeed تشفيرياً
 *                     → يُمرَّر كـ customerIdentifier لجوالي (senderMobile)
 *
 *   receiverAccount = رقم هاتف التاجر (المستلم / Merchant)
 *                     → يُطابق Merchant.providerWalletId أو Merchant.phone
 *                     → يُمرَّر كـ targetWalletId لجوالي (merchantWalletId)
 *
 * ## تدفق المعالجة:
 * 1. يُستقبَل الحِمل: deviceId | counter | timestamp | signature + بيانات الدفع
 * 2. يتحقق antiReplay middleware من العداد مسبقاً (HTTP 403 إذا أُعيد الاستخدام)
 * 3. يُشتَق seed الجهاز: HMAC-SHA256(DEVICE_MASTER_SEED, deviceId)
 * 4. يُعاد بناء LUK:    HMAC-SHA256(deviceSeed, counter)
 * 5. يُتحقَق من توقيع HMAC-SHA256 على الحِمل: deviceId|counter|timestamp
 * 6. تُوجَّه المعاملة إلى jawaliAdapter (P2M) أو mockBankAdapter (P2P)
 * 7. تُسجَّل حالة المعاملة النهائية في PostgreSQL للتدقيق الدائم
 */
export const chargePayment = async (req, res, next) => {
  try {
    const data = req.body.body || req.body;
    // C-02: دعم كلا التنسيقين camelCase (من SDK) و PascalCase (للتوافق)
    const deviceId = data.deviceId || data.DeviceID;
    const counter = data.counter ?? data.Counter;
    const timestamp = data.timestamp || data.Timestamp;
    const signature = data.signature || data.Signature;
    const amount = data.amount;
    const receiverAccount = data.receiverAccount;
    const transactionType = data.transactionType;
    const currency = data.currency || 'YER';
    const description = data.description || '';
    const transactionRef = data.transactionRef || '';
    const merchantId = data.merchantId || '';

    // التحقق من الحقول الأساسية
    if (!deviceId || counter === undefined || !timestamp || !signature || !amount || !receiverAccount || !transactionType) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'الحقول الأساسية مطلوبة: deviceId, counter, timestamp, signature, amount, receiverAccount, transactionType'
        }
      });
    }

    // Fix #8: التحقق من عمر الطلب — رفض الطلبات المتأخرة أو ذات الطابع الزمني المستقبلي
    const maxAgeMs = parseInt(process.env.REQUEST_MAX_AGE_MS || '300000', 10); // 5 دقائق افتراضياً
    const now = Date.now();
    const tsNum = Number(timestamp);
    if (isNaN(tsNum) || tsNum > now + 30000) {
      // طابع زمني مستقبلي (مسموح 30 ثانية فرق ساعة)
      return res.status(400).json({
        success: false,
        error: { message: 'الطابع الزمني للطلب غير صالح (مستقبلي).' }
      });
    }
    if (now - tsNum > maxAgeMs) {
      return res.status(400).json({
        success: false,
        error: { message: `انتهت صلاحية الطلب. الحد الأقصى: ${maxAgeMs / 1000} ثانية.` }
      });
    }

    const masterSeed = process.env.DEVICE_MASTER_SEED;
    if (!masterSeed) {
      console.error('❌ DEVICE_MASTER_SEED غير محدد في المتغيرات البيئية.');
      return res.status(500).json({ success: false, error: { message: 'خطأ في إعداد الخادم.' } });
    }

    // C-03: اشتقاق seed الجهاز الفريد من الـ seed الرئيسي ومعرف الجهاز
    const deviceSeedHmac = crypto.createHmac('sha256', Buffer.from(masterSeed, 'hex'));
    deviceSeedHmac.update(deviceId);
    const deviceSeed = deviceSeedHmac.digest();

    // إعادة بناء LUK (مفتاح الاستخدام المحدود)
    const luk = reconstructLUK(deviceSeed, counter);
    if (!luk) {
      return res.status(500).json({ success: false, error: { message: 'فشل إعادة بناء مفتاح LUK.' } });
    }

    // تحديد مزود الخدمة بناءً على نوع المعاملة
    const provider = transactionType === 'P2P' ? 'MOCK' : 'JAWALI';
    // معرف المعاملة الفريد: deviceId + counter (مضمون الفرادة بواسطة antiReplay middleware في Redis)
    const txIdentifier = `${deviceId}:${counter}`;

    // C-01: التحقق من توقيع HMAC-SHA256 (مطابق لمنطق SDK)
    const isValid = verifyHmacSignature({
      deviceId,
      counter,
      timestamp,
      signature,
      luk
    });

    if (!isValid) {
      // تسجيل فشل أمني في قاعدة البيانات للتدقيق الدائم
      await Transaction.create({
        atheerToken: deviceId,
        nonce: txIdentifier,
        signature,
        authMethod: 'HMAC_SHA256_ANTI_REPLAY',
        transactionType,
        customerMobile: deviceId,
        receiverMobile: receiverAccount,
        amount,
        currency,
        description,
        provider,
        transactionRef,
        status: 'failed',
        errorMessage: 'Security Failure: HMAC-SHA256 signature verification failed.',
        metadata: {
          deviceId,
          counter: parseInt(counter, 10),
          timestamp,
          securityEvent: 'SIGNATURE_FAILURE'
        }
      }).catch(err => console.error('❌ فشل تسجيل حدث الأمان:', err.message));

      return res.status(401).json({ success: false, error: { message: 'فشل التحقق من التوقيع الرقمي.' } });
    }

    // إنشاء سجل المعاملة المعلَّقة
    const transaction = await Transaction.create({
      atheerToken: deviceId,
      nonce: txIdentifier,
      signature,
      authMethod: 'HMAC_SHA256_ANTI_REPLAY',
      transactionType,
      customerMobile: deviceId,
      receiverMobile: receiverAccount,
      amount,
      currency,
      description,
      provider,
      transactionRef,
      status: 'pending',
      metadata: {
        deviceId,
        counter: parseInt(counter, 10),
        timestamp,
        merchantId
      }
    });

    // توجيه المعاملة المُتحقَّق منها إلى مزود الخدمة
    const result = await routerService.routeTransaction({
      transactionId: transaction.id,
      amount,
      senderMobile: deviceId,
      receiverAccount,
      transactionType,
      currency,
      description
    });

    if (result.success) {
      await transaction.update({ status: 'success', providerRef: result.providerRef });
      return res.status(200).json({
        success: true,
        data: { transactionId: transaction.id, status: 'success', providerRef: result.providerRef }
      });
    } else {
      await transaction.update({ status: 'failed', errorMessage: result.message });
      let errorMsg = result.message || 'فشل تنفيذ العملية المالية.';
      if (result.errorCode === 'PROVIDER_CONNECTION_ERROR') {
        errorMsg = 'فشل الاتصال بمزود الخدمة. حاول لاحقاً.';
      }
      return res.status(400).json({ success: false, error: { message: errorMsg } });
    }
  } catch (error) {
    console.error('❌ خطأ حرج:', error.message);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// متوافق مع الإصدارات السابقة (backward-compatible alias)
export const processPayment = chargePayment;

export const getTransactionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findOne({ where: { id } });
    if (!transaction) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
};
