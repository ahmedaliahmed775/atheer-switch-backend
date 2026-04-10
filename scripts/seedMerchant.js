/**
 * إنشاء تاجر تجريبي لاختبار النظام E2E.
 *
 * التشغيل:
 *   node scripts/seedMerchant.js
 *
 * أو مع تخصيص:
 *   SEED_MERCHANT_NAME="متجر تجريبي" SEED_MERCHANT_PHONE="711222333" node scripts/seedMerchant.js
 */
import 'dotenv/config';
import sequelize from '../src/config/database.js';
import Merchant from '../src/models/Merchant.js';

async function main() {
  const apiKey = process.env.WALLET_MERCHANT_API_KEY || process.env.SEED_MERCHANT_API_KEY || 'AtheerSecretKey2026!';
  const name = process.env.SEED_MERCHANT_NAME || 'تاجر أثير التجريبي';
  const phone = process.env.SEED_MERCHANT_PHONE || '711222333';
  const providerWalletId = process.env.SEED_MERCHANT_WALLET || '888888888';
  const providerName = process.env.SEED_MERCHANT_PROVIDER || 'JAWALI';

  console.log('─── Atheer Merchant Seeder ───');
  console.log(`  الاسم: ${name}`);
  console.log(`  الهاتف: ${phone}`);
  console.log(`  المحفظة: ${providerWalletId}`);
  console.log(`  المزود: ${providerName}`);
  console.log(`  API Key: ${apiKey.substring(0, 8)}...`);
  console.log('');

  await sequelize.authenticate();
  console.log('✅ اتصال قاعدة البيانات ناجح.');

  // مزامنة الجداول (إنشاء إذا لم تكن موجودة)
  await sequelize.sync({ alter: false });
  console.log('✅ تمت مزامنة الجداول.');

  const [merchant, created] = await Merchant.findOrCreate({
    where: { apiKey },
    defaults: {
      name,
      phone,
      providerWalletId,
      providerName,
      status: 'active'
    }
  });

  if (!created) {
    await merchant.update({
      name,
      phone,
      providerWalletId,
      providerName,
      status: 'active'
    });
  }

  console.log('');
  console.log(created ? '✅ تم إنشاء التاجر بنجاح.' : '✅ التاجر موجود — تم تحديث بياناته.');
  console.log(`   المعرف (UUID): ${merchant.id}`);
  console.log(`   الاسم: ${merchant.name}`);
  console.log(`   الهاتف: ${merchant.phone}`);
  console.log(`   المحفظة: ${merchant.providerWalletId}`);
  console.log(`   الحالة: ${merchant.status}`);
  console.log('');
  console.log('─── اكتملت العملية ───');

  await sequelize.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ فشل:', err.message);
  process.exit(1);
});
