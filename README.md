# Atheer Switch: بوابة دفع عالية الأداء

![Atheer Switch Logo](https://via.placeholder.com/150x50?text=Atheer+Switch)

## مقدمة

**Atheer Switch** هي بوابة دفع متطورة وعالية الأداء مصممة لتكون وسيطًا ماليًا بين تطبيقات الأندرويد (عبر Atheer Android SDK) ومزودي خدمات الدفع المختلفين مثل Jawali و WeCash. تهدف هذه البوابة إلى توفير حل آمن وفعال لمعالجة المدفوعات في الوقت الفعلي، مع التركيز على الأداء، الموثوقية، ومنع الاحتيال.

## الميزات الأساسية

-   **معالجة المدفوعات في الوقت الفعلي:** استقبال ومعالجة طلبات الدفع بسرعة وكفاءة.
-   **منع تكرار الإنفاق (Idempotency):** استخدام Redis لضمان معالجة كل طلب دفع مرة واحدة فقط.
-   **توجيه المعاملات الذكي:** توجيه المعاملات إلى مزود الخدمة المناسب (Jawali, WeCash, إلخ) باستخدام محولات قابلة للتوسيع.
-   **إحصائيات لحظية:** توفير بيانات وإحصائيات في الوقت الفعلي لأداء مزودي الخدمة باستخدام Redis.
-   **أمان عالي:** استخدام مفاتيح API للمصادقة وتطبيق أفضل الممارسات الأمنية.
-   **هندسة معمارية نظيفة:** تصميم المشروع وفقًا لمبادئ Clean Architecture لسهولة الصيانة والتوسع.
-   **توثيق شامل:** جميع التعليمات البرمجية، السجلات، والتوثيق مكتوبة باللغة العربية.

## المتطلبات المسبقة

قبل البدء، تأكد من تثبيت ما يلي على نظامك:

-   [Docker](https://www.docker.com/get-started)
-   [Docker Compose](https://docs.docker.com/compose/install/)
-   [Node.js](https://nodejs.org/en/download/) (يفضل استخدام الإصدار 20 أو أحدث)
-   [npm](https://www.npmjs.com/get-npm) (يأتي مع Node.js)

## البدء السريع

اتبع الخطوات التالية لتشغيل Atheer Switch على جهازك المحلي:

### 1. استنساخ المستودع (Clone the Repository)

```bash
git clone https://github.com/your-username/atheer-switch.git
cd atheer-switch
```

### 2. إعداد المتغيرات البيئية

قم بإنشاء ملف `.env` في الجذر الرئيسي للمشروع بناءً على ملف `.env.example`:

```bash
cp .env.example .env
```

ثم قم بتعديل ملف `.env` بالقيم المناسبة لبيئتك. على سبيل المثال:

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
REDIS_PASS=

JAWALI_API_URL=https://api.jawali.com/v1
JAWALI_AGENT_WALLET=YOUR_WALLET_ID
JAWALI_API_KEY=YOUR_API_KEY

JEEB_API_URL=http://localhost:8000/api/v1/jeeb
JEEB_AGENT_WALLET=YOUR_JEEB_WALLET
JEEB_API_KEY=YOUR_JEEB_API_KEY

JWT_SECRET=super_secret_key_for_jwt
API_KEY_HEADER=x-atheer-api-key
```

### 3. تشغيل الخدمات باستخدام Docker Compose

سيقوم Docker Compose بإنشاء وتشغيل حاويات Node.js، PostgreSQL، و Redis:

```bash
docker-compose up --build
```

بعد اكتمال البناء والتشغيل، يجب أن يكون الخادم متاحًا على `http://localhost:3000`.

### 4. تشغيل التطبيق محليًا (بدون Docker للـ Node.js)

إذا كنت تفضل تشغيل تطبيق Node.js مباشرة على جهازك (مع بقاء PostgreSQL و Redis في Docker):

أولاً، تأكد من أن PostgreSQL و Redis يعملان عبر Docker Compose:

```bash
docker-compose up postgres redis
```

ثم قم بتثبيت التبعيات وتشغيل التطبيق:

```bash
npm install
npm run dev # للتشغيل في وضع التطوير مع nodemon
# أو
npm start # للتشغيل في وضع الإنتاج
```

## هيكل المشروع

```
atheer-switch/
├── src/
│   ├── config/             # إعدادات قاعدة البيانات و Redis
│   │   ├── database.js
│   │   └── redis.js
│   ├── middlewares/        # وظائف Middleware للمصادقة، منع التكرار، ومعالجة الأخطاء
│   │   ├── auth.js
│   │   ├── idempotency.js
│   │   └── errorLogger.js
│   ├── services/           # منطق الأعمال الأساسي (توجيه المعاملات، الإحصائيات)
│   │   ├── routerService.js
│   │   └── statsService.js
│   ├── adapters/           # محولات لمزودي خدمات الدفع الخارجيين
│   │   ├── jawaliAdapter.js
│   │   └── mockBankAdapter.js
│   ├── controllers/        # منطق معالجة الطلبات والاستجابات
│   │   ├── paymentController.js
│   │   └── statsController.js
│   ├── models/             # تعريف نماذج قاعدة البيانات (Sequelize)
│   │   ├── Transaction.js
│   │   └── Merchant.js
│   ├── routes/             # تعريف مسارات API
│   │   ├── paymentRoutes.js
│   │   └── adminRoutes.js
│   ├── app.js              # إعداد تطبيق Express الرئيسي
│   └── server.js           # نقطة الدخول لتشغيل الخادم
├── docs/                   # وثائق المشروع (توثيق API)
│   └── API_SPEC_AR.md
├── .env.example            # مثال لملف المتغيرات البيئية
├── docker-compose.yml      # إعداد Docker Compose للخدمات
├── Dockerfile              # ملف Docker لبناء صورة التطبيق
└── package.json            # تعريف المشروع والتبعيات
```

## استخدام API

يرجى الرجوع إلى ملف [API_SPEC_AR.md](docs/API_SPEC_AR.md) للحصول على توثيق مفصل لنقاط نهاية API، أمثلة الطلبات والاستجابات، ومتطلبات المصادقة.

## المساهمة

نرحب بالمساهمات في تطوير Atheer Switch. يرجى قراءة إرشادات المساهمة (قيد الإنشاء) قبل تقديم أي طلبات سحب (Pull Requests).

## الترخيص

هذا المشروع مرخص تحت ترخيص MIT. انظر ملف `LICENSE` (قيد الإنشاء) لمزيد من التفاصيل.

## اتصل بنا

للدعم أو الاستفسارات، يرجى التواصل مع فريق Atheer Fintech.
