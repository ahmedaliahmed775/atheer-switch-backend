import express from 'express';
import { getProviderStats, getAllStats } from '../controllers/statsController.js';
import { requireAdminApiKey } from '../middlewares/adminAuth.js';
import { setSystemStatus } from '../middlewares/systemStatus.js';
import redis from '../config/redis.js';

const router = express.Router();

/**
 * مسارات الإدارة (Admin Routes)
 * جميع المسارات تتطلب ترويسة x-atheer-admin-key تساوي ADMIN_API_KEY.
 */

router.use(requireAdminApiKey);

/**
 * @route   GET /api/v1/admin/stats/all
 * @desc    الحصول على إحصائيات جميع مزودي الخدمة
 * @access  Private (Admin Only)
 */
router.get('/stats/all', getAllStats);

/**
 * @route   GET /api/v1/admin/stats/:provider
 * @desc    الحصول على إحصائيات مزود خدمة معين
 * @access  Private (Admin Only)
 */
router.get('/stats/:provider', getProviderStats);

/**
 * @route   GET /api/v1/admin/system-status
 * @desc    قراءة حالة النظام الحالية
 * @access  Private (Admin Only)
 */
router.get('/system-status', async (req, res) => {
  try {
    const redisStatus = await redis.get('system:status');
    const envStatus = process.env.SYSTEM_STATUS || 'ACTIVE';
    const effectiveStatus = redisStatus || envStatus;

    res.status(200).json({
      success: true,
      data: {
        status: effectiveStatus,
        source: redisStatus ? 'redis' : 'env',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

/**
 * @route   POST /api/v1/admin/system-status
 * @desc    تبديل حالة النظام (ACTIVE / MAINTENANCE)
 * @body    { "status": "MAINTENANCE" } أو { "status": "ACTIVE" }
 * @access  Private (Admin Only)
 *
 * أمثلة:
 *   تفعيل الصيانة: curl -X POST -H "x-atheer-admin-key: KEY" -d '{"status":"MAINTENANCE"}'
 *   إعادة التشغيل:  curl -X POST -H "x-atheer-admin-key: KEY" -d '{"status":"ACTIVE"}'
 */
router.post('/system-status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        error: { message: 'حقل status مطلوب. القيم المسموحة: ACTIVE, MAINTENANCE' }
      });
    }

    const newStatus = await setSystemStatus(status);
    console.log(`🔄 تم تبديل حالة النظام إلى: ${newStatus} [بواسطة: ${req.ip}]`);

    res.status(200).json({
      success: true,
      data: {
        status: newStatus,
        message: newStatus === 'MAINTENANCE'
          ? 'تم تفعيل وضع الصيانة. لن تُقبل معاملات جديدة.'
          : 'تم تفعيل النظام. المعاملات مقبولة.'
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: { message: error.message } });
  }
});

export default router;
