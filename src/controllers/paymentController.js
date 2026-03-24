import Transaction from '../models/Transaction.js';
import routerService from '../services/routerService.js';

export const processPayment = async (req, res, next) => {
  try {
    const data = req.body.body || req.body;
    const { amount, currency, provider, customerMobile, nonce, metadata } = data;
    
    // نستخدم الرقم 888888888 كقيمة ثابتة لضمان تجاوز الـ Validation
    const merchantId = req.merchant.id;

    const transaction = await Transaction.create({
      merchantId,
      amount,
      currency: currency || 'YER',
      provider,
      customerMobile,
      nonce,
      status: 'pending',
      metadata
    });

    const result = await routerService.routeTransaction({
      transactionId: transaction.id,
      amount,
      currency,
      provider,
      customerMobile,
      metadata
    });

    if (result.success) {
      await transaction.update({ status: 'success', providerRef: result.providerRef });
      return res.status(200).json({
        success: true,
        data: { transactionId: transaction.id, status: 'success', providerRef: result.providerRef }
      });
    } else {
      await transaction.update({ status: 'failed', errorMessage: result.message });
      return res.status(400).json({ success: false, error: { message: result.message } });
    }
  } catch (error) {
    console.error('❌ Critical Error:', error.message);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getTransactionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findOne({ where: { id } });
    if (!transaction) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
};
