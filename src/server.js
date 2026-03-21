import app from './app.js';
import { connectDB } from './config/database.js';
import sequelize from './config/database.js';
import dotenv from 'dotenv';

// تحميل المتغيرات البيئية
dotenv.config();

const PORT = process.env.PORT || 3000;

/**
 * بدء تشغيل خادم Atheer Switch
 * يتم أولاً الاتصال بقاعدة البيانات ومزامنة النماذج قبل بدء الاستماع للطلبات.
 */
const startServer = async () => {
  try {
    // 1. الاتصال بقاعدة بيانات PostgreSQL
    await connectDB();

    // 2. مزامنة نماذج Sequelize مع قاعدة البيانات
    // ملاحظة: في بيئة الإنتاج، يفضل استخدام Migrations بدلاً من sync({ alter: true })
    await sequelize.sync({ alter: false });
    console.log('✅ تمت مزامنة نماذج قاعدة البيانات بنجاح.');

    // 3. بدء الاستماع للطلبات على المنفذ المحدد
    app.listen(PORT, () => {
      console.log(`🚀 خادم Atheer Switch يعمل الآن على المنفذ: ${PORT}`);
      console.log(`🌍 البيئة الحالية: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ فشل بدء تشغيل الخادم:', error.message);
    process.exit(1);
  }
};

// معالجة الأخطاء غير المتوقعة (Unhandled Rejections)
process.on('unhandledRejection', (err) => {
  console.error('❌ خطأ غير معالج (Unhandled Rejection):', err.message);
  // إغلاق الخادم بشكل آمن في حال حدوث خطأ فادح
  process.exit(1);
});

startServer();
