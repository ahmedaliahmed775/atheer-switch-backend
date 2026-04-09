/**
 * A-03: واجهة موحدة (Base Class) لجميع محولات مزودي الدفع
 *
 * أي محول جديد (مثلاً: KreimiAdapter, UmFluusAdapter) يجب أن يمدد هذه الفئة
 * وينفذ جميع الدوال المطلوبة. هذا يضمن اتساق واجهة التعامل مع المزودين ويسهّل
 * إضافة محافظ بنكية جديدة مستقبلاً.
 *
 * @typedef {Object} PaymentResult
 * @property {boolean} success    - هل نجحت العملية؟
 * @property {string}  [providerRef] - الرقم المرجعي من المزود
 * @property {string}  [message]     - رسالة النتيجة
 * @property {string}  [errorCode]   - كود الخطأ (في حال الفشل)
 */
export class PaymentAdapter {
  /**
   * اسم المزود (يجب تجاوزه في كل محول فرعي).
   * @returns {string}
   */
  get providerName() {
    throw new Error('يجب تنفيذ providerName في المحول الفرعي.');
  }

  /**
   * تنفيذ خصم مباشر — عملية P2M (شخص لتاجر).
   * @param {string} customerIdentifier - معرف العميل (رقم هاتف أو معرف جهاز)
   * @param {string} merchantWalletId   - معرف محفظة التاجر لدى المزود
   * @param {number} amount             - المبلغ المطلوب خصمه
   * @param {string} transactionRef     - الرقم المرجعي للعملية
   * @returns {Promise<PaymentResult>}
   */
  async executeDirectDebit(customerIdentifier, merchantWalletId, amount, transactionRef) {
    throw new Error('يجب تنفيذ executeDirectDebit في المحول الفرعي.');
  }

  /**
   * تنفيذ تحويل بين أفراد — عملية P2P (شخص لشخص).
   * @param {{ senderMobile: string, receiverMobile: string, amount: number }} params
   * @returns {Promise<PaymentResult>}
   */
  async p2pTransfer({ senderMobile, receiverMobile, amount }) {
    throw new Error('يجب تنفيذ p2pTransfer في المحول الفرعي.');
  }

  /**
   * معالجة عملية دفع عامة (Fallback).
   * @param {Object} data - بيانات المعاملة
   * @returns {Promise<PaymentResult>}
   */
  async processPayment(data) {
    throw new Error('يجب تنفيذ processPayment في المحول الفرعي.');
  }
}
