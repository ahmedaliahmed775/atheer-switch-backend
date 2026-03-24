import tokenService from '../services/tokenService.js';

/**
 * متحكم التوكنز (Token Controller)
 * يستقبل طلبات الـ SDK لطلب التوكنز الأوفلاين ويتحقق من هوية التاجر.
 */
class TokenController {
  /**
   * معالجة طلب توزيع التوكنز مع دعم رفع المفتاح العام (publicKey) من الـ SDK
   * @param {Object} req - طلب الـ HTTP (يتوقع وجود بيانات التاجر من الميدل وير)
   * @param {Object} res - استجابة الـ HTTP
   */
  async requestTokens(req, res) {
    try {
      // فك تغليف البيانات من body.body كما هو مطلوب في المعمارية الجديدة
      const data = req.body.body || req.body;
      const { providerName, customerId, count, publicKey } = data;

      // التحقق من وجود الحقول المطلوبة
      if (!providerName || !customerId) {
        return res.status(400).json({
          status: 'error',
          message: 'يرجى تقديم providerName و customerId ضمن كائن body'
        });
      }

      // استدعاء خدمة التوزيع (تم التحقق من التاجر مسبقاً في الميدل وير)
      const merchantId = req.merchant ? req.merchant.id : null;

      // تمرير publicKey إلى خدمة التوزيع
      const provisionedTokens = await tokenService.provisionTokens(
        providerName,
        customerId,
        parseInt(count) || 1,
        merchantId,
        publicKey
      );

      // إرجاع الاستجابة بنجاح
      return res.status(200).json({
        status: 'success',
        message: `تم تخصيص ${provisionedTokens.length} توكنز بنجاح لمزود ${providerName}`,
        data: {
          tokens: provisionedTokens,
          customerId: customerId,
          provider: providerName
        }
      });
    } catch (error) {
      console.error('Error in requestTokens:', error);
      return res.status(500).json({
        status: 'error',
        message: error.message || 'حدث خطأ أثناء معالجة طلب التوكنز'
      });
    }
  }
}

export default new TokenController();
