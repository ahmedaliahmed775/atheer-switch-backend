import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Merchant from './Merchant.js';

/**
 * نموذج التوكنز الأوفلاين (OfflineToken)
 * يمثل التوكنز التي يتم توزيعها للعملاء لاستخدامها لاحقاً في عمليات الدفع.
 */
const OfflineToken = sequelize.define('OfflineToken', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    comment: 'المعرف الفريد للتوكن'
  },
  tokenValue: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'قيمة التوكن الفعلية'
  },
  providerName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'اسم المحفظة المزودة للتوكن (مثل JEEB, JAWALI)'
  },
  status: {
    type: DataTypes.ENUM('AVAILABLE', 'PROVISIONED', 'USED'),
    defaultValue: 'AVAILABLE',
    comment: 'حالة التوكن في النظام'
  },
  assignedTo: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'معرف العميل الذي تم تخصيص التوكن له'
  },
  merchantId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: Merchant,
      key: 'id'
    },
    comment: 'معرف التاجر المرتبط بالتوزيع المباشر'
  },
  expiryDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'تاريخ انتهاء صلاحية التوكن'
  }
  ,
  publicKey: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'المفتاح العام المدعوم عتادياً للمستخدم (Hardware-backed public key)'
  }
}, {
  tableName: 'offline_tokens',
  comment: 'جدول تخزين وإدارة التوكنز الأوفلاين'
});

// تعريف العلاقات
Merchant.hasMany(OfflineToken, { foreignKey: 'merchantId' });
OfflineToken.belongsTo(Merchant, { foreignKey: 'merchantId' });

export default OfflineToken;
