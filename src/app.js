import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// استيراد المسارات والـ Middlewares
import paymentRoutes from './routes/paymentRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { adminRouter } from './admin/index.js';
import { errorHandler } from './middlewares/errorLogger.js';
import { rateLimiter } from './middlewares/rateLimiter.js';
import { systemStatusCheck } from './middlewares/systemStatus.js';
import redis from './config/redis.js';
import sequelize from './config/database.js';

// تحميل المتغيرات البيئية
dotenv.config();

const app = express();

/**
 * إعداد الـ Middlewares الأساسية
 * B-03 Fix: إزالة التكرار (كانت cors, json, morgan مسجلة مرتين)
 */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Rate Limiting عام لحماية جميع نقاط النهاية
app.use(rateLimiter);

// حالة النظام: يرفض الطلبات بـ 503 أثناء الصيانة
// المسارات المستثناة: /health, /switch-admin, /
app.use(systemStatusCheck);

// لوحة تحكم المقسم (AdminJS)
app.use('/switch-admin', adminRouter);

/**
 * A-05: نقطة فحص صحة النظام (Health Check)
 */
app.get('/health', async (req, res) => {
  const checks = {};

  try {
    await sequelize.authenticate();
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
  }

  const allOk = Object.values(checks).every(v => v === 'ok');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * تعريف المسارات الأساسية (Routes)
 */
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'مرحباً بك في بوابة Atheer Switch - نظام الدفع عالي الأداء.',
    version: '2.0.0'
  });
});

// مسارات المدفوعات (Atheer SDK)
app.use('/api/v1/payments', paymentRoutes);

// C-03: مسارات تسجيل الأجهزة
app.use('/api/v1/devices', deviceRoutes);

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
