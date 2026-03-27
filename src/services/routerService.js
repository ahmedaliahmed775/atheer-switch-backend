import jawaliAdapter from '../adapters/jawaliAdapter.js';
import mockBankAdapter from '../adapters/mockBankAdapter.js';
import statsService from './statsService.js';
import Merchant from '../models/Merchant.js';

/**
 * خدمة توجيه المعاملات (Router Service)
 * تقوم بتوجيه المعاملات إلى مزود الخدمة المناسب (مثل JEEB أو JAWALI)
 * بناءً على نوع المعاملة أو بيانات التاجر القادمة من الـ SDK.
 */
class RouterService {
  /**
   * توجيه المعاملة إلى مزود الخدمة المناسب
   * @param {Object} transaction - بيانات المعاملة
   * @returns {Promise<Object>} - نتيجة المعاملة من مزود الخدمة
   */
  async routeTransaction(transaction) {
    /**
     * 🚦 منطق التوجيه حسب نوع المعاملة:
     * - P2P: تحويل من رقم جوال الدافع إلى رقم جوال المستلم (receiverAccount)
     * - P2M: شراء من تاجر، البحث عن التاجر عبر receiverAccount (merchantId)
     */
    const { transactionType, amount, senderMobile, receiverAccount } = transaction;
    let adapter;
    let provider = 'MOCK'; // الافتراضي
    let routeResult;

    if (transactionType === 'P2P') {
      // تحويل بين الأفراد (من جوال إلى جوال)
      adapter = mockBankAdapter;
      // تنفيذ التحويل عبر دالة p2pTransfer
      routeResult = await adapter.p2pTransfer({
        senderMobile,
        receiverMobile: receiverAccount,
        amount
      });
      provider = 'MOCK';
    } else if (transactionType === 'P2M') {
      // شراء من تاجر
      // البحث عن التاجر عبر معرفه
      const merchant = await Merchant.findOne({ where: { id: receiverAccount } });
      if (!merchant) {
        return { success: false, message: 'لم يتم العثور على التاجر.' };
      }
      // تحديد مزود الخدمة من بيانات التاجر (يمكن التوسعة لاحقاً)
      provider = merchant.providerName || 'JAWALI'; // نفترض جوالي كافتراضي للتوافق
      
      // اختيار الأدابتر المناسب
      switch (provider.toUpperCase()) {
        case 'JAWALI':
          adapter = jawaliAdapter;
          // جلب رقم محفظة التاجر لدى المزود
          const merchantWalletId = merchant.providerWalletId;
          if (!merchantWalletId) {
            return { success: false, message: `لم يتم تسجيل رقم محفظة التاجر لدى ${provider}.` };
          }
          // تنفيذ عملية الخصم المباشر عبر الأدابتر المحدث
          routeResult = await adapter.executeDirectDebit(
            senderMobile,
            merchantWalletId,
            amount,
            transaction.id // تمرير معرف العملية كمرجع
          );
          break;
          
        case 'JEEB':
          adapter = mockBankAdapter; // لا يزال يستخدم المحول الوهمي
          routeResult = await adapter.processPayment({
            ...transaction,
            provider,
            merchantId: merchant.id
          });
          break;
          
        default:
          adapter = mockBankAdapter;
          routeResult = await adapter.processPayment({
            ...transaction,
            provider,
            merchantId: merchant.id
          });
      }
    } else {
      return { success: false, message: 'نوع المعاملة غير مدعوم.' };
    }

    // تحديث الإحصائيات اللحظية في Redis
    await statsService.incrementProviderStats(provider, amount, routeResult.success);

    return routeResult;
  }
}

export default new RouterService();
