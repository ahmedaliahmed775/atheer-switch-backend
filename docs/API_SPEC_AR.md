# توثيق واجهة برمجة تطبيقات Atheer Switch (API Specification)

## مقدمة

يقدم هذا المستند توثيقًا شاملاً لواجهة برمجة التطبيقات (API) الخاصة ببوابة الدفع عالية الأداء Atheer Switch. تعتمد هذه الواجهة على **محرك التحقق عديم الحالة (Stateless Anti-Replay Verification Engine)**، الذي يُلغي تمامًا نموذج التوكنز الأوفلاين القديم ويستبدله بنظام تحقق آمن يعتمد على Redis لمنع هجمات إعادة التشغيل وتوقيع Ed25519 للتحقق من هوية الجهاز.

## هندسة الربط مع البنوك (B2B Direct Debit)

تعتمد Atheer Switch على معمارية **الخصم المباشر بين الشركات (B2B Direct Debit)**، حيث يعمل السويتش كـ **بوابة دفع سيادية وموثوقة (Trusted Gateway)** لدى البنك.

### آلية العمل:

1. **التحقق من مكافحة إعادة التشغيل (Anti-Replay)**: يفحص السويتش عداد الجهاز (Counter) في Redis بشكل ذري. أي طلب بعداد مكرر أو قديم يُرفض فوراً بـ HTTP 403.
2. **إعادة بناء LUK**: يشتق السويتش مفتاح الاستخدام المحدود (LUK) باستخدام HMAC-SHA256 من seed الجهاز والعداد.
3. **التحقق من التوقيع**: يتحقق السويتش من توقيع Ed25519 على الحِمل `DeviceID|Counter|Challenge` باستخدام المفتاح العام المشتق من LUK.
4. **الخصم المباشر**: بعد التحقق، يرسل السويتش أمر خصم مباشر إلى البنك عبر `jawaliAdapter`، محدداً حساب الجهاز ومحفظة التاجر.
5. **التدقيق الدائم**: تُسجَّل جميع المعاملات (الناجحة والفاشلة أمنياً) في PostgreSQL للتدقيق الدائم (Immutable Audit Log).

### هيكل الطلبات (Request Structure)

تعتمد الطلبات من السويتش إلى البنك على هيكل موحد يتكون من `header` و `body`.

**مثال على هيكل الطلب:**

```json
{
  "header": {
    "messageContext": "AtheerSwitch",
    "messageId": "a7e1a3b4-4c5d-4f6e-8a9b-1c2d3e4f5a6b",
    "messageTimestamp": "2026-04-07T12:00:00.000Z",
    "callerId": "AtheerSwitch"
  },
  "body": {
    "customerIdentifier": "DEVICE-001",
    "targetWalletId": "ACC-MERCHANT-001",
    "amount": 1500,
    "transactionRef": "ATHEER-TXN-98765"
  }
}
```

## المصادقة (Authentication)

تتطلب جميع نقاط النهاية المصادقة باستخدام مفتاح API خاص بالتاجر.

| الترويسة (Header)   | الوصف                                 | مثال                                    |
| :----------------- | :------------------------------------ | :--------------------------------------- |
| `x-atheer-api-key` | مفتاح API الخاص بالتاجر للمصادقة.     | `x-atheer-api-key: your_merchant_api_key` |

## نقاط النهاية (Endpoints)

### 1. معالجة طلب دفع — نظام Anti-Replay

`POST /api/v1/payments/charge`

تستخدم هذه النقطة لمعالجة طلب دفع جديد من Atheer Android SDK باستخدام محرك التحقق عديم الحالة.

**الترويسات المطلوبة:**

- `x-atheer-api-key`: مفتاح API الخاص بالتاجر.

**جسم الطلب (Request Body):**

```json
{
  "DeviceID": "DEVICE-UNIQUE-ID-001",
  "Counter": 42,
  "Challenge": "ch_a1b2c3d4e5f6",
  "Signature": "BASE64_ED25519_SIGNATURE_HERE",
  "amount": 1500.00,
  "receiverAccount": "uuid-of-merchant-or-mobile",
  "transactionType": "P2M",
  "currency": "YER",
  "description": "شراء من متجر XYZ"
}
```

