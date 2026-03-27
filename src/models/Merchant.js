import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * نموذج التاجر (Merchant)
 * يمثل الجهة التي تستخدم بوابة Atheer Switch لاستقبال المدفوعات.
 */
const Merchant = sequelize.define('Merchant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    comment: 'المعرف الفريد للتاجر'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'اسم التاجر أو الشركة'
  },
  apiKey: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    comment: 'مفتاح الوصول الخاص بالتاجر للتحقق من الهوية'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended'),
    defaultValue: 'active',
    comment: 'حالة التاجر في النظام'
  },
  webhookUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'رابط التنبيهات لإرسال تحديثات المعاملات'
  },
  providerWalletId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'معرف محفظة التاجر لدى مزود الخدمة (البنك)'
  }
}, {
  tableName: 'merchants',
  comment: 'جدول بيانات التجار المسجلين في النظام'
});

export default Merchant;
