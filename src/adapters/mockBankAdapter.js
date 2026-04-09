import { PaymentAdapter } from './PaymentAdapter.js';

/**
 * محول تجريبي (Mock Bank Adapter)
 * يستخدم لاختبار النظام في بيئة التطوير دون الحاجة للاتصال بمزود خدمة حقيقي.
 *
 * A-03: يمدد PaymentAdapter لضمان اتساق الواجهة.
 */
class MockBankAdapter extends PaymentAdapter {
  get providerName() {
    return 'MOCK';
  }

  /**
   * محاكاة تحويل رصيد بين رقمين جوال (P2P)
   * @param {Object} params
   * @param {string} params.senderMobile - رقم جوال الدافع
   * @param {string} params.receiverMobile - رقم جوال المستلم
   * @param {number|string} params.amount - قيمة التحويل
   * @returns {Promise<Object>} - نتيجة التحويل
   */
  async p2pTransfer({ senderMobile, receiverMobile, amount }) {
    // محاكاة تأخير الشبكة
    await new Promise(resolve => setTimeout(resolve, 800));

    // تحقق تجريبي: رفض إذا المبلغ غير موجب أو أحد الأرقام ناقص
    if (!senderMobile || !receiverMobile || !amount || Number(amount) <= 0) {
      return {
        success: false,
        errorCode: 'INVALID_INPUT',
        message: 'بيانات التحويل غير مكتملة أو المبلغ غير صالح.'
      };
    }

    // محاكاة فشل إذا المبلغ 999 (اختبار)
    if (Number(amount) === 999) {
      return {
        success: false,
        errorCode: 'INSUFFICIENT_FUNDS',
        message: 'رصيد الدافع غير كافٍ.'
      };
    }

    // محاكاة نجاح التحويل
    return {
      success: true,
      providerRef: `P2P-MOCK-${Date.now()}`,
      message: `تم تحويل ${amount} من ${senderMobile} إلى ${receiverMobile} بنجاح.`
    };
  }

  /**
   * محاكاة تنفيذ خصم مباشر (P2M)
   */
  async executeDirectDebit(customerIdentifier, merchantWalletId, amount, transactionRef) {
    return this.processPayment({ amount, senderMobile: customerIdentifier, receiverAccount: merchantWalletId, id: transactionRef });
  }

  /**
   * محاكاة تنفيذ عملية الدفع
   * @param {Object} data - بيانات المعاملة
   * @returns {Promise<Object>} - نتيجة المعاملة المحاكية
   */
  async processPayment(data) {
    // محاكاة تأخير الشبكة
    await new Promise(resolve => setTimeout(resolve, 1000));

    // محاكاة فشل المعاملة إذا كان المبلغ 999 (لأغراض الاختبار)
    if (data.amount === 999) {
      return {
        success: false,
        errorCode: 'INSUFFICIENT_FUNDS',
        message: 'رصيد العميل غير كافٍ لإتمام المعاملة.'
      };
    }

    // محاكاة نجاح المعاملة
    return {
      success: true,
      providerRef: `MOCK-${Date.now()}`,
      message: 'تمت المعاملة التجريبية بنجاح.'
    };
  }
}

export default new MockBankAdapter();
