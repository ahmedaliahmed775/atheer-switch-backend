import express from 'express';
import { chargePayment, processPayment, getTransactionStatus } from '../controllers/paymentController.js';
import { authenticateMerchant } from '../middlewares/auth.js';
import { checkIdempotency } from '../middlewares/idempotency.js';
import { antiReplayCheck } from '../middlewares/antiReplay.js';

const router = express.Router();

/**
 * مسارات المدفوعات (Payment Routes)
 * جميع المسارات تتطلب التحقق من هوية التاجر (API Key) عبر x-atheer-api-key.
 */
router.use(authenticateMerchant);

/**
 * @route   POST /api/v1/payments/charge
 * @desc    معالجة طلب دفع بنظام التحقق عديم الحالة (Stateless Anti-Replay)
 *          يتوقع: DeviceID, Counter, Challenge, Signature, amount, receiverAccount, transactionType
 * @access  Private (Merchant API Key)
 */
router.post('/charge', antiReplayCheck, chargePayment);

/**
 * @route   POST /api/v1/payments/process
 * @desc    نقطة نهاية متوافقة مع الإصدارات السابقة — تستخدم نفس منطق /charge
 * @access  Private (Merchant API Key)
 */
router.post('/process', antiReplayCheck, processPayment);

/**
 * @route   GET /api/v1/payments/status/:id
 * @desc    التحقق من حالة معاملة معينة
 * @access  Private (Merchant API Key)
 */
router.get('/status/:id', getTransactionStatus);

export default router;
