# Atheer Switch: بوابة دفع عالية الأداء

![Atheer Switch Logo](https://via.placeholder.com/150x50?text=Atheer+Switch)

## مقدمة

**Atheer Switch** هي بوابة دفع متطورة وعالية الأداء تعمل كوسيط مالي بين تطبيقات الأندرويد (عبر Atheer Android SDK) ومزودي خدمات الدفع مثل Jawali. تعتمد البوابة على **محرك التحقق عديم الحالة (Stateless Anti-Replay Verification Engine)** الذي يستبدل نموذج التوكنز الأوفلاين القديم بنظام تحقق آمن وعالي الأداء.

## المعمارية الجديدة: Stateless Anti-Replay Verification Engine

### لماذا التحول من نموذج التوكنز؟

النموذج القديم كان يعتمد على توزيع توكنز أوفلاين وتخزينها في PostgreSQL، مما أدى إلى:
- **زيادة تعقيد الحالة (Stateful):** قاعدة البيانات تصبح نقطة فشل واحدة لكل عملية دفع.
- **عرضة للسرقة:** التوكنز المُخزَّنة يمكن إعادة استخدامها عند اختراق قاعدة البيانات.
- **تدهور الأداء:** كل طلب يتطلب I/O إلى قاعدة البيانات للبحث عن التوكن.

### كيف يعمل المحرك الجديد؟

```
SDK                          Atheer Switch Backend
 |                                   |
 |  POST /api/v1/payments/charge     |
 |  { DeviceID, Counter, Challenge,  |
 |    Signature, amount, ... }       |
 |---------------------------------->|
 |                        [antiReplay Middleware]
 |                        Redis: GET device:counter:{DeviceID}
 |                        if Counter <= last_counter → 403 REJECTED
 |                        else: SET device:counter:{DeviceID} = Counter
 |                                   |
 |                        [paymentController]
 |                        deviceSeed = HMAC-SHA256(MASTER_SEED, DeviceID)
 |                        LUK = HMAC-SHA256(deviceSeed, Counter)
 |                        publicKey = Ed25519.derivePublic(LUK)
 |                        verify(Signature, "DeviceID|Counter|Challenge", publicKey)
 |                        if invalid → 401 + log SecurityFailure in PostgreSQL
 |                                   |
 |                        [jawaliAdapter]
 |                        POST /b2b/direct-debit → Jawali Bank
 |                                   |
 |                        [Transaction Log]
 |                        PostgreSQL: INSERT (Success/Failure)
 |<----------------------------------|
 |  200 { transactionId, providerRef }
```

### مكونات النظام الأمني

| المكوِّن | التقنية | الوظيفة |
| :------- | :------ | :------ |
| Anti-Replay Firewall | Redis (Lua Atomic Script) | يرفض أي طلب بعداد ≤ آخر عداد مسجَّل لنفس الجهاز |
| LUK Reconstruction | HMAC-SHA256 | يشتق مفتاح فريد لكل معاملة من seed الجهاز والعداد |
| Signature Verification | Ed25519 | يتحقق من توقيع الحِمل `DeviceID\|Counter\|Challenge` |
| Immutable Audit Log | PostgreSQL | يسجِّل جميع المعاملات بما فيها الفشل الأمني |

## الميزات الأساسية

- **معمارية عديمة الحالة (Stateless):** لا حاجة لتخزين حالة التوكن — Redis فقط للعداد.
- **حماية قوية من إعادة التشغيل:** رفض ذري لأي طلب بعداد قديم أو مكرر.
- **مفاتيح محدودة الاستخدام (LUK):** كل معاملة تستخدم مفتاحاً تشفيرياً فريداً مشتقاً من العداد.
- **توجيه المعاملات الذكي:** P2M عبر jawaliAdapter، P2P عبر mockBankAdapter.
- **تدقيق دائم لا يمكن تغييره:** سجل PostgreSQL لكل معاملة ناجحة أو محاولة اختراق.
- **هندسة معمارية نظيفة:** Clean Architecture قابلة للتوسع.

## المتطلبات المسبقة

- [Docker](https://www.docker.com/get-started) و [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js](https://nodejs.org/en/download/) (الإصدار 20 أو أحدث)

## البدء السريع

### 1. استنساخ المستودع

```bash
git clone https://github.com/your-username/atheer-switch.git
cd atheer-switch
```

### 2. إعداد المتغيرات البيئية

```bash
cp .env.example .env
```

قم بتعديل ملف `.env` بالقيم المناسبة. **المتغيرات الأساسية للمحرك الجديد:**

```
PORT=3000
NODE_ENV=development

DB_HOST=postgres
DB_PORT=5432
DB_NAME=atheer_switch
DB_USER=postgres
DB_PASS=postgres_password

REDIS_HOST=redis
REDIS_PORT=6379

JAWALI_API_URL=https://api.jawali.com/v1
JAWALI_GATEWAY_ID=YOUR_GATEWAY_ID
JAWALI_GATEWAY_SECRET=YOUR_GATEWAY_SECRET

# محرك Anti-Replay — hex string عشوائي طوله 64 حرفاً (32 بايت)
DEVICE_MASTER_SEED=your_64_char_hex_secret_here

API_KEY_HEADER=x-atheer-api-key
```

> **تحذير أمني:** `DEVICE_MASTER_SEED` هو سر المنظومة الأمنية بأكملها. احتفظ به بسرية تامة وقم بتدويره دورياً.

### 3. تشغيل الخدمات

```bash
docker-compose up --build
```

الخادم سيكون متاحاً على `http://localhost:3000`.

## هيكل المشروع

```
atheer-switch/
├── src/
│   ├── config/             # إعدادات قاعدة البيانات و Redis
│   │   ├── database.js
│   │   └── redis.js
│   ├── middlewares/        # Middleware للمصادقة، Anti-Replay، ومعالجة الأخطاء
│   │   ├── antiReplay.js   # 🆕 جدار الحماية من هجمات إعادة التشغيل
│   │   ├── auth.js
│   │   ├── idempotency.js
│   │   └── errorLogger.js
│   ├── services/           # منطق الأعمال الأساسي
│   │   ├── routerService.js
│   │   └── statsService.js
│   ├── adapters/           # محولات مزودي الدفع
│   │   ├── jawaliAdapter.js
│   │   └── mockBankAdapter.js
│   ├── controllers/        # معالجة الطلبات والاستجابات
│   │   ├── paymentController.js  # 🔄 محرك التحقق عديم الحالة
│   │   └── statsController.js
│   ├── models/             # نماذج PostgreSQL (Sequelize)
│   │   ├── Transaction.js  # سجل التدقيق الدائم
│   │   └── Merchant.js
│   ├── utils/
│   │   └── cryptoUtils.js  # 🔄 reconstructLUK + verifyEd25519Signature
│   ├── routes/
│   │   ├── paymentRoutes.js  # 🔄 /charge (جديد) + /process + /status
│   │   └── adminRoutes.js
│   ├── app.js
│   └── server.js
├── docs/
│   └── API_SPEC_AR.md      # 🔄 توثيق API المحدَّث
├── .env.example
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## استخدام API

### نقطة النهاية الرئيسية: `/api/v1/payments/charge`

```http
POST /api/v1/payments/charge
x-atheer-api-key: <merchant_api_key>
Content-Type: application/json

{
  "DeviceID": "DEVICE-UNIQUE-ID-001",
  "Counter": 42,
  "Challenge": "ch_a1b2c3d4e5f6",
  "Signature": "BASE64_ED25519_SIGNATURE",
  "amount": 1500.00,
  "receiverAccount": "uuid-of-merchant",
  "transactionType": "P2M",
  "currency": "YER"
}
```

يرجى الرجوع إلى [API_SPEC_AR.md](docs/API_SPEC_AR.md) للتوثيق الكامل.

## المساهمة

نرحب بالمساهمات. يرجى قراءة إرشادات المساهمة قبل تقديم طلبات السحب (Pull Requests).

## الترخيص

هذا المشروع مرخص تحت ترخيص MIT.

## اتصل بنا

