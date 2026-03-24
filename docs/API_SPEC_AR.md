# توثيق واجهة برمجة تطبيقات Atheer Switch (API Specification)

## مقدمة

يقدم هذا المستند توثيقًا شاملاً لواجهة برمجة التطبيقات (API) الخاصة ببوابة الدفع عالية الأداء Atheer Switch. تهدف هذه الواجهة إلى تمكين تطبيقات الأندرويد (عبر Atheer Android SDK) من إرسال طلبات الدفع ومعالجتها بشكل آمن وفعال. تقوم Atheer Switch بدور الوسيط المالي، حيث تتحقق من صحة الطلبات، وتمنع تكرار الإنفاق، وتوجه المعاملات إلى مزودي خدمات الدفع المختلفين مثل Jawali و WeCash، بالإضافة إلى إدارة وتوزيع التوكنز الأوفلاين.

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

**ملاحظة هامة:** تتوقع هذه النقطة الآن أن تكون بيانات الطلب الفعلية (مثل `amount`, `provider`, `customerMobile`, `receiverMobile`, `atheerToken`) متداخلة داخل كائن `body` آخر ضمن جسم الطلب الرئيسي (أي `req.body.body`).

**الترويسات المطلوبة:**

- `x-atheer-api-key`: مفتاح API الخاص بالتاجر.
- `x-atheer-nonce`: قيمة فريدة للطلب.

**جسم الطلب (Request Body):**

```json
{
  "body": {
    "amount": 100.50,
    "currency": "YER",
    "provider": "JEEB",
    "customerMobile": "777123456",
    "receiverMobile": "777654321",
    "atheerToken": "TOKEN_VALUE_1",
    "nonce": "req_123456789",
    "metadata": {
      "orderId": "ORD-001"
    }
  }
}
```

| الحقل          | النوع    | مطلوب | الوصف                                                               | مثال                 |
| :------------- | :------ | :---- | :------------------------------------------------------------------ | :------------------- |
| `body`         | `object`  | نعم   | كائن يحتوي على بيانات الطلب الفعلية.                               | `{ ... }`            |
| `body.amount`         | `number`  | نعم   | قيمة المبلغ المراد دفعه.                                           | `100.50`             |
| `body.currency`       | `string`  | لا    | رمز العملة (افتراضي: `YER`).                                        | `YER`                |
| `body.provider`       | `string`  | نعم   | مزود خدمة الدفع المستهدف (مثال: `JEEB`, `JAWALI`, `WECASH`, `mock`).       | `JEEB`             |
| `body.customerMobile` | `string`  | نعم   | رقم هاتف العميل الذي يقوم بالدفع.                                   | `777123456`          |
| `body.receiverMobile` | `string`  | نعم   | رقم هاتف المستلم (إلزامي).                                         | `777654321`          |
| `body.atheerToken`    | `string`  | نعم   | التوكن المستخدم في العملية (إلزامي).                               | `TOKEN_VALUE_1`      |
| `body.nonce`          | `string`  | نعم   | قيمة فريدة للطلب (يمكن إرسالها في الترويسة أو هنا).               | `req_123456789`      |
| `body.metadata`       | `object`  | لا    | بيانات إضافية اختيارية تتعلق بالمعاملة.                           | `{ "orderId": "ORD-001" }` |

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

### 2. طلب تخصيص توكنز أوفلاين

`POST /api/v1/payments/tokens/provision`

تستخدم هذه النقطة لطلب تخصيص توكنز أوفلاين من Atheer Switch لعميل معين ومزود محدد. يتم استخدام هذه التوكنز لاحقًا في عمليات الدفع الأوفلاين.

**الترويسات المطلوبة:**

- `x-atheer-api-key`: مفتاح API الخاص بالتاجر.

**جسم الطلب (Request Body):**

```json
{
  "body": {
    "providerName": "JEEB",
    "customerId": "777123456",
    "count": 1
  }
}
```

| الحقل          | النوع    | مطلوب | الوصف                                                               | مثال                 |
| :------------- | :------ | :---- | :------------------------------------------------------------------ | :------------------- |
| `body`         | `object`  | نعم   | كائن يحتوي على بيانات طلب التوكنز.                                | `{ ... }`            |
| `body.providerName` | `string`  | نعم   | اسم مزود المحفظة المطلوب (مثال: `JEEB`, `JAWALI`).                 | `JEEB`               |
| `body.customerId`   | `string`  | نعم   | معرف العميل الذي سيتم تخصيص التوكنز له (عادة رقم الهاتف).         | `777123456`          |
| `body.count`        | `number`  | لا    | عدد التوكنز المطلوب تخصيصها (افتراضي: 1).                          | `1`                  |

**استجابة ناجحة (Success Response - Status 200 OK):**

```json
{
  "status": "success",
  "message": "تم تخصيص 1 توكنز بنجاح لمزود JEEB",
  "data": {
    "tokens": [
      {
        "id": "uuid-of-token-1",
        "tokenValue": "TOKEN_VALUE_1",
        "providerName": "JEEB",
        "expiryDate": "2027-03-21T10:00:00.000Z"
      }
    ],
    "customerId": "777123456",
    "provider": "JEEB"
  }
}
```

**استجابة خطأ (Error Response - Status 400 Bad Request / 500 Internal Server Error):**

```json
{
  "status": "error",
  "message": "لا توجد توكنز متاحة حالياً للمزود: JEEB"
}
```

### 3. الحصول على حالة معاملة

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
    "provider": "JEEB",
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

### 4. الحصول على إحصائيات مزود خدمة

`GET /api/v1/admin/stats/:provider`

تستخدم هذه النقطة للحصول على إحصائيات لحظية لمزود خدمة دفع معين.

**ملاحظة:** هذه النقطة مخصصة للاستخدام الإداري ويجب حمايتها بشكل مناسب في بيئة الإنتاج.

**معلمات المسار (Path Parameters):**

| المعلمة    | النوع   | الوصف                               | مثال    |
| :--------- | :----- | :---------------------------------- | :------ |
| `provider` | `string` | اسم مزود الخدمة (مثال: `JEEB`). | `JEEB` |

**استجابة ناجحة (Success Response - Status 200 OK):**

```json
{
  "success": true,
  "data": {
    "provider": "JEEB",
    "totalCount": 1500,
    "successCount": 1450,
    "failedCount": 50,
    "totalVolume": 150000.75,
    "dailyVolume": 5000.20,
    "successRate": "96.67%"
  }
}
```

### 5. الحصول على إحصائيات جميع مزودي الخدمة

`GET /api/v1/admin/stats/all`

تستخدم هذه النقطة للحصول على إحصائيات لحظية لجميع مزودي خدمة الدفع المدعومين.

**ملاحظة:** هذه النقطة مخصصة للاستخدام الإداري ويجب حمايتها بشكل مناسب في بيئة الإنتاج.

**استجابة ناجحة (Success Response - Status 200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "provider": "JEEB",
      "totalCount": 1500,
      "successCount": 1450,
      "failedCount": 50,
      "totalVolume": 150000.75,
      "dailyVolume": 5000.20,
      "successRate": "96.67%"
    },
    {
      "provider": "JAWALI",
      "totalCount": 800,
      "successCount": 780,
      "failedCount": 20,
      "totalVolume": 80000.00,
      "dailyVolume": 2500.00,
      "successRate": "97.50%"
    },
    {
      "provider": "WECASH",
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
