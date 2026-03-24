import Transaction from '../models/Transaction.js';
import routerService from '../services/routerService.js';

// أدوات التشفير للتحقق من التوقيع البيومتري
import { verifyBiometricSignature } from '../utils/cryptoUtils.js';
import OfflineToken from '../models/OfflineToken.js';

export const processPayment = async (req, res, next) => {
  try {
    /**
     * 🚦 منطق معالجة الدفع بنموذج التوقيع البيومتري (Biometric Cryptogram)
     * يقبل فقط الحقول الأساسية من SDK:
     * amount, receiverAccount, transactionType, atheerToken, signature, timestamp, nonce
     */
    const data = req.body.body || req.body;
    const { amount, receiverAccount, transactionType, atheerToken, signature, timestamp, nonce } = data;

    // تحقق من وجود الحقول المطلوبة
    if (!amount || !receiverAccount || !transactionType || !atheerToken || !signature || !timestamp || !nonce) {
      return res.status(400).json({ success: false, error: { message: 'الحقول الأساسية مطلوبة: amount, receiverAccount, transactionType, atheerToken, signature, timestamp, nonce' } });
    }

    // جلب التوكن للتحقق من المفتاح العام
    const tokenRecord = await OfflineToken.findOne({ where: { tokenValue: atheerToken } });
    if (!tokenRecord || !tokenRecord.publicKey) {
      return res.status(401).json({ success: false, error: { message: 'توكن غير صالح أو المفتاح العام غير مسجل.' } });
    }

    // التحقق من التوقيع الرقمي باستخدام المفتاح العام
    const isValid = verifyBiometricSignature({
      publicKey: tokenRecord.publicKey,
      signature,
      atheerToken,
      timestamp
    });
    if (!isValid) {
      return res.status(401).json({ success: false, error: { message: 'فشل التحقق من التوقيع البيومتري.' } });
    }

    // استخراج رقم هاتف الدافع من سجل التوكن (عدم الثقة بأي رقم مرسل من العميل)
    const senderMobile = tokenRecord.assignedTo;
    if (!senderMobile) {
      return res.status(401).json({ success: false, error: { message: 'توكن غير مرتبط بمستخدم.' } });
    }

    // إنشاء سجل المعاملة
    const transaction = await Transaction.create({
      amount,
      atheerToken,
      nonce,
      signature,
      authMethod: 'BIOMETRIC_CRYPTOGRAM',
      transactionType,
      customerMobile: senderMobile,
      receiverMobile: receiverAccount,
      status: 'pending'
    });

    // تمرير المعاملة إلى خدمة التوجيه (RouterService)
    const result = await routerService.routeTransaction({
      transactionId: transaction.id,
      amount,
      senderMobile,
      receiverAccount,
      transactionType
    });

    if (result.success) {
      await transaction.update({ status: 'success', providerRef: result.providerRef });
      if (typeof res.saveIdempotency === 'function') {
        await res.saveIdempotency({ transactionId: transaction.id, status: 'success', providerRef: result.providerRef });
      }
      return res.status(200).json({
        success: true,
        data: { transactionId: transaction.id, status: 'success', providerRef: result.providerRef }
      });
    } else {
      await transaction.update({ status: 'failed', errorMessage: result.message });
      let errorMsg = result.message || 'فشل تنفيذ العملية المالية.';
      if (result.errorCode === 'CONNECTION_ERROR') {
        errorMsg = 'فشل الاتصال بالمحفظة. حاول لاحقاً.';
      } else if (errorMsg.includes('رصيد')) {
        errorMsg = 'رصيد الدافع غير كافٍ.';
      } else if (errorMsg.includes('مستلم')) {
        errorMsg = 'حساب المستلم غير موجود.';
      }
      return res.status(400).json({ success: false, error: { message: errorMsg } });
    }
  } catch (error) {
    console.error('❌ خطأ حرج:', error.message);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

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
