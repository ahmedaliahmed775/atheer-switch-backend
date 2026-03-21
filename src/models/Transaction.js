import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Merchant from './Merchant.js';

/**
 * نموذج المعاملة (Transaction)
 * يمثل سجل الحركة المالية في بوابة Atheer Switch.
 */
const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    comment: 'المعرف الفريد للمعاملة'
  },
  merchantId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Merchant,
      key: 'id'
    },
    comment: 'معرف التاجر صاحب المعاملة'
  },
  nonce: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'قيمة فريدة لمنع تكرار الطلب (Idempotency Key)'
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    comment: 'قيمة المعاملة المالية'
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'YER',
    comment: 'العملة المستخدمة (مثل YER أو USD)'
  },
  provider: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'مزود الخدمة (مثل Jawali أو WeCash)'
  },
  providerRef: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'الرقم المرجعي من مزود الخدمة'
  },
  status: {
    type: DataTypes.ENUM('pending', 'success', 'failed', 'reversed'),
    defaultValue: 'pending',
    comment: 'حالة المعاملة الحالية'
  },
  customerMobile: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'رقم هاتف العميل'
  },
  errorCode: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'رمز الخطأ في حال فشل المعاملة'
  },
  errorMessage: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'رسالة الخطأ باللغة العربية'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'بيانات إضافية متعلقة بالمعاملة'
  }
}, {
  tableName: 'transactions',
  comment: 'جدول سجل المعاملات المالية'
});

// تعريف العلاقات
Merchant.hasMany(Transaction, { foreignKey: 'merchantId' });
Transaction.belongsTo(Merchant, { foreignKey: 'merchantId' });

export default Transaction;
