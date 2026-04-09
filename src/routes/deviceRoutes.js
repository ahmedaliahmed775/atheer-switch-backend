import express from 'express';
import { enrollDevice } from '../controllers/deviceController.js';
import { authenticateMerchant } from '../middlewares/auth.js';

const router = express.Router();

/**
 * مسارات إدارة الأجهزة (Device Management Routes)
 * تتطلب التحقق من هوية التاجر عبر API Key.
 */
router.use(authenticateMerchant);

/**
 * @route   POST /api/v1/devices/enroll
 * @desc    تسجيل جهاز جديد واستلام الـ deviceSeed المشتق
 *          يجب استدعاؤها مرة واحدة عند أول تشغيل للتطبيق على جهاز جديد.
 * @body    { deviceId: string }
 * @access  Private (Merchant API Key)
 */
router.post('/enroll', enrollDevice);

export default router;
