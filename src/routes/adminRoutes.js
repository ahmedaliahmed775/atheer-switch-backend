import express from 'express';
import { getProviderStats, getAllStats } from '../controllers/statsController.js';

const router = express.Router();

/**
 * مسارات الإدارة (Admin Routes)
 * تستخدم لمراقبة أداء النظام وإحصائيات مزودي الخدمة.
 * ملاحظة: في بيئة الإنتاج، يجب حماية هذه المسارات بـ Middleware خاص بالإدارة.
 */

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
