# Atheer Switch: بوابة دفع عالية الأداء

![Atheer Switch Logo](https://via.placeholder.com/150x50?text=Atheer+Switch)

Atheer Switch Backendخادم التحويل والمدفوعات لمنظومة AtheerAtheer Switch Backend هو خادم Node.js/Express مسؤول عن استقبال طلبات الدفع من تطبيقات Android التي تستخدم Atheer SDK، والتحقق من صحتها أمنيًا، ثم توجيهها إلى مزودي الدفع المناسبين، مع حفظ سجل كامل للعمليات داخل قاعدة البيانات.هذا المستودع يمثل العنصر المركزي في المنظومة، لأنه يربط بين:تطبيق التاجر أو الجهاز الطرفي.Atheer Android SDK على جهاز المستخدم.مزودي الدفع الخارجيين مثل Jawali أو غيره.طبقة التخزين والسجل التدقيقي.ما الذي يفعله هذا النظام؟الخادم يقوم بالمهام التالية:استقبال طلبات الدفع من الـ SDK.التحقق من هوية التاجر عبر مفتاح API.التحقق من سلامة التوقيع والبيانات القادمة من الجهاز.منع إعادة الإرسال أو التكرار باستخدام آلية Counter + Redis.إعادة بناء المفتاح المحدود الاستخدام LUK للتحقق من صحة الحمولة.توجيه الطلب إلى مزود الدفع المناسب.حفظ كل عملية في قاعدة البيانات.توفير لوحة إدارة ومراقبة للعمليات والـ Merchants.البنية العامةيتكون المشروع من عدة طبقات مترابطة:Routes: لتعريف المسارات HTTP.Controllers: لمعالجة منطق الطلبات.Middlewares: للأمان، المصادقة، ومنع التكرار.Services: لتنسيق التوجيه وإدارة المنطق المشترك.Adapters: للتكامل مع مزودي الدفع المختلفين.Models: لتمثيل البيانات في قاعدة PostgreSQL.Utils: لدوال التشفير والتحقق.Admin: لإدارة النظام من خلال واجهة AdminJS.هيكل المجلداتsrc/
├── adapters/        # تكاملات مزودي الدفع
├── admin/           # إعدادات لوحة الإدارة
├── config/          # إعدادات قاعدة البيانات وRedis
├── controllers/     # منطق المعالجة الرئيسية
├── middlewares/     # المصادقة، منع التكرار، تسجيل الأخطاء
├── models/          # نماذج Sequelize
├── routes/          # تعريف المسارات
├── services/        # منطق التوجيه والقياسات
└── utils/           # أدوات التشفير والتحقق
المتطلباتقبل التشغيل تحتاج إلى:Node.jsPostgreSQLRedisمتغيرات بيئة صحيحة داخل ملف .envالتثبيتnpm install
ثم أنشئ ملف البيئة:cp .env.example .env
عدّل القيم حسب بيئتك، خصوصًا:إعدادات قاعدة البيانات.إعدادات Redis.DEVICE_MASTER_SEED.مفاتيح مزود الدفع.مفتاح API الخاص بالتاجر.التشغيل المحليnpm run dev
أو:npm start
وفي حال استخدام Docker:docker-compose up --build
المسارات الأساسية1) تنفيذ عملية دفعPOST /api/v1/payments/process
هذا هو المسار الرئيسي الذي يستقبل طلب الدفع القادم من Atheer SDK.مثال على الطلب{
  "deviceId": "DEVICE-123",
  "counter": 10,
  "timestamp": 1710000000000,
  "signature": "BASE64_SIGNATURE",
  "amount": 1500,
  "currency": "YER",
  "transactionType": "P2M",
  "receiverAccount": "merchant_001",
  "description": "شراء منتج"
}
الهيدر المطلوبx-atheer-api-key: YOUR_MERCHANT_API_KEY
2) عرض حالة عمليةGET /api/v1/payments/status/:id
يعرض حالة العملية المخزنة في قاعدة البيانات، مع بيانات المزود وأي رسالة خطأ مرتبطة بها.آلية الأمانيعتمد النظام على عدة طبقات حماية:المصادقةكل طلب يجب أن يحمل مفتاح API صالحًا يخص التاجر.منع إعادة الإرساليتم تتبع counter لكل جهاز داخل Redis.إذا وصل عداد أقدم أو مكرر، يتم رفض العملية مباشرة.التحقق من التوقيعيتم إعادة بناء المفتاح المحدود الاستخدام LUK من DEVICE_MASTER_SEED ومعرّف الجهاز والعداد، ثم التحقق من التوقيع المرفق مع الطلب.السجل التدقيقيكل طلب يُسجل في قاعدة البيانات، سواء نجح أو فشل، بهدف التتبع والتحليل والمراجعة.مزودات الدفعالمشروع يحتوي على طبقة adapters لتسهيل ربط أكثر من مزود:Jawali AdapterMock Bank Adapterيمكن إضافة مزود جديد بسهولة عبر إنشاء Adapter جديد ثم ربطه داخل routerService.لوحة الإدارةيوفر المشروع لوحة إدارة داخلية لمتابعة:التجار.العمليات المالية.حالات النجاح والفشل.الإحصائيات التشغيلية.التوثيق التقنيهذا المستودع يعتمد على بروتوكول أمني متكامل يربط بين الهاتف والخادم.الـ SDK على الهاتف يقوم بتجهيز الحمولة الموقعة، بينما هذا الخادم يتحقق منها ويكمل عملية الدفع.العلاقة مع Atheer SDKهذا المشروع لا يعمل وحده، بل يعتمد على Atheer SDK على جهاز Android.الـ SDK مسؤول عن:إنشاء الحمولة الأمنية.إدارة المفاتيح داخل الهاتف.إرسال البيانات عبر NFC.التواصل مع هذا الخادم عبر الشبكة.أما هذا الخادم فمسؤول عن:التحقق.التوجيه.تنفيذ العملية.الحفظ في قاعدة البيانات.الترخيصيرجى مراجعة ملف الترخيص الخاص بالمستودع إن وجد.           |
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

