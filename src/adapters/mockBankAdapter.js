/**
 * محول تجريبي (Mock Bank Adapter)
 * يستخدم لاختبار النظام في بيئة التطوير دون الحاجة للاتصال بمزود خدمة حقيقي.
 */
class MockBankAdapter {
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
