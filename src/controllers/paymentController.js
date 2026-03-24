import Transaction from '../models/Transaction.js';
import routerService from '../services/routerService.js';

export const processPayment = async (req, res, next) => {
  try {
    const data = req.body.body || req.body;
    const { amount, currency, provider, customerMobile, receiverMobile, atheerToken, nonce, metadata } = data;
    const merchantId = req.merchant?.id || null;

    // تحقق من وجود الحقول المطلوبة
    if (!receiverMobile) {
      return res.status(400).json({ success: false, error: { message: 'رقم هاتف المستلم (receiverMobile) مطلوب.' } });
    }
    if (!atheerToken) {
      return res.status(400).json({ success: false, error: { message: 'توكن الدفع (atheerToken) مطلوب.' } });
    }

    // تحقق من التوكن
    let tokenRecord;
    try {
      const tokenService = (await import('../services/tokenService.js')).default;
      tokenRecord = await tokenService.verifyAndUseToken(atheerToken, customerMobile);
    } catch (err) {
      return res.status(400).json({ success: false, error: { message: err.message || 'فشل التحقق من التوكن' } });
    }

    // إنشاء سجل العملية
    const transaction = await Transaction.create({
      merchantId,
      amount,
      currency: currency || 'YER',
      provider,
      customerMobile,
      receiverMobile,
      atheerToken,
      nonce,
      status: 'pending',
      metadata
    });

    // تمرير بيانات المستلم والدافع
    const result = await routerService.routeTransaction({
      transactionId: transaction.id,
      amount,
      currency,
      provider,
      customerMobile,
      receiverMobile,
      metadata
    });

    if (result.success) {
      await transaction.update({ status: 'success', providerRef: result.providerRef });
      // حفظ نتيجة العملية في Redis لمنع التكرار
      if (typeof res.saveIdempotency === 'function') {
        await res.saveIdempotency({ transactionId: transaction.id, status: 'success', providerRef: result.providerRef });
      }
      return res.status(200).json({
        success: true,
        data: { transactionId: transaction.id, status: 'success', providerRef: result.providerRef }
      });
    } else {
      // إعادة حالة التوكن إلى PROVISIONED إذا فشلت العملية المالية
      try {
        const tokenService = (await import('../services/tokenService.js')).default;
        await tokenRecord.update({ status: 'PROVISIONED' });
      } catch (e) {}
      await transaction.update({ status: 'failed', errorMessage: result.message });
      // توضيح رسالة الخطأ
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
    console.error('❌ Critical Error:', error.message);
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
