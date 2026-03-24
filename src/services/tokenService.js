import OfflineToken from '../models/OfflineToken.js';
import { Op } from 'sequelize';

/**
 * خدمة إدارة التوكنز (Token Service)
 * تتعامل مع منطق البحث والتوزيع للتوكنز الأوفلاين.
 */
class TokenService {

    /**
     * التحقق من التوكن واستخدامه لمرة واحدة
     * @param {string} tokenValue - قيمة التوكن
     * @param {string} customerMobile - رقم هاتف الدافع
     * @returns {Promise<OfflineToken>} - التوكن بعد التحديث
     * @throws {Error} - في حال فشل التحقق أو انتهاء الصلاحية أو الاستخدام المسبق
     */
    async verifyAndUseToken(tokenValue, customerMobile) {
      // البحث عن التوكن بالحالة PROVISIONED
      const token = await OfflineToken.findOne({
        where: {
          tokenValue,
          status: 'PROVISIONED'
        }
      });
      if (!token) {
        throw new Error('التوكن غير صالح أو غير مفعّل');
      }
      // التأكد من أن التوكن مخصص لنفس رقم الهاتف
      if (token.assignedTo !== customerMobile) {
        throw new Error('رقم الهاتف لا يطابق صاحب التوكن');
      }
      // التأكد من عدم انتهاء الصلاحية
      if (token.expiryDate && new Date(token.expiryDate) < new Date()) {
        throw new Error('انتهت صلاحية التوكن');
      }
      // تحديث حالة التوكن إلى USED
      await token.update({ status: 'USED' });
      return token;
    }
  /**
   * توزيع التوكنز لعميل محدد
   * @param {string} providerName - اسم مزود المحفظة
   * @param {string} customerId - معرف العميل (رقم الهاتف أو المعرف)
   * @param {number} count - عدد التوكنز المطلوبة
   * @param {string} merchantId - معرف التاجر الطالب للتوكنز
   * @returns {Promise<Array>} - قائمة التوكنز المخصصة
   */
  async provisionTokens(providerName, customerId, count = 1, merchantId = null) {
    // البحث عن التوكنز المتاحة للمزود المحدد
    const tokens = await OfflineToken.findAll({
      where: {
        providerName: providerName,
        status: 'AVAILABLE',
        [Op.or]: [
          { expiryDate: null },
          { expiryDate: { [Op.gt]: new Date() } }
        ]
      },
      limit: count,
      order: [['createdAt', 'ASC']]
    });

    if (tokens.length === 0) {
      throw new Error(`لا توجد توكنز متاحة حالياً للمزود: ${providerName}`);
    }

    // تحديث حالة التوكنز لتصبح محجوزة للعميل
    const provisionedTokens = await Promise.all(
      tokens.map(async (token) => {
        return await token.update({
          status: 'PROVISIONED',
          assignedTo: customerId,
          merchantId: merchantId
        });
      })
    );

    return provisionedTokens.map(t => ({
      id: t.id,
      tokenValue: t.tokenValue,
      providerName: t.providerName,
      expiryDate: t.expiryDate
    }));
  }
}

export default new TokenService();
