import axios from 'axios';


// Jawali Adapter الحقيقي مع توثيق SessionToken
class JawaliAdapter {
  constructor() {
    this.apiUrl = process.env.JAWALI_API_URL;
    this.merchantAccount = process.env.JAWALI_MERCHANT_ACCOUNT;
    this.sessionToken = null; // سيتم تحديثه بعد تسجيل الدخول
  }

  // تسجيل الدخول لجلب SessionToken (يجب تنفيذها عند بدء التشغيل أو عند انتهاء الجلسة)
  async login() {
    const loginUrl = `${this.apiUrl.replace(/\/+$/, '')}/api/v1/login`;
    const credentials = {
      username: process.env.JAWALI_USERNAME,
      password: process.env.JAWALI_PASSWORD
    };
    try {
      const response = await axios.post(loginUrl, credentials, { timeout: 10000 });
      if (response.data && response.data.SessionToken) {
        this.sessionToken = response.data.SessionToken;
        return this.sessionToken;
      }
      throw new Error('فشل تسجيل الدخول لمحفظة جوالي');
    } catch (error) {
      console.error('[Jawali Login Error]', error.message);
      throw error;
    }
  }

  async ensureSessionToken() {
    if (!this.sessionToken) {
      await this.login();
    }
    return this.sessionToken;
  }

  async processPayment(data) {
    try {
      await this.ensureSessionToken();
      const baseUrl = this.apiUrl.replace(/\/+$/, '');
      const fullUrl = `${baseUrl}/api/v1/ecommcashout`;

      // بناء الـ payload الرسمي
      const payload = {
        customer_mobile: data.senderMobile, // رقم العميل الدافع
        merchant_account: this.merchantAccount,
        amount: data.amount,
        currency: data.currency || 'YER',
        reference_number: data.transactionRef || data.nonce || `SW-${Date.now()}`,
        description: data.description || ''
      };

      const response = await axios.post(fullUrl, payload, {
        headers: {
          'SessionToken': this.sessionToken,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.status === 'SUCCESS') {
        return { success: true, providerRef: response.data.reference_number, message: 'تمت العملية.' };
      }
      // إذا انتهت الجلسة، أعد تسجيل الدخول وحاول مرة أخرى لمرة واحدة
      if (response.data && response.data.errorCode === 'INVALID_SESSION') {
        await this.login();
        return this.processPayment(data);
      }
      return { success: false, message: response.data.message || 'فشل تنفيذ العملية.' };
    } catch (error) {
      console.error(`[ERROR] Jawali Adapter: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
      return { success: false, errorCode: 'CONNECTION_ERROR', message: 'فشل الاتصال بمحفظة جوالي.' };
    }
  }
}

export default new JawaliAdapter();
