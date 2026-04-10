import { PaymentAdapter } from './PaymentAdapter.js';

/**
 * محول بنك جيب (Jeeb Adapter)
 * Stub حالي — يُوجَّه إلى MockBank حتى يتم توفير API الحقيقي من بنك جيب.
 *
 * A-03: يمدد PaymentAdapter لضمان اتساق الواجهة.
 */
class JeebAdapter extends PaymentAdapter {
  get providerName() {
    return 'JEEB';
  }

  async executeDirectDebit(customerIdentifier, merchantWalletId, amount, transactionRef) {
    // محاكاة تأخير الشبكة
    await new Promise(resolve => setTimeout(resolve, 800));

    return {
      success: true,
      providerRef: `JEEB-${Date.now()}`,
      message: `تم تنفيذ خصم ${amount} YER بنجاح (Jeeb Stub).`,
    };
  }

  async p2pTransfer({ senderMobile, receiverMobile, amount }) {
    return {
      success: false,
      errorCode: 'NOT_SUPPORTED',
      message: 'P2P transfers غير مدعومة حالياً في محول جيب.',
    };
  }

  async processPayment(data) {
    const { senderMobile, receiverAccount, amount, id } = data;
    return this.executeDirectDebit(senderMobile, receiverAccount, amount, id);
  }
}

export default new JeebAdapter();
