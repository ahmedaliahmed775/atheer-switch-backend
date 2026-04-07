import crypto from 'crypto';
import Transaction from '../models/Transaction.js';
import routerService from '../services/routerService.js';
import { reconstructLUK, verifyEd25519Signature } from '../utils/cryptoUtils.js';

/**
 * محرك التحقق عديم الحالة (Stateless Anti-Replay Verification Engine)
 *
 * تدفق المعالجة:
 * 1. يُستقبَل الحِمل: DeviceID | Counter | Challenge | Signature + بيانات الدفع
 * 2. يتحقق antiReplay middleware من العداد مسبقاً (HTTP 403 إذا أُعيد الاستخدام)
 * 3. يُشتَق seed الجهاز: HMAC-SHA256(DEVICE_MASTER_SEED, DeviceID)
 * 4. يُعاد بناء LUK:    HMAC-SHA256(deviceSeed, Counter)
 * 5. يُتحقَق من توقيع Ed25519 على الحِمل: DeviceID|Counter|Challenge
 * 6. تُوجَّه المعاملة إلى jawaliAdapter (P2M) أو mockBankAdapter (P2P)
 * 7. تُسجَّل حالة المعاملة النهائية في PostgreSQL للتدقيق الدائم
 */
export const chargePayment = async (req, res, next) => {
  try {
    const data = req.body.body || req.body;
    const {
      DeviceID,
      Counter,
      Challenge,
      Signature,
      amount,
      receiverAccount,
      transactionType,
      currency = 'YER',
      description = ''
    } = data;

    // التحقق من الحقول الأساسية
    if (!DeviceID || Counter === undefined || !Challenge || !Signature || !amount || !receiverAccount || !transactionType) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'الحقول الأساسية مطلوبة: DeviceID, Counter, Challenge, Signature, amount, receiverAccount, transactionType'
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
    deviceSeedHmac.update(DeviceID);
    const deviceSeed = deviceSeedHmac.digest();

    // إعادة بناء LUK (مفتاح الاستخدام المحدود)
    const luk = reconstructLUK(deviceSeed, Counter);
    if (!luk) {
      return res.status(500).json({ success: false, error: { message: 'فشل إعادة بناء مفتاح LUK.' } });
    }

    // تحديد مزود الخدمة بناءً على نوع المعاملة
    const provider = transactionType === 'P2P' ? 'MOCK' : 'JAWALI';
    // معرف المعاملة الفريد: DeviceID + Counter (مضمون الفرادة بواسطة antiReplay middleware في Redis)
    // يُخزَّن في حقل nonce بقاعدة البيانات للحفاظ على التوافق مع هيكل الجدول الحالي
    const txIdentifier = `${DeviceID}:${Counter}`;

    // التحقق من توقيع Ed25519
    const isValid = verifyEd25519Signature({
      deviceId: DeviceID,
      counter: Counter,
      challenge: Challenge,
      signature: Signature,
      luk
    });

    if (!isValid) {
      // تسجيل فشل أمني في قاعدة البيانات للتدقيق الدائم
      await Transaction.create({
        // atheerToken: يخزن DeviceID في المعمارية الجديدة (للتوافق مع هيكل الجدول الحالي)
        atheerToken: DeviceID,
        nonce: txIdentifier,
        signature: Signature,
        authMethod: 'ED25519_ANTI_REPLAY',
        transactionType,
        customerMobile: DeviceID,
        receiverMobile: receiverAccount,
        amount,
        currency,
        description,
        provider,
        status: 'failed',
        errorMessage: 'Security Failure: Ed25519 signature verification failed.',
        metadata: {
          deviceId: DeviceID,
          counter: parseInt(Counter, 10),
          challenge: Challenge,
          securityEvent: 'SIGNATURE_FAILURE'
        }
      }).catch(err => console.error('❌ فشل تسجيل حدث الأمان:', err.message));

      return res.status(401).json({ success: false, error: { message: 'فشل التحقق من التوقيع الرقمي.' } });
    }

    // إنشاء سجل المعاملة المعلَّقة
    const transaction = await Transaction.create({
      // atheerToken: يخزن DeviceID في المعمارية الجديدة (للتوافق مع هيكل الجدول الحالي)
      atheerToken: DeviceID,
      nonce: txIdentifier,
      signature: Signature,
      authMethod: 'ED25519_ANTI_REPLAY',
      transactionType,
      customerMobile: DeviceID,
      receiverMobile: receiverAccount,
      amount,
      currency,
      description,
      provider,
      status: 'pending',
      metadata: {
        deviceId: DeviceID,
        counter: parseInt(Counter, 10),
        challenge: Challenge
      }
    });

    // توجيه المعاملة المُتحقَّق منها إلى مزود الخدمة
    const result = await routerService.routeTransaction({
      transactionId: transaction.id,
      amount,
      senderMobile: DeviceID,
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

