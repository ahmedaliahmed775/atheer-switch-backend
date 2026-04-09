# Atheer Switch Backend — المحرك المركزي للمدفوعات

<div align="center">

**بوابة دفع لحظية عالية الأداء بمعمارية Pure Synchronous Zero-Trust**

`Node.js` · `Express` · `PostgreSQL` · `Redis` · `HMAC-SHA256`

الإصدار 2.0.0

</div>

---

## نظرة عامة

**Atheer Switch Backend** هو المحرك المركزي (Payment Switch) الذي يعالج ويتحقق من معاملات الدفع القادمة من [Atheer SDK](../sdk/README.md). يعمل كبوابة ذكية بين تطبيقات التجار والمحافظ الإلكترونية اليمنية.

### المعمارية

```
SDK ──HTTPS──► Rate Limiter → System Status → Auth → Anti-Replay → Timestamp Check
                                                                        │
                                                            Payment Controller
                                                    ┌───────────┤
                                                    ▼           ▼
                                              HMAC Verify   Route Service
                                                           ┌────┴────┐
                                                    JawaliAdapter  MockBank
```

---

## التشغيل

```bash
npm install
cp .env.example .env
# ⚠️ توليد DEVICE_MASTER_SEED:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm start
```

### المتغيرات البيئية الحرجة

| المتغير | الوصف |
|:---|:---|
| `DEVICE_MASTER_SEED` | **إلزامي** — بذرة اشتقاق المفاتيح (64 hex) |
| `ADMIN_API_KEY` | مفتاح حماية مسارات الإدارة |
| `SYSTEM_STATUS` | حالة النظام: `ACTIVE` / `MAINTENANCE` |
| `REQUEST_MAX_AGE_MS` | الحد الأقصى لعمر الطلب (افتراضي: 300000 = 5 دقائق) |
| `RATE_LIMIT_MAX` | حد الطلبات/دقيقة/IP (افتراضي: 100) |
| `MAX_DEVICES_PER_MERCHANT` | حد الأجهزة لكل تاجر (افتراضي: 20) |

> ⚠️ ملف `.env` محمي بـ `.gitignore` — لا يُرفع للمستودع أبداً.

---

## نقاط النهاية (API Endpoints)

### الدفع — `POST /api/v1/payments/charge`
```json
{
  "deviceId": "abc...", "counter": 42, "timestamp": 1714000000000,
  "signature": "Base64...", "amount": 5000, "receiverAccount": "UUID",
  "transactionType": "P2M", "currency": "YER"
}
```
**حمايات:** Rate Limit → System Status → Auth → Anti-Replay → Timestamp (≤ 5 min) → HMAC Verify

### تسجيل الجهاز — `POST /api/v1/devices/enroll`
```json
{ "deviceId": "abc..." }
```
**حمايات:** Rate Limit → Auth → حد 5 محاولات/ساعة/جهاز → حد 20 جهاز/تاجر

### فحص الصحة — `GET /health`
يعمل دائماً (حتى أثناء الصيانة).

### حالة النظام — إدارة
```bash
# قراءة
curl -H "x-atheer-admin-key: KEY" GET /api/v1/admin/system-status
# تفعيل الصيانة
curl -X POST -H "x-atheer-admin-key: KEY" -d '{"status":"MAINTENANCE"}' /api/v1/admin/system-status
# إعادة التشغيل
curl -X POST -H "x-atheer-admin-key: KEY" -d '{"status":"ACTIVE"}' /api/v1/admin/system-status
```

---

## Middleware Pipeline

```
[1] rateLimiter        — 100 req/min/IP
[2] systemStatusCheck  — 503 أثناء الصيانة (مستثنى: /health, /switch-admin)
[3] authenticateMerchant — API Key verification
[4] antiReplayCheck    — Redis Lua atomic script
[5] timestampCheck     — ≤ 5 دقائق عمر الطلب
[6] HMAC verification  — Timing-Safe comparison
```

---

## إضافة محفظة جديدة

```javascript
import { PaymentAdapter } from './PaymentAdapter.js';

class KreimiAdapter extends PaymentAdapter {
  get providerName() { return 'KREIMI'; }
  async executeDirectDebit(customer, merchant, amount, ref) { /* ... */ }
}
```

ثم أضف `case 'KREIMI'` في `routerService.js`.
