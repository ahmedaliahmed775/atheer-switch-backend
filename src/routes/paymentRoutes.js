import express from 'express';
import { processPayment, getTransactionStatus } from '../controllers/paymentController.js';
import tokenController from '../controllers/tokenController.js';
import { authenticateMerchant } from '../middlewares/auth.js';
import { checkIdempotency } from '../middlewares/idempotency.js';

const router = express.Router();

/**
 * مسارات المدفوعات والتوكنز (Payment & Token Routes)
 * جميع المسارات تتطلب التحقق من هوية التاجر (API Key) عبر x-atheer-api-key.
 */
router.use(authenticateMerchant);

/**
 * @route   POST /api/v1/payments/process
 * @desc    معالجة طلب دفع جديد من SDK (يتوقع البيانات داخل body.body)
 * @access  Private (Merchant API Key)
 */
router.post('/process', checkIdempotency, processPayment);

/**
 * @route   POST /api/v1/payments/tokens/provision
 * @desc    طلب تخصيص توكنز أوفلاين لمزود معين (JEEB/JAWALI)
 * @access  Private (Merchant API Key)
 */
router.post('/tokens/provision', tokenController.requestTokens);

/**
 * @route   GET /api/v1/payments/status/:id
 * @desc    التحقق من حالة معاملة معينة
 * @access  Private (Merchant API Key)
 */
router.get('/status/:id', getTransactionStatus);

export default router;
