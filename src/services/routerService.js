import jawaliAdapter from '../adapters/jawaliAdapter.js';
import mockBankAdapter from '../adapters/mockBankAdapter.js';
import statsService from './statsService.js';

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
    const { provider, amount } = transaction;
    let adapter;

    // اختيار المحول المناسب بناءً على اسم مزود الخدمة (providerName)
    // يدعم النظام حالياً محافظ 'JEEB' و 'JAWALI' عبر نظام الأدابترز
    switch (provider.toUpperCase()) {
      case 'JAWALI':
      case 'WECASH':
        adapter = jawaliAdapter;
        break;
      case 'JEEB':
        // حالياً يتم استخدام محول تجريبي لـ JEEB، يمكن استبداله لاحقاً بأدابتر حقيقي
        adapter = mockBankAdapter; 
        break;
      case 'MOCK':
        adapter = mockBankAdapter;
        break;
      default:
        // التوجيه الافتراضي للمحافظ الجديدة غير المعروفة للمحول التجريبي
        console.warn(`مزود الخدمة ${provider} غير معرف بشكل صريح، يتم التوجيه للمحول التجريبي.`);
        adapter = mockBankAdapter;
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
