<div dir="rtl">

# Atheer Switch Backend — بوابة الدفع عالية الأداء

[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

<div dir="rtl">

## 📋 جدول المحتويات

1. [نظرة عامة على المشروع](#-نظرة-عامة-على-المشروع)
2. [معمارية النظام](#-معمارية-النظام)
3. [الميزات الأساسية](#-الميزات-الأساسية)
4. [نموذج الأمان](#-نموذج-الأمان)
5. [المتطلبات المسبقة](#-المتطلبات-المسبقة)
6. [البدء السريع](#-البدء-السريع)
7. [متغيرات البيئة](#-متغيرات-البيئة)
8. [هيكل المشروع](#-هيكل-المشروع)
9. [واجهة برمجة التطبيقات (API)](#-واجهة-برمجة-التطبيقات-api)
10. [لوحة الإدارة](#-لوحة-الإدارة)
11. [النشر على الإنتاج](#-النشر-على-الإنتاج)
12. [إضافة تاجر جديد](#-إضافة-تاجر-جديد)
13. [المساهمة](#-المساهمة)
14. [الترخيص](#-الترخيص)

---

## 🏦 نظرة عامة على المشروع

**Atheer Switch Backend** هو خادم Node.js/Express يعمل كبوابة دفع مركزية تربط بين تطبيقات Android التي تستخدم **Atheer SDK** ومزودي خدمات الدفع الخارجيين. يعتمد على **محرك التحقق عديم الحالة (Stateless Anti-Replay Verification Engine)** للتحقق من هوية الجهاز ومنع هجمات إعادة التشغيل بشكل ذري.

### ما الذي يفعله هذا النظام؟

| المهمة | التفاصيل |
| :----- | :------- |
| **استقبال طلبات الدفع** | يستقبل الطلبات القادمة من Atheer Android SDK |
| **مصادقة التاجر** | يتحقق من هوية التاجر عبر مفتاح `x-atheer-api-key` |
| **منع إعادة الإرسال** | يرفض أي طلب بعداد مكرر أو قديم باستخدام Redis |
| **إعادة بناء LUK** | يشتق مفتاح استخدام محدود فريد لكل معاملة |
| **التحقق من التوقيع** | يتحقق من توقيع Ed25519 على الحِمل الواردة |
| **توجيه المعاملة** | يوجّه إلى مزود الدفع المناسب (Jawali / Mock) |
| **التدقيق الدائم** | يسجّل كل معاملة في PostgreSQL (ناجحة أو فاشلة) |
| **لوحة إدارة** | يوفر واجهة AdminJS لمتابعة التجار والعمليات |

### العلاقة مع مكونات المنظومة

```
┌────────────────────────────┐
│  تطبيق التاجر / POS Device │
└────────────┬───────────────┘
             │ NFC / Network
┌────────────▼───────────────┐
│     Atheer Android SDK     │  ◄── يولّد الحمولة الموقّعة
└────────────┬───────────────┘
             │ HTTPS + x-atheer-api-key
┌────────────▼───────────────┐
│  Atheer Switch Backend     │  ◄── هذا المستودع
│  (Node.js / Express)       │
└────┬──────────┬────────────┘
     │          │
┌────▼──┐  ┌───▼────────┐
│ Redis │  │ PostgreSQL │
│(عداد) │  │  (سجل)     │
└───────┘  └────────────┘
     │
┌────▼──────────────────────┐
│  مزودو الدفع الخارجيون   │
│  Jawali / Mock Bank       │
└───────────────────────────┘
```

---

## 🏗️ معمارية النظام

يتبع المشروع **Clean Architecture** مع فصل واضح للمسؤوليات:

```
طلب HTTP
    │
    ▼
[Routes] ──► [Middlewares: Auth + Anti-Replay]
                        │
                        ▼
                [Controllers]
                        │
                        ▼
                [Services: routerService]
                        │
              ┌─────────┴──────────┐
              ▼                    ▼
      [jawaliAdapter]    [mockBankAdapter]
              │
              ▼
    [مزود الدفع الخارجي]
              │
              ▼
    [Models: Transaction Log → PostgreSQL]
```

---

## ✨ الميزات الأساسية

- 🔒 **معمارية عديمة الحالة (Stateless):** لا حاجة لتوكنز أوفلاين — Redis فقط للعداد.
- 🛡️ **حماية ذرية من إعادة التشغيل:** رفض فوري لأي طلب بعداد قديم أو مكرر (Lua Atomic Script).
- 🔑 **مفاتيح محدودة الاستخدام (LUK):** كل معاملة تستخدم مفتاحاً تشفيرياً فريداً مشتقاً من HMAC-SHA256.
- ✍️ **توقيع رقمي Ed25519:** التحقق من صحة حِمل `DeviceID|Counter|Challenge`.
- 🔀 **توجيه ذكي للمعاملات:** P2M عبر `jawaliAdapter`، P2P عبر `mockBankAdapter`.
- 📋 **سجل تدقيق دائم:** تسجيل كامل وغير قابل للتعديل في PostgreSQL.
- 🖥️ **لوحة إدارة AdminJS:** واجهة ويب لمتابعة التجار والعمليات.
- 🐳 **دعم Docker كامل:** بيئة مكتملة بأمر واحد.
- 📊 **إحصائيات مزودي الدفع:** نقاط نهاية إدارية لمتابعة الأداء.

---

## 🔐 نموذج الأمان

يعتمد النظام على أربع طبقات حماية متسلسلة:

| الطبقة | التقنية | الوظيفة |
| :----- | :------ | :------ |
| **1. مصادقة التاجر** | API Key (`x-atheer-api-key`) | رفض أي طلب بدون مفتاح تاجر صالح |
| **2. Anti-Replay Firewall** | Redis + Lua Atomic Script | رفض أي طلب بعداد ≤ آخر عداد مسجَّل للجهاز |
| **3. إعادة بناء LUK** | HMAC-SHA256 | اشتقاق مفتاح فريد من `DEVICE_MASTER_SEED` + `DeviceID` + `Counter` |
| **4. التحقق من التوقيع** | Ed25519 | التحقق من توقيع `DeviceID\|Counter\|Challenge` بالمفتاح المشتق |

> ⚠️ **تحذير أمني:** `DEVICE_MASTER_SEED` هو سر المنظومة الأمنية بأكملها. يجب أن يكون hex string عشوائياً بطول 64 حرفاً (32 بايت)، ويُحفظ في متغيرات البيئة السرية ولا يُدرج أبداً في الكود.

---

## 📦 المتطلبات المسبقة

| الأداة | الإصدار الأدنى | الرابط |
| :----- | :------------ | :----- |
| Node.js | 20+ | [nodejs.org](https://nodejs.org/) |
| npm | 9+ | يأتي مع Node.js |
| Docker | 24+ | [docker.com](https://www.docker.com/get-started) |
| Docker Compose | 2.x | [docs.docker.com](https://docs.docker.com/compose/install/) |
| PostgreSQL | 15+ | مدمج في Docker Compose |
| Redis | 7+ | مدمج في Docker Compose |

> إذا كنت تشغّل التطبيق بدون Docker، تحتاج إلى تثبيت PostgreSQL وRedis محلياً.

---

## 🚀 البدء السريع

### 1. استنساخ المستودع

```bash
git clone https://github.com/ahmedaliahmed775/atheer-switch-backend.git
cd atheer-switch-backend
```

### 2. إعداد متغيرات البيئة

```bash
cp .env.example .env
```

عدّل ملف `.env` بالقيم المناسبة (راجع [قسم المتغيرات](#-متغيرات-البيئة) للتفاصيل).

### 3. تشغيل الخدمات باستخدام Docker

```bash
docker-compose up --build
```

الخادم سيكون متاحاً على: **`http://localhost:4000`** (يُحدّد بواسطة `PORT=4000` في `docker-compose.yml`).

### 4. تشغيل بدون Docker (للتطوير المحلي)

```bash
# تثبيت التبعيات
npm install

# تشغيل وضع التطوير (مع إعادة التشغيل التلقائية)
npm run dev

# أو تشغيل وضع الإنتاج
npm start
```

> تأكد من تشغيل PostgreSQL وRedis محلياً قبل تنفيذ هذه الأوامر، وأن متغيرات `.env` تشير إلى `localhost`. المنفذ الافتراضي للتشغيل المحلي هو `3000`.

### 5. التحقق من تشغيل الخادم

```bash
# Docker
curl http://localhost:4000/health

# محلي بدون Docker
curl http://localhost:3000/health
```

---

## ⚙️ متغيرات البيئة

جميع متغيرات البيئة موثّقة في ملف [`.env.example`](.env.example). الجدول أدناه يشرح المتغيرات الأساسية:

### الخادم

| المتغير | القيمة الافتراضية | الوصف |
| :------ | :--------------- | :----- |
| `PORT` | `3000` (محلي) / `4000` (Docker) | منفذ تشغيل الخادم (يُعيَّن على `4000` في `docker-compose.yml`) |
| `NODE_ENV` | `development` | بيئة التشغيل (`development` / `production`) |

### قاعدة البيانات (PostgreSQL)

| المتغير | مثال | الوصف |
| :------ | :--- | :----- |
| `DB_HOST` | `localhost` | عنوان خادم PostgreSQL |
| `DB_PORT` | `5432` | منفذ PostgreSQL |
| `DB_NAME` | `atheer_switch` | اسم قاعدة البيانات |
| `DB_USER` | `postgres` | اسم مستخدم PostgreSQL |
| `DB_PASS` | _(مطلوب)_ | كلمة مرور PostgreSQL |
| `DB_SSL` | `false` | تفعيل SSL (مطلوب للقواعد المُدارة مثل DigitalOcean) |
| `DATABASE_URL` | — | سلسلة الاتصال الكاملة (بديل عن المتغيرات المنفصلة) |

### Redis

| المتغير | مثال | الوصف |
| :------ | :--- | :----- |
| `REDIS_HOST` | `localhost` | عنوان خادم Redis |
| `REDIS_PORT` | `6379` | منفذ Redis |
| `REDIS_PASS` | — | كلمة مرور Redis (إن وُجدت) |
| `REDIS_TLS` | `false` | تفعيل TLS للاتصال بـ Redis |
| `REDIS_URL` | — | سلسلة الاتصال الكاملة (مثل `rediss://...`) |

### مزودو الدفع

| المتغير | مثال | الوصف |
| :------ | :--- | :----- |
| `JAWALI_API_URL` | `https://api.jawali.com/v1` | رابط API مزود Jawali |
| `JAWALI_AGENT_WALLET` | _(مطلوب)_ | معرّف محفظة الوكيل لدى Jawali |
| `JAWALI_API_KEY` | _(مطلوب)_ | مفتاح API لمزود Jawali |

### الأمان

| المتغير | مثال | الوصف |
| :------ | :--- | :----- |
| `DEVICE_MASTER_SEED` | _(مطلوب — 64 حرف hex)_ | السر الرئيسي لاشتقاق مفاتيح LUK ومنع Replay |
| `DEVICE_COUNTER_TTL_SECONDS` | `31536000` | مدة الاحتفاظ بعداد الجهاز في Redis (بالثواني) |
| `JWT_SECRET` | _(مطلوب)_ | سر JWT للجلسات الداخلية |
| `API_KEY_HEADER` | `x-atheer-api-key` | اسم ترويسة مفتاح API للتجار |
| `ADMIN_API_KEY` | _(مطلوب — 16+ حرف)_ | مفتاح الوصول لنقاط النهاية الإدارية |

> **توليد `DEVICE_MASTER_SEED`:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## 📁 هيكل المشروع

```
atheer-switch-backend/
├── src/
│   ├── adapters/                  # محوّلات مزودي الدفع
│   │   ├── jawaliAdapter.js       # تكامل مع Jawali Payment
│   │   └── mockBankAdapter.js     # محاكي بنك للاختبار
│   ├── admin/                     # إعدادات لوحة AdminJS
│   ├── config/                    # إعدادات الاتصال بالخدمات
│   │   ├── database.js            # Sequelize + PostgreSQL
│   │   └── redis.js               # ioredis client
│   ├── controllers/               # معالجة منطق الطلبات والاستجابات
│   │   ├── paymentController.js   # محرك التحقق ومعالجة الدفع
│   │   └── statsController.js     # إحصائيات مزودي الدفع
│   ├── middlewares/               # طبقات المعالجة الوسيطة
│   │   ├── antiReplay.js          # جدار Anti-Replay (Redis Lua Atomic)
│   │   ├── auth.js                # مصادقة التاجر عبر API Key
│   │   ├── idempotency.js         # ضمان عدم تكرار المعاملة
│   │   └── errorLogger.js         # تسجيل الأخطاء (Winston)
│   ├── models/                    # نماذج Sequelize لـ PostgreSQL
│   │   ├── Transaction.js         # سجل التدقيق الدائم
│   │   └── Merchant.js            # بيانات التجار ومفاتيحهم
│   ├── routes/                    # تعريف مسارات HTTP
│   │   ├── paymentRoutes.js       # /api/v1/payments/*
│   │   └── adminRoutes.js         # /api/v1/admin/*
│   ├── services/                  # منطق الأعمال المشترك
│   │   ├── routerService.js       # توجيه المعاملة للمزود المناسب
│   │   └── statsService.js        # حساب الإحصائيات
│   ├── utils/                     # أدوات مساعدة
│   │   └── cryptoUtils.js         # reconstructLUK + verifyEd25519Signature
│   ├── app.js                     # إعداد تطبيق Express
│   └── server.js                  # نقطة دخول التطبيق
├── docs/
│   └── API_SPEC_AR.md             # توثيق API التفصيلي
├── scripts/
│   └── seedMerchant.js            # سكريبت إضافة تاجر تجريبي
├── logs/                          # ملفات السجل (Winston)
├── .env.example                   # قالب متغيرات البيئة
├── .dockerignore
├── .gitignore
├── docker-compose.yml             # تعريف خدمات Docker
├── Dockerfile
├── DIGITALOCEAN.md                # دليل النشر على DigitalOcean
└── package.json
```

---

## 📡 واجهة برمجة التطبيقات (API)

### المصادقة

جميع نقاط نهاية المدفوعات تتطلب إرسال مفتاح API الخاص بالتاجر في ترويسة الطلب:

```http
x-atheer-api-key: YOUR_MERCHANT_API_KEY
```

نقاط النهاية الإدارية تتطلب:

```http
x-atheer-admin-key: YOUR_ADMIN_API_KEY
```

---

### 1. معالجة طلب دفع جديد

```http
POST /api/v1/payments/charge
```

**جسم الطلب:**

```json
{
  "DeviceID": "DEVICE-UNIQUE-ID-001",
  "Counter": 42,
  "Challenge": "ch_a1b2c3d4e5f6",
  "Signature": "BASE64_ED25519_SIGNATURE_HERE",
  "amount": 1500.00,
  "receiverAccount": "uuid-of-merchant",
  "transactionType": "P2M",
  "currency": "YER",
  "description": "شراء من متجر XYZ"
}
```

| الحقل | النوع | مطلوب | الوصف |
| :---- | :---- | :---- | :---- |
| `DeviceID` | `string` | ✅ | معرّف الجهاز الفريد المسجَّل في SDK |
| `Counter` | `integer` | ✅ | عداد متصاعد — يُرفض إذا كان ≤ آخر عداد |
| `Challenge` | `string` | ✅ | nonce فريد أحادي الاستخدام يولّده SDK |
| `Signature` | `string` | ✅ | توقيع Ed25519 (Base64) على `DeviceID\|Counter\|Challenge` |
| `amount` | `number` | ✅ | قيمة المبلغ |
| `receiverAccount` | `string` | ✅ | UUID التاجر (P2M) أو رقم الجوال (P2P) |
| `transactionType` | `string` | ✅ | `P2M` أو `P2P` |
| `currency` | `string` | ❌ | رمز العملة (افتراضي: `YER`) |
| `description` | `string` | ❌ | وصف اختياري للمعاملة |

**استجابة ناجحة `200 OK`:**

```json
{
  "success": true,
  "data": {
    "transactionId": "uuid-of-transaction",
    "status": "success",
    "providerRef": "JAWALI-TXN-REF-001"
  }
}
```

**استجابات الخطأ:**

| كود HTTP | السبب |
| :------- | :---- |
| `401 Unauthorized` | مفتاح API مفقود أو غير صالح، أو فشل التحقق من التوقيع |
| `403 Forbidden` | هجوم إعادة تشغيل (عداد مكرر أو قديم) |
| `400 Bad Request` | بيانات مفقودة أو غير صحيحة |
| `500 Internal Server Error` | خطأ داخلي في الخادم |

---

### 2. استعلام حالة معاملة

```http
GET /api/v1/payments/status/:id
```

**استجابة ناجحة `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "uuid-of-transaction",
    "amount": "1500.00",
    "currency": "YER",
    "provider": "JAWALI",
    "providerRef": "JAWALI-TXN-REF-001",
    "status": "success",
    "authMethod": "ED25519_ANTI_REPLAY",
    "transactionType": "P2M",
    "metadata": {
      "deviceId": "DEVICE-UNIQUE-ID-001",
      "counter": 42,
      "challenge": "ch_a1b2c3d4e5f6"
    },
    "createdAt": "2026-04-07T12:00:00.000Z"
  }
}
```

---

### 3. إحصائيات مزود دفع (إداري)

```http
GET /api/v1/admin/stats/:provider
```

للتوثيق الكامل لجميع نقاط النهاية، راجع: **[docs/API_SPEC_AR.md](docs/API_SPEC_AR.md)**

---

## 🖥️ لوحة الإدارة

يوفر المشروع لوحة إدارة داخلية مبنية على **AdminJS** متاحة على:

```
# Docker
http://localhost:4000/admin

# محلي بدون Docker
http://localhost:3000/admin
```

تتيح اللوحة:
- إدارة التجار وعرض بياناتهم ومفاتيح API الخاصة بهم.
- مراجعة سجلات المعاملات المالية (ناجحة وفاشلة).
- متابعة الإحصائيات التشغيلية.

---

## 🚢 النشر على الإنتاج

### Docker (محلي أو VPS)

```bash
# بناء وتشغيل جميع الخدمات
docker-compose up --build -d

# عرض السجلات
docker-compose logs -f app

# إيقاف الخدمات
docker-compose down
```

### DigitalOcean App Platform

راجع الدليل التفصيلي: **[DIGITALOCEAN.md](DIGITALOCEAN.md)**

خلاصة الخطوات:
1. أنشئ تطبيق App Platform من هذا المستودع.
2. أضف قاعدة بيانات PostgreSQL مُدارة.
3. أضف Redis مُدار وعيّن `REDIS_TLS=true`.
4. أضف متغيرات البيئة السرية (`DEVICE_MASTER_SEED`, `ADMIN_API_KEY`, إلخ).
5. انشر التطبيق وسجّل التجار عبر `npm run seed:merchant`.

---

## 👤 إضافة تاجر جديد

بعد تشغيل الخادم وإنشاء قاعدة البيانات، استخدم السكريبت التالي لإضافة تاجر تجريبي:

```bash
npm run seed:merchant
```

أو مع تحديد مفتاح API مخصص:

```bash
WALLET_MERCHANT_API_KEY="my_custom_api_key" npm run seed:merchant
```

---

## 🤝 المساهمة

نرحب بالمساهمات! للمساهمة في هذا المشروع:

1. **Fork** المستودع.
2. أنشئ فرعاً جديداً: `git checkout -b feature/اسم-الميزة`.
3. نفّذ تغييراتك وأضف اختبارات مناسبة.
4. ارفع الفرع: `git push origin feature/اسم-الميزة`.
5. افتح **Pull Request** مع وصف واضح للتغييرات.

---

## 📄 الترخيص

هذا المشروع مرخص تحت [رخصة MIT](LICENSE).

---

<p align="center">
  صُنع بـ ❤️ بواسطة فريق Atheer Fintech
</p>

</div>
