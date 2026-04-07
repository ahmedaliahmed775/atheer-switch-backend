import crypto from 'crypto';
import Transaction from '../models/Transaction.js';
import routerService from '../services/routerService.js';
import { reconstructLUK, verifyEd25519Signature } from '../utils/cryptoUtils.js';

/**
 * محرك التحقق عديم الحالة (Stateless Anti-Replay Verification Engine)
 *
 * تدفق المعالجة:
 * 1. يُستقبَل الحِمل: deviceId | counter | timestamp | signature + بيانات الدفع
 * 2. يتحقق antiReplay middleware من العداد مسبقاً (HTTP 403 إذا أُعيد الاستخدام)
 * 3. يُشتَق seed الجهاز: HMAC-SHA256(DEVICE_MASTER_SEED, deviceId)
 * 4. يُعاد بناء LUK:    HMAC-SHA256(deviceSeed, counter)
 * 5. يُتحقَق من توقيع Ed25519 على الحِمل: deviceId|counter|timestamp
 * 6. تُوجَّه المعاملة إلى jawaliAdapter (P2M) أو mockBankAdapter (P2P)
 * 7. تُسجَّل حالة المعاملة النهائية في PostgreSQL للتدقيق الدائم
 */
export const chargePayment = async (req, res, next) => {
  try {
    const data = req.body.body || req.body;
    const {
      deviceId,
      counter,
      timestamp,
      signature,
      amount,
      receiverAccount,
      transactionType,
      currency = 'YER',
      description = ''
    } = data;

    // التحقق من الحقول الأساسية
    if (!deviceId || counter === undefined || !timestamp || !signature || !amount || !receiverAccount || !transactionType) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'الحقول الأساسية مطلوبة: deviceId, counter, timestamp, signature, amount, receiverAccount, transactionType'
        }
      });
    }

    const masterSeed = process.env.DEVICE_MASTER_SEED;
    if (!masterSeed) {
      console.error('❌ DEVICE_MASTER_SEED غير محدد في المتغيرات البيئية.');
      return res.status(500).json({ success: false, error: { message: 'خطأ في إعداد الخادم.' } });
    }

    // اشتقاق seed الجهاز الفريد من الـ seed الرئيسي ومعرف الجهاز
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
    // يُخزَّن في حقل nonce بقاعدة البيانات للحفاظ على التوافق مع هيكل الجدول الحالي
    const txIdentifier = `${deviceId}:${counter}`;

    // التحقق من توقيع Ed25519
    const isValid = verifyEd25519Signature({
      deviceId,
      counter,
      timestamp,
      signature,
      luk
    });

    if (!isValid) {
      // تسجيل فشل أمني في قاعدة البيانات للتدقيق الدائم
      await Transaction.create({
        // atheerToken: يخزن deviceId في المعمارية الجديدة (للتوافق مع هيكل الجدول الحالي)
        atheerToken: deviceId,
        nonce: txIdentifier,
        signature,
        authMethod: 'ED25519_ANTI_REPLAY',
        transactionType,
        customerMobile: deviceId,
        receiverMobile: receiverAccount,
        amount,
        currency,
        description,
        provider,
        status: 'failed',
        errorMessage: 'Security Failure: Ed25519 signature verification failed.',
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
      // atheerToken: يخزن deviceId في المعمارية الجديدة (للتوافق مع هيكل الجدول الحالي)
      atheerToken: deviceId,
      nonce: txIdentifier,
      signature,
      authMethod: 'ED25519_ANTI_REPLAY',
      transactionType,
      customerMobile: deviceId,
      receiverMobile: receiverAccount,
      amount,
      currency,
      description,
      provider,
      status: 'pending',
      metadata: {
        deviceId,
        counter: parseInt(counter, 10),
        timestamp
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

