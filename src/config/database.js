import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// تحميل المتغيرات البيئية
dotenv.config();

/**
 * إعداد الاتصال بقاعدة بيانات PostgreSQL
 * يتم استخدام Sequelize كـ ORM لإدارة العمليات على قاعدة البيانات
 */
const sequelize = new Sequelize(
  process.env.DB_NAME || 'atheer_switch',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false, // تعطيل سجلات الاستعلامات في بيئة الإنتاج لتحسين الأداء
    pool: {
      max: 20, // الحد الأقصى لعدد الاتصالات في المجمع
      min: 5,  // الحد الأدنى لعدد الاتصالات
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true, // إضافة createdAt و updatedAt تلقائياً
      underscored: true // استخدام snake_case لأسماء الأعمدة
    }
  }
);

// اختبار الاتصال بقاعدة البيانات
export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ تم الاتصال بقاعدة بيانات PostgreSQL بنجاح.');
  } catch (error) {
    console.error('❌ فشل الاتصال بقاعدة البيانات:', error.message);
    process.exit(1);
  }
};

export default sequelize;
