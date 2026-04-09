import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { PaymentAdapter } from './PaymentAdapter.js';

/**
 * محول بنك جوالي (Jawali Bank Adapter)
 * يتصل مع سيرفر البنك الذي يحاكي محفظة جوالي.
 * تم تحديثه ليعتمد على مسار B2B Direct Debit الخاص بالبوابات الموثوقة.
 *
 * A-03: يمدد PaymentAdapter لضمان اتساق الواجهة.
 * B-04: إصلاح حلقة التكرار اللانهائية عند فشل المصادقة.
 */
class JawaliAdapter extends PaymentAdapter {
  constructor() {
    super();
    this.apiUrl = process.env.JAWALI_API_URL || 'http://localhost:3001';
    this.callerId = 'AtheerSwitch';
    this.accessToken = null;
  }

  get providerName() {
    return 'JAWALI';
  }

  /**
   * دالة مساعدة لبناء هيكل الطلب المكون من header و body.
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
    if (!this.accessToken) {
      await this.login();
    }
  }

  /**
   * تنفيذ عملية خصم مباشر من حساب العميل إلى حساب التاجر.
   *
   * B-04 Fix: إضافة عداد محاولات (_retryCount) لمنع التكرار اللانهائي
   * عند فشل المصادقة. الحد الأقصى: محاولة واحدة لإعادة المصادقة.
   *
   * @param {string} customerPhone      - رقم هاتف العميل صاحب الحساب.
   * @param {string} merchantWalletId   - رقم محفظة التاجر المستفيد.
   * @param {number} amount             - المبلغ المطلوب خصمه.
   * @param {string} transactionRef     - الرقم المرجعي للعملية.
   * @param {number} [_retryCount=0]    - عداد المحاولات الداخلي (لا تمرره يدوياً).
   * @returns {Promise<Object>} - نتيجة العملية.
   */
  async executeDirectDebit(customerPhone, merchantWalletId, amount, transactionRef, _retryCount = 0) {
    await this.ensureAccessToken();

    const debitUrl = `${this.apiUrl}/api/v1/b2b/direct-debit`;
    const payload = this.buildPayload({
      customerIdentifier: customerPhone,
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
      // B-04 Fix: التعامل مع انتهاء صلاحية التوكن (محاولة واحدة فقط)
      if (error.response && error.response.status === 401 && _retryCount < 1) {
        console.log('[Jawali Adapter] Access token expired. Re-authenticating (attempt 1/1)...');
        this.accessToken = null;
        return this.executeDirectDebit(customerPhone, merchantWalletId, amount, transactionRef, _retryCount + 1);
      }

      console.error('[Jawali Direct Debit Error]', error.response?.data || error.message);
      return {
        success: false,
        errorCode: 'PROVIDER_CONNECTION_ERROR',
        message: 'Failed to connect to the payment provider.',
      };
    }
  }

  /**
   * تحويل P2P عبر Jawali (غير مدعوم حالياً — يُوجَّه إلى MockBank).
   */
  async p2pTransfer({ senderMobile, receiverMobile, amount }) {
    return {
      success: false,
      errorCode: 'NOT_SUPPORTED',
      message: 'P2P transfers are not supported by Jawali adapter. Use MockBank.',
    };
  }

  /**
   * معالجة عملية دفع عامة (Fallback).
   */
  async processPayment(data) {
    const { senderMobile, receiverAccount, amount, id } = data;
    return this.executeDirectDebit(senderMobile, receiverAccount, amount, id);
  }
}

export default new JawaliAdapter();
