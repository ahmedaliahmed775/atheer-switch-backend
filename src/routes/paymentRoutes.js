import express from 'express';
import { processPayment, getTransactionStatus } from '../controllers/paymentController.js';
import { authenticateMerchant } from '../middlewares/auth.js';
import { checkIdempotency } from '../middlewares/idempotency.js';

const router = express.Router();

/**
 * مسارات المدفوعات (Payment Routes)
 * جميع المسارات تتطلب التحقق من هوية التاجر (API Key).
 */
router.use(authenticateMerchant);

/**
 * @route   POST /api/v1/payments/process
 * @desc    معالجة طلب دفع جديد من SDK
 * @access  Private (Merchant API Key)
 */
router.post('/process', checkIdempotency, processPayment);

/**
 * @route   GET /api/v1/payments/status/:id
 * @desc    التحقق من حالة معاملة معينة
 * @access  Private (Merchant API Key)
 */
router.get('/status/:id', getTransactionStatus);

export default router;