| الحقل              | النوع     | مطلوب | الوصف                                                                                  |
| :----------------- | :-------- | :---- | :------------------------------------------------------------------------------------- |
| `DeviceID`         | `string`  | نعم   | معرف الجهاز الفريد المسجَّل في SDK.                                                   |
| `Counter`          | `integer` | نعم   | عداد المعاملة المتصاعد (Monotonic Counter) — يُرفض إذا كان ≤ آخر عداد مسجَّل.        |
| `Challenge`        | `string`  | نعم   | تحدٍّ فريد للمعاملة يُولَّده SDK (nonce أحادي الاستخدام).                              |
| `Signature`        | `string`  | نعم   | توقيع Ed25519 بتشفير Base64 على الحِمل `DeviceID\|Counter\|Challenge`.                |
| `amount`           | `number`  | نعم   | قيمة المبلغ المراد دفعه.                                                               |
| `receiverAccount`  | `string`  | نعم   | معرف التاجر (UUID) في حالة P2M، أو رقم الجوال في حالة P2P.                            |
| `transactionType`  | `string`  | نعم   | نوع المعاملة: `P2M` (دفع لتاجر) أو `P2P` (تحويل بين أفراد).                          |
| `currency`         | `string`  | لا    | رمز العملة (افتراضي: `YER`).                                                           |
| `description`      | `string`  | لا    | وصف نصي اختياري للمعاملة.                                                              |

**استجابة ناجحة (Status 200 OK):**

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

**استجابة هجوم إعادة التشغيل (Status 403 Forbidden):**

```json
{
  "success": false,
  "error": {
    "message": "Replay Attack Detected"
  }
}
```

**استجابة فشل التوقيع (Status 401 Unauthorized):**

```json
{
  "success": false,
  "error": {
    "message": "فشل التحقق من التوقيع الرقمي."
  }
}
```

**استجابة خطأ عام (Status 400 / 500):**

```json
{
  "success": false,
  "error": {
    "message": "رسالة خطأ توضيحية."
  }
}
```

---

### 2. الحصول على حالة معاملة

`GET /api/v1/payments/status/:id`

**الترويسات المطلوبة:**

- `x-atheer-api-key`: مفتاح API الخاص بالتاجر.

**معلمات المسار (Path Parameters):**

| المعلمة | النوع   | الوصف                   | مثال                 |
| :------ | :----- | :---------------------- | :------------------- |
| `id`    | `string` | معرف المعاملة (UUID). | `uuid-of-transaction` |

**استجابة ناجحة (Status 200 OK):**

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
    "createdAt": "2026-04-07T12:00:00.000Z",
    "updatedAt": "2026-04-07T12:00:05.000Z"
  }
}
```

---

### 3. الحصول على إحصائيات مزود خدمة

`GET /api/v1/admin/stats/:provider`

**ملاحظة:** هذه النقطة مخصصة للاستخدام الإداري وتتطلب مفتاح `x-atheer-admin-key`.

**معلمات المسار (Path Parameters):**

| المعلمة    | النوع   | الوصف                               | مثال     |
| :--------- | :----- | :---------------------------------- | :------- |
| `provider` | `string` | اسم مزود الخدمة (مثال: `JAWALI`). | `JAWALI` |

**استجابة ناجحة (Status 200 OK):**

```json
{
  "success": true,
  "data": {
    "provider": "JAWALI",
    "totalCount": 1500,
    "successCount": 1450,
    "failedCount": 50,
    "totalVolume": 150000.75,
    "dailyVolume": 5000.20,
    "successRate": "96.67%"
  }
}
```

### 4. الحصول على إحصائيات جميع مزودي الخدمة

`GET /api/v1/admin/stats/all`

**استجابة ناجحة (Status 200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "provider": "JAWALI",
      "totalCount": 1500,
      "successCount": 1450,
      "failedCount": 50,
      "totalVolume": 150000.75,
      "dailyVolume": 5000.20,
      "successRate": "96.67%"
    },
    {
      "provider": "MOCK",
      "totalCount": 800,
      "successCount": 780,
      "failedCount": 20,
      "totalVolume": 80000.00,
      "dailyVolume": 2500.00,
      "successRate": "97.50%"
    }
  ]
}
```

