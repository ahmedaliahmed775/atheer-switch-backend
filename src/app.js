import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// استيراد المسارات والـ Middlewares
import paymentRoutes from './routes/paymentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { adminRouter } from './admin/index.js';
import { errorHandler } from './middlewares/errorLogger.js';

// تحميل المتغيرات البيئية
dotenv.config();

const app = express();

/**
 * إعداد الـ Middlewares الأساسية
 */

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(cors());   // السماح بالطلبات من نطاقات مختلفة
app.use(express.json()); // معالجة بيانات JSON في الطلبات
app.use(morgan('dev'));  // تسجيل الطلبات في الكونسول (Logging)

// لوحة تحكم المقسم (AdminJS) - يجب أن تسبق أي errorHandler أو مسارات متعارضة
app.use('/switch-admin', adminRouter);

/**
 * تعريف المسارات الأساسية (Routes)
 */
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'مرحباً بك في بوابة Atheer Switch - نظام الدفع عالي الأداء.',
    version: '1.0.0'
  });
});

// مسارات المدفوعات (Atheer SDK)
app.use('/api/v1/payments', paymentRoutes);

// مسارات الإدارة والإحصائيات
app.use('/api/v1/admin', adminRoutes);

/**
 * معالجة المسارات غير الموجودة (404)
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'المسار المطلوب غير موجود.'
  });
});

/**
 * Middleware لمعالجة الأخطاء العامة
 */
app.use(errorHandler);

export default app;
