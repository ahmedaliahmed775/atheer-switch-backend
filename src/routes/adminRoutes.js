import express from 'express';
import { getProviderStats, getAllStats } from '../controllers/statsController.js';
import { requireAdminApiKey } from '../middlewares/adminAuth.js';

const router = express.Router();

/**
 * مسارات الإدارة (Admin Routes)
 * في الإنتاج: يتطلب ترويسة x-atheer-admin-key تساوي ADMIN_API_KEY.
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

export default router;
