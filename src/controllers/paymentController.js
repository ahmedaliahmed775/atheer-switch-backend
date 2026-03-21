import Transaction from '../models/Transaction.js';
import routerService from '../services/routerService.js';

/**
 * متحكم المدفوعات (Payment Controller)
 * يعالج طلبات الدفع الواردة من Atheer Android SDK.
 */
export const processPayment = async (req, res, next) => {
  const { amount, currency, provider, customerMobile, nonce, metadata } = req.body;
  const merchantId = req.merchant.id;

  try {
    // 1. إنشاء سجل المعاملة في قاعدة البيانات بحالة 'pending'
    const transaction = await Transaction.create({
      merchantId,
      amount,
      currency: currency || 'YER',
      provider,
      customerMobile,
      nonce,
      status: 'pending',
      metadata
    });

    // 2. توجيه المعاملة إلى مزود الخدمة المناسب (Jawali/WeCash)
    const result = await routerService.routeTransaction({
      transactionId: transaction.id,
      amount,
      currency,
      provider,
      customerMobile,
      metadata
    });

    // 3. تحديث حالة المعاملة بناءً على نتيجة مزود الخدمة
    if (result.success) {
      await transaction.update({
        status: 'success',
        providerRef: result.providerRef
      });

      const responseData = {
        transactionId: transaction.id,
        status: 'success',
        providerRef: result.providerRef,
        message: 'تمت عملية الدفع بنجاح.'
      };

      // حفظ النتيجة في Redis للتحقق من التكرار (Idempotency)
      if (res.saveIdempotency) await res.saveIdempotency(responseData);

      return res.status(200).json({
        success: true,
        data: responseData
      });
    } else {
      await transaction.update({
        status: 'failed',
        errorCode: result.errorCode,
        errorMessage: result.message
      });

      return res.status(400).json({
        success: false,
        error: {
          code: result.errorCode,
          message: result.message
        }
      });
    }
  } catch (error) {
    console.error('خطأ في معالجة الدفع:', error.message);
    next(error);
  }
};

/**
 * الحصول على تفاصيل معاملة معينة
 */
export const getTransactionStatus = async (req, res, next) => {
  const { id } = req.params;
  const merchantId = req.merchant.id;

  try {
    const transaction = await Transaction.findOne({
      where: { id, merchantId }
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'المعاملة غير موجودة.'
      });
    }

    return res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};
