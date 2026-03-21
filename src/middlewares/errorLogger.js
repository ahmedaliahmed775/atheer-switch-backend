import winston from 'winston';

/**
 * إعداد سجلات الأخطاء (Winston Logger)
 * يتم تسجيل الأخطاء في ملفات منفصلة حسب المستوى.
 */
const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// إضافة سجلات للكونسول في بيئة التطوير
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

/**
 * Middleware لمعالجة الأخطاء العامة
 * يقوم بتسجيل الخطأ وإرجاع استجابة JSON موحدة باللغة العربية.
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'حدث خطأ داخلي غير متوقع في النظام.';

  // تسجيل الخطأ في السجلات
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    merchantId: req.merchant ? req.merchant.id : 'unknown'
  });

  // إرجاع استجابة موحدة للعميل
  res.status(statusCode).json({
    success: false,
    error: {
      code: statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST',
      message: message,
      timestamp: new Date().toISOString()
    }
  });
};

export default logger;
