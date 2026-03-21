import statsService from '../services/statsService.js';

/**
 * متحكم الإحصائيات (Stats Controller)
 * يوفر إحصائيات المعاملات اللحظية لمزودي الخدمة.
 */
export const getProviderStats = async (req, res, next) => {
  const { provider } = req.params;

  try {
    // جلب الإحصائيات من Redis
    const stats = await statsService.getProviderStats(provider);

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('خطأ في جلب الإحصائيات:', error.message);
    next(error);
  }
};

/**
 * الحصول على إحصائيات جميع مزودي الخدمة المدعومين
 */
export const getAllStats = async (req, res, next) => {
  const providers = ['jawali', 'wecash', 'mock'];

  try {
    const allStats = await Promise.all(
      providers.map(p => statsService.getProviderStats(p))
    );

    return res.status(200).json({
      success: true,
      data: allStats
    });
  } catch (error) {
    next(error);
  }
};
