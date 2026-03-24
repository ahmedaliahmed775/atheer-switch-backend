import Merchant from '../models/Merchant.js';

/**
 * Middleware للتحقق من هوية التاجر
 * يقوم بالتحقق من وجود مفتاح API صالح في ترويسات الطلب.
 */
export const authenticateMerchant = async (req, res, next) => {
  // التحقق هنا يخص فقط صاحب مفتاح الـ API (merchant)
  const apiKey = req.headers[process.env.API_KEY_HEADER || 'x-atheer-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'مفتاح الوصول (API Key) مفقود في ترويسات الطلب.'
    });
  }

  try {
    const merchant = await Merchant.findOne({ where: { apiKey, status: 'active' } });

    if (!merchant) {
      return res.status(403).json({
        success: false,
        message: 'مفتاح الوصول غير صالح أو تم إيقاف حساب التاجر.'
      });
    }

    // هوية المستلم المالي منفصلة وتحدد عبر receiverMobile في جسم الطلب
    req.merchant = merchant;
    next();
  } catch (error) {
    console.error('خطأ في التحقق من الهوية:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ داخلي أثناء التحقق من الهوية.'
    });
  }
};
