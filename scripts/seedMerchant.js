/**
 * إنشاء أو تحديث تاجر (Merchant) لمفتاح API يطابق خادم المحفظة (WALLET_API_KEY).
 * التشغيل مرة واحدة بعد النشر:
 *   WALLET_MERCHANT_API_KEY="نفس_قيمة_WALLET_API_KEY_في_المحفظة" node scripts/seedMerchant.js
 */
import 'dotenv/config';
import sequelize from '../src/config/database.js';
import Merchant from '../src/models/Merchant.js';

async function main() {
  const apiKey = process.env.WALLET_MERCHANT_API_KEY || process.env.SEED_MERCHANT_API_KEY;
  if (!apiKey || String(apiKey).length < 16) {
    console.error(
      '❌ عيّن WALLET_MERCHANT_API_KEY (نفس القيمة السرية لـ WALLET_API_KEY في خادم المحفظة، 16 حرفاً على الأقل).'
    );
    process.exit(1);
  }

  const name = process.env.SEED_MERCHANT_NAME || 'محفظة أثير (Wallet Provider)';

  await sequelize.authenticate();
  const [merchant, created] = await Merchant.findOrCreate({
    where: { apiKey },
    defaults: { name, status: 'active' }
  });

  if (!created) {
    await merchant.update({ name, status: 'active' });
  }

  console.log(created ? '✅ تم إنشاء التاجر.' : '✅ التاجر موجود؛ تم تحديث الاسم والحالة.');
  console.log('   المعرف:', merchant.id);
  await sequelize.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ فشل:', err.message);
  process.exit(1);
});
