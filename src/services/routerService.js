import jawaliAdapter from '../adapters/jawaliAdapter.js';
import mockBankAdapter from '../adapters/mockBankAdapter.js';
import statsService from './statsService.js';

/**
 * خدمة توجيه المعاملات (Router Service)
 * تقوم بتوجيه المعاملات إلى مزود الخدمة المناسب (Jawali أو WeCash)
 * بناءً على نوع المعاملة أو بيانات التاجر.
 */
class RouterService {
  /**
   * توجيه المعاملة إلى مزود الخدمة المناسب
   * @param {Object} transaction - بيانات المعاملة
   * @returns {Promise<Object>} - نتيجة المعاملة من مزود الخدمة
   */
  async routeTransaction(transaction) {
    const { provider, amount } = transaction;
    let adapter;

    // اختيار المحول المناسب بناءً على مزود الخدمة
    switch (provider.toLowerCase()) {
      case 'jawali':
      case 'wecash':
        adapter = jawaliAdapter;
        break;
      case 'mock':
        adapter = mockBankAdapter;
        break;
      default:
        throw new Error(`مزود الخدمة ${provider} غير مدعوم حالياً.`);
    }

    try {
      // تنفيذ عملية الدفع عبر المحول المختار
      const result = await adapter.processPayment(transaction);

      // تحديث الإحصائيات اللحظية في Redis
      await statsService.incrementProviderStats(provider, amount, result.success);

      return result;
    } catch (error) {
      console.error('خطأ في توجيه المعاملة:', error.message);
      // تحديث الإحصائيات كفشل في حال حدوث خطأ غير متوقع
      await statsService.incrementProviderStats(provider, amount, false);
      throw error;
    }
  }
}

export default new RouterService();
