import redis from '../config/redis.js';

/**
 * خدمة الإحصائيات (Stats Service)
 * تقوم بتسجيل وتحديث إحصائيات المعاملات اللحظية في Redis.
 * تستخدم لتوفير لوحة تحكم فورية لشركات الاتصالات ومزودي الخدمة.
 */
class StatsService {
  /**
   * تحديث إحصائيات مزود الخدمة
   * @param {string} provider - اسم مزود الخدمة (مثل jawali)
   * @param {number} amount - قيمة المعاملة
   * @param {boolean} isSuccess - هل نجحت المعاملة؟
   */
  async incrementProviderStats(provider, amount, isSuccess) {
    const keyPrefix = `stats:${provider.toLowerCase()}`;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
      const pipeline = redis.pipeline();

      // زيادة إجمالي عدد المحاولات
      pipeline.incr(`${keyPrefix}:total_count`);
      pipeline.incr(`${keyPrefix}:daily_count:${today}`);

      if (isSuccess) {
        // زيادة عدد المعاملات الناجحة
        pipeline.incr(`${keyPrefix}:success_count`);
        // زيادة إجمالي حجم المبالغ (Volume)
        pipeline.incrbyfloat(`${keyPrefix}:total_volume`, amount);
        pipeline.incrbyfloat(`${keyPrefix}:daily_volume:${today}`, amount);
      } else {
        // زيادة عدد المعاملات الفاشلة
        pipeline.incr(`${keyPrefix}:failed_count`);
      }

      await pipeline.exec();
    } catch (error) {
      console.error('خطأ في تحديث الإحصائيات:', error.message);
    }
  }

  /**
   * الحصول على الإحصائيات الحالية لمزود خدمة
   * @param {string} provider - اسم مزود الخدمة
   * @returns {Promise<Object>} - بيانات الإحصائيات
   */
  async getProviderStats(provider) {
    const keyPrefix = `stats:${provider.toLowerCase()}`;
    const today = new Date().toISOString().split('T')[0];

    const [total, success, failed, volume, dailyVolume] = await Promise.all([
      redis.get(`${keyPrefix}:total_count`),
      redis.get(`${keyPrefix}:success_count`),
      redis.get(`${keyPrefix}:failed_count`),
      redis.get(`${keyPrefix}:total_volume`),
      redis.get(`${keyPrefix}:daily_volume:${today}`)
    ]);

    return {
      provider,
      totalCount: parseInt(total || 0),
      successCount: parseInt(success || 0),
      failedCount: parseInt(failed || 0),
      totalVolume: parseFloat(volume || 0),
      dailyVolume: parseFloat(dailyVolume || 0),
      successRate: total > 0 ? ((success / total) * 100).toFixed(2) + '%' : '0%'
    };
  }
}

export default new StatsService();
