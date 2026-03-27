import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

/**
 * محول بنك جوالي (Jawali Bank Adapter)
 * يتصل مع سيرفر البنك الوهمي الذي يحاكي محفظة جوالي.
 * تم تحديثه ليعتمد على مسار B2B Direct Debit الخاص بالبوابات الموثوقة.
 */
class JawaliAdapter {
  constructor() {
    this.apiUrl = process.env.JAWALI_API_URL || 'http://localhost:3001';
    this.callerId = 'AtheerSwitch'; // معرف المتصل (السويتش)
    this.accessToken = null; // توكن المصادقة الخاص بالسويتش مع البنك
  }

  /**
   * دالة مساعدة لبناء هيكل الطلب المكون من header و body.
   * @param {object} bodyData - البيانات التي سيتم إرسالها في الـ body.
   * @returns {object} - الطلب الجاهز للإرسال.
   */
  buildPayload(bodyData) {
    return {
      header: {
        messageContext: this.callerId,
        messageId: uuidv4(),
        messageTimestamp: new Date().toISOString(),
        callerId: this.callerId,
      },
      body: bodyData,
    };
  }

  /**
   * تسجيل دخول السويتش إلى نظام البنك للحصول على توكن.
   */
  async login() {
    const loginUrl = `${this.apiUrl}/api/v1/auth/trusted-gateway-login`;
    const payload = this.buildPayload({
      gatewayId: process.env.JAWALI_GATEWAY_ID,
      gatewaySecret: process.env.JAWALI_GATEWAY_SECRET,
    });

    try {
      const response = await axios.post(loginUrl, payload, { timeout: 15000 });
      if (response.data?.body?.access_token) {
        this.accessToken = response.data.body.access_token;
        console.log('[Jawali Adapter] Login successful. Token obtained.');
        return this.accessToken;
      }
      throw new Error('Jawali Login Failed: Token not received.');
    } catch (error) {
      console.error('[Jawali Login Error]', error.response?.data || error.message);
      throw new Error('Could not authenticate with Jawali Bank.');
    }
  }

  /**
   * يضمن أن السويتش لديه توكن صالح قبل إرسال أي طلب.
   */
  async ensureAccessToken() {
    // ملاحظة: في بيئة حقيقية، يجب التحقق من صلاحية التوكن قبل إعادة استخدامه.
    // هنا، للتبسيط، سنسجل الدخول مرة واحدة فقط.
    if (!this.accessToken) {
      await this.login();
    }
  }

  /**
   * تنفيذ عملية خصم مباشر من حساب العميل إلى حساب التاجر.
   * @param {string} customerPhone - رقم هاتف العميل صاحب الحساب.
   * @param {string} merchantWalletId - رقم محفظة التاجر المستفيد.
   * @param {number} amount - المبلغ المطلوب خصمه.
   * @param {string} transactionRef - الرقم المرجعي للعملية.
   * @returns {Promise<object>} - نتيجة العملية.
   */
  async executeDirectDebit(customerPhone, merchantWalletId, amount, transactionRef) {
    await this.ensureAccessToken();

    const debitUrl = `${this.apiUrl}/api/v1/b2b/direct-debit`;
    const payload = this.buildPayload({
      customerIdentifier: customerPhone, // يتم فك تشفيره والتحقق منه داخل السويتش
      targetWalletId: merchantWalletId,
      amount: amount,
      transactionRef: transactionRef || uuidv4(),
      description: `Payment via Atheer Switch for transaction ${transactionRef}`,
    });

    try {
      const response = await axios.post(debitUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      });

      // التحقق من نجاح العملية بناءً على استجابة البنك
      if (response.data?.body?.status === 'SUCCESS') {
        return {
          success: true,
          providerRef: response.data.body.transactionId,
          message: response.data.body.message || 'Direct debit executed successfully.',
        };
      } else {
        return {
          success: false,
          message: response.data?.body?.message || 'Direct debit failed at the bank.',
          providerError: response.data?.body?.errorCode,
        };
      }
    } catch (error) {
      // التعامل مع أخطاء الشبكة أو انتهاء صلاحية التوكن
      if (error.response && error.response.status === 401) {
        console.log('[Jawali Adapter] Access token expired or invalid. Re-authenticating...');
        this.accessToken = null; // إجبار إعادة تسجيل الدخول
        return this.executeDirectDebit(customerPhone, merchantWalletId, amount, transactionRef);
      }

      console.error('[Jawali Direct Debit Error]', error.response?.data || error.message);
      return {
        success: false,
        errorCode: 'PROVIDER_CONNECTION_ERROR',
        message: 'Failed to connect to the payment provider.',
      };
    }
  }
}

export default new JawaliAdapter();
