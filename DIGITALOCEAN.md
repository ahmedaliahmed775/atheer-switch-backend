# نشر المقسم (Atheer Switch) على DigitalOcean

## الترتيب

1. أنشئ **تطبيق App Platform** من المستودع (أو ارفع `Dockerfile` يدوياً).
2. أضف **PostgreSQL مُداراً** — يُربط تلقائياً بمتغيرات `DB_*` في `.do/app.yaml`.
3. أضف **Redis** (قاعدة بيانات Redis أو Droplet منفصل): من **Settings → Components → Add Database → Redis**، ثم عيّن في التطبيق:
   - `REDIS_HOST` — عنوان المضيف
   - `REDIS_PORT` — غالباً `25061` أو `6379`
   - `REDIS_PASS` — كلمة المرور إن وُجدت
   - `REDIS_TLS=true` إذا طلبت المنصة اتصالاً آمناً

   أو استخدم **`REDIS_URL`** كسلسلة واحدة (مثل `rediss://...`) واحذف الحقول المنفصلة.

4. عيّن أسرار **RUN_TIME**:
   - `JWT_SECRET` — عشوائي طويل
   - `ADMIN_API_KEY` — **16 حرفاً على الأقل**؛ لطلبات `GET /api/v1/admin/*` أرسل الترويسة:  
     `x-atheer-admin-key: <نفس القيمة>`
   - مفاتيح Jawali إن استُخدمت

5. بعد أول نشر، **سجّل تاجراً** يطابق مفتاح المحفظة:

   محلياً (مع نسخ `DATABASE_URL` أو متغيرات الاتصال من لوحة DO):

   ```bash
   cd atheer-switch-backend
   WALLET_MERCHANT_API_KEY="نفس_قيمة_WALLET_API_KEY_لاحقاً_في_المحفظة" npm run seed:merchant
   ```

   أو نفّذ الأمر من حاوية/CI لها صلاحية الوصول لقاعدة البيانات.

6. انسخ **رابط HTTPS** العلني للتطبيق (مثل `https://atheer-switch-xxx.ondigitalocean.app`) — ستحتاجه في `ATHEER_SWITCH_URL` عند نشر **خادم المحفظة**.

## ملاحظات

- `DB_SSL=true` مفعّل في `app.yaml` لـ PostgreSQL المُدار.
- مسارات `/api/v1/payments/*` تتطلب `x-atheer-api-key` لمفتاح مسجّل في جدول `merchants` (يُنشأ عبر `seed:merchant`).
