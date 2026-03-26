import axios from 'axios';

class JawaliAdapter {
  constructor() {
    this.apiUrl = process.env.JAWALI_API_URL;
    this.merchantAccount = process.env.JAWALI_MERCHANT_ACCOUNT;
    this.sessionToken = null; 
  }

  // 1. تحديث مسار تسجيل الدخول ليتوافق مع المحفظة
  async login() {
    const loginUrl = `${this.apiUrl.replace(/\/+$/, '')}/api/v1/auth/login`;
    const credentials = {
      username: process.env.JAWALI_USERNAME,
      password: process.env.JAWALI_PASSWORD
    };
    try {
      const response = await axios.post(loginUrl, credentials, { timeout: 10000 });
      // المحفظة تعيد access_token بدلاً من SessionToken
      if (response.data && response.data.access_token) {
        this.sessionToken = response.data.access_token;
        return this.sessionToken;
      }
      throw new Error('فشل تسجيل الدخول لمحفظة جوالي: لم يتم استلام التوكن');
    } catch (error) {
      console.error('[Jawali Login Error]', error.message);
      throw error;
    }
  }

  async ensureSessionToken() {
    if (!this.sessionToken) {
      await this.login();
    }
  }

  // 2. تحديث مسار وهيكلة الدفع (Nested JSON)
  async processPayment(data) {
    try {
      await this.ensureSessionToken();
      const baseUrl = this.apiUrl.replace(/\/+$/, '');
      // توجيه الطلب للمسار الصحيح في المحفظة
      const fullUrl = `${baseUrl}/api/v1/merchant/switch-charge`;

      // بناء الطلب بالهيكلية المتداخلة التي يتوقعها السيرفر المحاكي (جوالي)
      const payload = {
        header: {
          msgId: `MSG-${Date.now()}`,
          timestamp: new Date().toISOString()
        },
body: {
          agentWallet: this.merchantAccount,
          receiverMobile: data.senderMobile,
          amount: data.amount,
          password: process.env.JAWALI_PASSWORD,
          accessToken: this.sessionToken, // <--- هذا هو السطر الجديد المطلوب
          refId: data.transactionRef || data.nonce || `SW-${Date.now()}`
        }
      };

      const response = await axios.post(fullUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`, // استخدام Bearer Token
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      // 3. فحص الاستجابة بناءً على كود "0000"
      if (response.data?.header?.responseCode === "0000") {
        return { 
          success: true, 
          providerRef: response.data.body?.txnId || payload.body.refId, 
          message: 'تمت العملية بنجاح.' 
        };
      }
      
      return { success: false, message: response.data?.body?.message || 'فشل تنفيذ العملية.' };
      
    } catch (error) {
      // إذا كان التوكن منتهي الصلاحية (401)، أعد تسجيل الدخول والمحاولة
      if (error.response && error.response.status === 401) {
        console.log('[Jawali Adapter] Token expired. Retrying login...');
        await this.login();
        return this.processPayment(data); // محاولة لمرة واحدة إضافية
      }

      console.error(`[ERROR] Jawali Adapter:`, error.response?.data || error.message);
      return { success: false, errorCode: 'CONNECTION_ERROR', message: 'فشل الاتصال بمزود المحفظة.' };
    }
  }
}

export default new JawaliAdapter();
