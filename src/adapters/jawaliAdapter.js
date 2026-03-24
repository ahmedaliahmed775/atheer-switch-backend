import axios from 'axios';

class JawaliAdapter {
  constructor() {
    this.apiUrl = process.env.JAWALI_API_URL;
    this.agentWallet = process.env.JAWALI_AGENT_WALLET;
    this.apiKey = process.env.JAWALI_API_KEY;
  }

  async processPayment(data) {
    try {
      // تنظيف الرابط من أي مائلات زائدة
      const baseUrl = this.apiUrl.replace(/\/+$", "");
      const fullUrl = `${baseUrl}/wallet/p2p-transfer`;

      console.log(`[DEBUG] Calling Wallet URL: ${fullUrl}`);

      const payload = {
        amount: data.amount,
        senderMobile: data.customerMobile,
        receiverMobile: data.receiverMobile,
        nonce: data.nonce || `SW-${Date.now()}-${Math.random().toString(36).substring(5)}`
      };

      const response = await axios.post(fullUrl, payload, {
        headers: {
          'x-atheer-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.status === 'ACCEPTED') {
        // إصدار إشعار SMS للمستلم (إذا كان مدعوماً من المحفظة)
        return { success: true, providerRef: response.data.providerRef, message: 'تمت العملية.' };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      console.error(`[ERROR] Jawali Adapter: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
      return { success: false, errorCode: 'CONNECTION_ERROR', message: 'فشل الاتصال بالمحفظة.' };
    }
  }
}
export default new JawaliAdapter();
