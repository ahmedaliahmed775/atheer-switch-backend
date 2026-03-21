import axios from 'axios';

/**
 * محول Jawali (Jawali Adapter)
 * يقوم بتحويل طلبات الدفع من تنسيق Atheer SDK إلى تنسيق Jawali/WeCash.
 * ينفذ عملية "PAYAG.ECOMMCASHOUT" (سحب نقدي للتجارة الإلكترونية).
 */
class JawaliAdapter {
  constructor() {
    this.apiUrl = process.env.JAWALI_API_URL;
    this.agentWallet = process.env.JAWALI_AGENT_WALLET;
    this.apiKey = process.env.JAWALI_API_KEY;
  }

  /**
   * تنفيذ عملية الدفع
   * @param {Object} data - بيانات المعاملة من SDK
   * @returns {Promise<Object>} - نتيجة المعاملة من Jawali
   */
  async processPayment(data) {
    try {
      // تحويل الحقول إلى تنسيق Jawali (PAYAG.ECOMMCASHOUT)
      const payload = {
        serviceCode: 'PAYAG.ECOMMCASHOUT',
        agentWallet: this.agentWallet,
        receiverMobile: data.customerMobile,
        amount: data.amount,
        currency: data.currency || 'YER',
        voucher: data.voucher || '', // رقم القسيمة إذا وجد
        externalRef: data.transactionId, // الرقم المرجعي الخاص بنا
        timestamp: new Date().toISOString()
      };

      // إرسال الطلب إلى Jawali API
      const response = await axios.post(`${this.apiUrl}/process`, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // مهلة 15 ثانية
      });

      // معالجة استجابة Jawali
      if (response.data && response.data.status === 'SUCCESS') {
        return {
          success: true,
          providerRef: response.data.transactionId,
          message: 'تمت عملية الدفع بنجاح عبر Jawali.'
        };
      } else {
        return {
          success: false,
          errorCode: response.data.errorCode || 'JAWALI_ERROR',
          message: response.data.errorMessage || 'فشلت المعاملة من قبل مزود الخدمة.'
        };
      }
    } catch (error) {
      console.error('خطأ في محول Jawali:', error.message);
      return {
        success: false,
        errorCode: 'PROVIDER_CONNECTION_ERROR',
        message: 'تعذر الاتصال بمزود خدمة Jawali حالياً.'
      };
    }
  }
}

export default new JawaliAdapter();
