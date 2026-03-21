# توثيق واجهة برمجة تطبيقات Atheer Switch (API Specification)

## مقدمة

يقدم هذا المستند توثيقًا شاملاً لواجهة برمجة التطبيقات (API) الخاصة ببوابة الدفع عالية الأداء Atheer Switch. تهدف هذه الواجهة إلى تمكين تطبيقات الأندرويد (عبر Atheer Android SDK) من إرسال طلبات الدفع ومعالجتها بشكل آمن وفعال. تقوم Atheer Switch بدور الوسيط المالي، حيث تتحقق من صحة الطلبات، وتمنع تكرار الإنفاق، وتوجه المعاملات إلى مزودي خدمات الدفع المختلفين مثل Jawali و WeCash.

## المصادقة (Authentication)

تتطلب جميع نقاط النهاية (Endpoints) المصادقة باستخدام مفتاح API خاص بالتاجر (Merchant API Key). يجب إرسال هذا المفتاح في ترويسة الطلب (Header) تحت اسم `x-atheer-api-key`.

| الترويسة (Header)   | الوصف                                 | مثال                                    |
| :----------------- | :------------------------------------ | :--------------------------------------- |
| `x-atheer-api-key` | مفتاح API الخاص بالتاجر للمصادقة.     | `x-atheer-api-key: your_merchant_api_key` |

## منع تكرار الطلبات (Idempotency)

لضمان معالجة كل طلب دفع مرة واحدة فقط، تدعم Atheer Switch مفهوم منع تكرار الطلبات (Idempotency) باستخدام قيمة `nonce` فريدة. يجب إرسال هذه القيمة في ترويسة الطلب `x-atheer-nonce` أو ضمن جسم الطلب (Body) لكل طلب دفع جديد.

إذا تم استلام طلب بنفس قيمة `nonce` مرة أخرى خلال فترة صلاحية (24 ساعة)، فسيتم إرجاع نتيجة الطلب الأصلي دون إعادة معالجته.

| الترويسة (Header) | الوصف                                        | مثال                                  |
| :---------------- | :------------------------------------------- | :------------------------------------- |
| `x-atheer-nonce`  | قيمة فريدة لكل طلب لمنع تكرار المعالجة. | `x-atheer-nonce: unique_request_id_123` |

## نقاط النهاية (Endpoints)

### 1. معالجة طلب دفع جديد

`POST /api/v1/payments/process`

تستخدم هذه النقطة لمعالجة طلب دفع جديد من Atheer Android SDK.

**الترويسات المطلوبة:**

- `x-atheer-api-key`: مفتاح API الخاص بالتاجر.
- `x-atheer-nonce`: قيمة فريدة للطلب.

**جسم الطلب (Request Body):**

| الحقل          | النوع    | مطلوب | الوصف                                                               | مثال                 |
| :------------- | :------ | :---- | :------------------------------------------------------------------ | :------------------- |
| `amount`       | `number`  | نعم   | قيمة المبلغ المراد دفعه.                                           | `100.50`             |
| `currency`     | `string`  | لا    | رمز العملة (افتراضي: `YER`).                                        | `YER`                |
| `provider`     | `string`  | نعم   | مزود خدمة الدفع المستهدف (مثال: `jawali`, `wecash`, `mock`).       | `jawali`             |
| `customerMobile` | `string`  | نعم   | رقم هاتف العميل الذي يقوم بالدفع.                                   | `777123456`          |
| `nonce`        | `string`  | نعم   | قيمة فريدة للطلب (يمكن إرسالها في الترويسة أو هنا).               | `req_123456789`      |
| `metadata`     | `object`  | لا    | بيانات إضافية اختيارية تتعلق بالمعاملة.                           | `{ 
  "orderId": "ORD-001" }` |

**استجابة ناجحة (Success Response - Status 200 OK):**

```json
{
  "success": true,
  "data": {
    "transactionId": "uuid-of-transaction",
    "status": "success",
    "providerRef": "reference-from-provider",
    "message": "تمت عملية الدفع بنجاح."
  }
}
```

**استجابة مكررة (Idempotency Response - Status 200 OK):**

```json
{
  "success": true,
  "isDuplicate": true,
  "message": "تمت معالجة هذا الطلب مسبقاً.",
  "data": {
    "transactionId": "uuid-of-previous-transaction",
    "status": "success",
    "providerRef": "reference-from-provider",
    "message": "تمت عملية الدفع بنجاح."
  }
}
```

**استجابة خطأ (Error Response - Status 400 Bad Request / 500 Internal Server Error):**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "رسالة خطأ توضيحية باللغة العربية.",
    "timestamp": "2026-03-21T10:30:00.000Z"
  }
}
```

### 2. الحصول على حالة معاملة

`GET /api/v1/payments/status/:id`

تستخدم هذه النقطة للاستعلام عن حالة معاملة معينة باستخدام معرف المعاملة.

**الترويسات المطلوبة:**

- `x-atheer-api-key`: مفتاح API الخاص بالتاجر.

**معلمات المسار (Path Parameters):**

| المعلمة | النوع   | الوصف                   | مثال                 |
| :------ | :----- | :---------------------- | :------------------- |
| `id`    | `string` | معرف المعاملة (UUID). | `uuid-of-transaction` |

**استجابة ناجحة (Success Response - Status 200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "uuid-of-transaction",
    "merchantId": "uuid-of-merchant",
    "nonce": "unique_request_id_123",
    "amount": "100.50",
    "currency": "YER",
    "provider": "jawali",
    "providerRef": "reference-from-provider",
    "status": "success",
    "customerMobile": "777123456",
    "errorCode": null,
    "errorMessage": null,
    "metadata": { "orderId": "ORD-001" },
    "createdAt": "2026-03-21T10:00:00.000Z",
    "updatedAt": "2026-03-21T10:05:00.000Z"
  }
}
```

**استجابة خطأ (Error Response - Status 404 Not Found):**

```json
{
  "success": false,
  "message": "المعاملة غير موجودة."
}
```

### 3. الحصول على إحصائيات مزود خدمة

`GET /api/v1/admin/stats/:provider`

تستخدم هذه النقطة للحصول على إحصائيات لحظية لمزود خدمة دفع معين.

**ملاحظة:** هذه النقطة مخصصة للاستخدام الإداري ويجب حمايتها بشكل مناسب في بيئة الإنتاج.

**معلمات المسار (Path Parameters):**

| المعلمة    | النوع   | الوصف                               | مثال    |
| :--------- | :----- | :---------------------------------- | :------ |
| `provider` | `string` | اسم مزود الخدمة (مثال: `jawali`). | `jawali` |

**استجابة ناجحة (Success Response - Status 200 OK):**

```json
{
  "success": true,
  "data": {
    "provider": "jawali",
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

تستخدم هذه النقطة للحصول على إحصائيات لحظية لجميع مزودي خدمة الدفع المدعومين.

**ملاحظة:** هذه النقطة مخصصة للاستخدام الإداري ويجب حمايتها بشكل مناسب في بيئة الإنتاج.

**استجابة ناجحة (Success Response - Status 200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "provider": "jawali",
      "totalCount": 1500,
      "successCount": 1450,
      "failedCount": 50,
      "totalVolume": 150000.75,
      "dailyVolume": 5000.20,
      "successRate": "96.67%"
    },
    {
      "provider": "wecash",
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
