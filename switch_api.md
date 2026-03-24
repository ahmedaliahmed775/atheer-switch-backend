## Classes

<dl>
<dt><a href="#TokenController">TokenController</a></dt>
<dd></dd>
<dt><a href="#RouterService">RouterService</a></dt>
<dd><p>خدمة توجيه المعاملات (Router Service)
تقوم بتوجيه المعاملات إلى مزود الخدمة المناسب (مثل JEEB أو JAWALI)
بناءً على نوع المعاملة أو بيانات التاجر القادمة من الـ SDK.</p>
</dd>
<dt><a href="#StatsService">StatsService</a></dt>
<dd><p>خدمة الإحصائيات (Stats Service)
تقوم بتسجيل وتحديث إحصائيات المعاملات اللحظية في Redis.
تستخدم لتوفير لوحة تحكم فورية لشركات الاتصالات ومزودي الخدمة.</p>
</dd>
<dt><a href="#TokenService">TokenService</a></dt>
<dd><p>خدمة إدارة التوكنز (Token Service)
تتعامل مع منطق البحث والتوزيع للتوكنز الأوفلاين.</p>
</dd>
</dl>

## Constants

<dl>
<dt><a href="#logger">logger</a></dt>
<dd><p>إعداد سجلات الأخطاء (Winston Logger)
يتم تسجيل الأخطاء في ملفات منفصلة حسب المستوى.</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#processPayment">processPayment(req, res, next)</a> ⇒ <code>Object</code></dt>
<dd><ul>
<li>ينشئ سجل معاملة جديدة بحالة pending.</li>
<li>يوجه الطلب إلى مزود الخدمة المناسب عبر الأدابترز.</li>
<li>يحدث حالة المعاملة بناءً على نتيجة المزود.</li>
<li>يدعم منطق Idempotency عبر Redis لمنع تكرار العمليات.</li>
<li>جميع الأخطاء المالية ترمز عبر error.code.</li>
</ul>
</dd>
<dt><a href="#getTransactionStatus">getTransactionStatus(req, res, next)</a> ⇒ <code>Object</code></dt>
<dd><ul>
<li>يبحث عن معاملة برقم id وتاجر محدد.</li>
<li>يعيد تفاصيل المعاملة أو رسالة خطأ.</li>
</ul>
</dd>
<dt><a href="#getProviderStats">getProviderStats(req, res, next)</a> ⇒ <code>Object</code></dt>
<dd><ul>
<li>يجلب الإحصائيات من Redis لمزود الخدمة المحدد.</li>
</ul>
</dd>
<dt><a href="#getAllStats">getAllStats(req, res, next)</a> ⇒ <code>Object</code></dt>
<dd><ul>
<li>يجلب الإحصائيات لجميع المزودين المدعومين.</li>
</ul>
</dd>
<dt><a href="#requireAdminApiKey">requireAdminApiKey(req, res, next)</a> ⇒ <code>void</code></dt>
<dd><ul>
<li>يتحقق من متغير البيئة ADMIN_API_KEY.</li>
<li>يسمح بالوصول لمسارات الإدارة فقط إذا كان المفتاح صحيحاً.</li>
</ul>
</dd>
<dt><a href="#authenticateMerchant">authenticateMerchant(req, res, next)</a> ⇒ <code>void</code></dt>
<dd><ul>
<li>يتحقق من وجود API Key.</li>
<li>يبحث عن التاجر في قاعدة البيانات.</li>
<li>يضيف بيانات التاجر للطلب أو يعيد خطأ.</li>
</ul>
</dd>
<dt><a href="#errorHandler">errorHandler(err, req, res, next)</a> ⇒ <code>void</code></dt>
<dd><ul>
<li>يسجل الخطأ في السجلات.</li>
<li>يعيد استجابة JSON موحدة للعميل.</li>
</ul>
</dd>
<dt><a href="#checkIdempotency">checkIdempotency(req, res, next)</a> ⇒ <code>void</code></dt>
<dd><ul>
<li>يتحقق من وجود nonce في Redis.</li>
<li>إذا وجد، يعيد الاستجابة السابقة.</li>
<li>إذا لم يوجد، يضيف دالة لحفظ النتيجة بعد التنفيذ.</li>
</ul>
</dd>
</dl>

<a name="TokenController"></a>

## TokenController
**Kind**: global class  

* [TokenController](#TokenController)
    * [new TokenController()](#new_TokenController_new)
    * [.requestTokens(req, res)](#TokenController.requestTokens) ⇒ <code>Object</code>

<a name="new_TokenController_new"></a>

### new TokenController()
متحكم التوكنز (Token Controller)
يستقبل طلبات الـ SDK لطلب التوكنز الأوفلاين ويتحقق من هوية التاجر.

<a name="TokenController.requestTokens"></a>

### TokenController.requestTokens(req, res) ⇒ <code>Object</code>
- يتحقق من الحقول المطلوبة.
- يستدعي خدمة توزيع التوكنز.
- يعيد التوكنز المخصصة أو رسالة خطأ.

**Kind**: static method of [<code>TokenController</code>](#TokenController)  
**Returns**: <code>Object</code> - استجابة JSON:
  - في حال النجاح:
    {
      status: 'success',
      message: رسالة نجاح
      data: {
        tokens: قائمة التوكنز المخصصة
        customerId: رقم العميل
        provider: اسم المزود
      }
    }
  - في حال الفشل:
    {
      status: 'error',
      message: شرح الخطأ
    }  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>Object</code> | كائن الطلب (Request) ويحتوي على:   - body.body: {       providerName (String): اسم مزود الخدمة       customerId (String): رقم تعريف العميل       count (Number): عدد التوكنز المطلوبة (اختياري)     }   - merchant.id: رقم تعريف التاجر (يتم حقنه من الميدل وير) |
| res | <code>Object</code> | كائن الاستجابة (Response) |

<a name="RouterService"></a>

## RouterService
خدمة توجيه المعاملات (Router Service)
تقوم بتوجيه المعاملات إلى مزود الخدمة المناسب (مثل JEEB أو JAWALI)
بناءً على نوع المعاملة أو بيانات التاجر القادمة من الـ SDK.

**Kind**: global class  
<a name="RouterService+routeTransaction"></a>

### routerService.routeTransaction(transaction) ⇒ <code>Promise.&lt;Object&gt;</code>
توجيه المعاملة إلى مزود الخدمة المناسب

**Kind**: instance method of [<code>RouterService</code>](#RouterService)  
**Returns**: <code>Promise.&lt;Object&gt;</code> - - نتيجة المعاملة من مزود الخدمة  

| Param | Type | Description |
| --- | --- | --- |
| transaction | <code>Object</code> | بيانات المعاملة |

<a name="StatsService"></a>

## StatsService
خدمة الإحصائيات (Stats Service)
تقوم بتسجيل وتحديث إحصائيات المعاملات اللحظية في Redis.
تستخدم لتوفير لوحة تحكم فورية لشركات الاتصالات ومزودي الخدمة.

**Kind**: global class  

* [StatsService](#StatsService)
    * [.incrementProviderStats(provider, amount, isSuccess)](#StatsService+incrementProviderStats)
    * [.getProviderStats(provider)](#StatsService+getProviderStats) ⇒ <code>Promise.&lt;Object&gt;</code>

<a name="StatsService+incrementProviderStats"></a>

### statsService.incrementProviderStats(provider, amount, isSuccess)
تحديث إحصائيات مزود الخدمة

**Kind**: instance method of [<code>StatsService</code>](#StatsService)  

| Param | Type | Description |
| --- | --- | --- |
| provider | <code>string</code> | اسم مزود الخدمة (مثل jawali) |
| amount | <code>number</code> | قيمة المعاملة |
| isSuccess | <code>boolean</code> | هل نجحت المعاملة؟ |

<a name="StatsService+getProviderStats"></a>

### statsService.getProviderStats(provider) ⇒ <code>Promise.&lt;Object&gt;</code>
الحصول على الإحصائيات الحالية لمزود خدمة

**Kind**: instance method of [<code>StatsService</code>](#StatsService)  
**Returns**: <code>Promise.&lt;Object&gt;</code> - - بيانات الإحصائيات  

| Param | Type | Description |
| --- | --- | --- |
| provider | <code>string</code> | اسم مزود الخدمة |

<a name="TokenService"></a>

## TokenService
خدمة إدارة التوكنز (Token Service)
تتعامل مع منطق البحث والتوزيع للتوكنز الأوفلاين.

**Kind**: global class  
<a name="TokenService+provisionTokens"></a>

### tokenService.provisionTokens(providerName, customerId, count, merchantId) ⇒ <code>Promise.&lt;Array&gt;</code>
توزيع التوكنز لعميل محدد

**Kind**: instance method of [<code>TokenService</code>](#TokenService)  
**Returns**: <code>Promise.&lt;Array&gt;</code> - - قائمة التوكنز المخصصة  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| providerName | <code>string</code> |  | اسم مزود المحفظة |
| customerId | <code>string</code> |  | معرف العميل (رقم الهاتف أو المعرف) |
| count | <code>number</code> | <code>1</code> | عدد التوكنز المطلوبة |
| merchantId | <code>string</code> | <code>null</code> | معرف التاجر الطالب للتوكنز |

<a name="logger"></a>

## logger
إعداد سجلات الأخطاء (Winston Logger)
يتم تسجيل الأخطاء في ملفات منفصلة حسب المستوى.

**Kind**: global constant  
<a name="processPayment"></a>

## processPayment(req, res, next) ⇒ <code>Object</code>
- ينشئ سجل معاملة جديدة بحالة pending.
- يوجه الطلب إلى مزود الخدمة المناسب عبر الأدابترز.
- يحدث حالة المعاملة بناءً على نتيجة المزود.
- يدعم منطق Idempotency عبر Redis لمنع تكرار العمليات.
- جميع الأخطاء المالية ترمز عبر error.code.

**Kind**: global function  
**Returns**: <code>Object</code> - استجابة JSON:
  - في حال النجاح:
    {
      success: true,
      data: {
        transactionId: رقم المعاملة
        status: 'success'
        providerRef: مرجع مزود الخدمة
        message: رسالة نجاح
      }
    }
  - في حال الفشل:
    {
      success: false,
      error: {
        code: رمز الخطأ المالي
        message: شرح الخطأ
      }
    }  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>Object</code> | كائن الطلب (Request) ويحتوي على:   - body.body: {       amount (Number): المبلغ المطلوب دفعه       currency (String): العملة (افتراضي YER)       provider (String): اسم مزود الخدمة (jawali/wecash/mock)       customerMobile (String): رقم العميل       nonce (String): رقم عشوائي لضمان عدم التكرار       metadata (Object): بيانات إضافية اختيارية     }   - merchant.id: رقم تعريف التاجر (يتم حقنه من الميدل وير) |
| res | <code>Object</code> | كائن الاستجابة (Response) |
| next | <code>function</code> | دالة تمرير الأخطاء |

<a name="getTransactionStatus"></a>

## getTransactionStatus(req, res, next) ⇒ <code>Object</code>
- يبحث عن معاملة برقم id وتاجر محدد.
- يعيد تفاصيل المعاملة أو رسالة خطأ.

**Kind**: global function  
**Returns**: <code>Object</code> - استجابة JSON:
  - في حال وجود المعاملة:
    {
      success: true,
      data: تفاصيل المعاملة
    }
  - في حال عدم وجودها:
    {
      success: false,
      message: 'المعاملة غير موجودة.'
    }  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>Object</code> | كائن الطلب ويحتوي على:   - params.id: رقم المعاملة   - merchant.id: رقم التاجر (من الميدل وير) |
| res | <code>Object</code> | كائن الاستجابة |
| next | <code>function</code> | دالة تمرير الأخطاء |

<a name="getProviderStats"></a>

## getProviderStats(req, res, next) ⇒ <code>Object</code>
- يجلب الإحصائيات من Redis لمزود الخدمة المحدد.

**Kind**: global function  
**Returns**: <code>Object</code> - استجابة JSON:
  - في حال النجاح:
    {
      success: true,
      data: بيانات الإحصائيات
    }
  - في حال الفشل:
    {
      success: false,
      message: شرح الخطأ
    }  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>Object</code> | كائن الطلب ويحتوي على:   - params.provider: اسم مزود الخدمة |
| res | <code>Object</code> | كائن الاستجابة (Response) |
| next | <code>function</code> | دالة تمرير الأخطاء |

<a name="getAllStats"></a>

## getAllStats(req, res, next) ⇒ <code>Object</code>
- يجلب الإحصائيات لجميع المزودين المدعومين.

**Kind**: global function  
**Returns**: <code>Object</code> - استجابة JSON:
  - في حال النجاح:
    {
      success: true,
      data: قائمة بيانات الإحصائيات لكل مزود
    }
  - في حال الفشل:
    {
      success: false,
      message: شرح الخطأ
    }  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>Object</code> | كائن الطلب (Request) |
| res | <code>Object</code> | كائن الاستجابة (Response) |
| next | <code>function</code> | دالة تمرير الأخطاء |

<a name="requireAdminApiKey"></a>

## requireAdminApiKey(req, res, next) ⇒ <code>void</code>
- يتحقق من متغير البيئة ADMIN_API_KEY.
- يسمح بالوصول لمسارات الإدارة فقط إذا كان المفتاح صحيحاً.

**Kind**: global function  
**Returns**: <code>void</code> - يسمح بالوصول أو يعيد استجابة خطأ في حال عدم توفر الصلاحية.  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>Object</code> | كائن الطلب (Request) |
| res | <code>Object</code> | كائن الاستجابة (Response) |
| next | <code>function</code> | دالة تمرير الأخطاء |

<a name="authenticateMerchant"></a>

## authenticateMerchant(req, res, next) ⇒ <code>void</code>
- يتحقق من وجود API Key.
- يبحث عن التاجر في قاعدة البيانات.
- يضيف بيانات التاجر للطلب أو يعيد خطأ.

**Kind**: global function  
**Returns**: <code>void</code> - في حال النجاح يضيف بيانات التاجر للطلب، وإلا يعيد استجابة خطأ.  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>Object</code> | كائن الطلب (Request) ويحتوي على:   - headers['x-atheer-api-key']: مفتاح الوصول |
| res | <code>Object</code> | كائن الاستجابة (Response) |
| next | <code>function</code> | دالة تمرير الأخطاء |

<a name="errorHandler"></a>

## errorHandler(err, req, res, next) ⇒ <code>void</code>
- يسجل الخطأ في السجلات.
- يعيد استجابة JSON موحدة للعميل.

**Kind**: global function  
**Returns**: <code>void</code> - يعيد استجابة موحدة للعميل مع تسجيل الخطأ.  

| Param | Type | Description |
| --- | --- | --- |
| err | <code>Object</code> | كائن الخطأ |
| req | <code>Object</code> | كائن الطلب (Request) |
| res | <code>Object</code> | كائن الاستجابة (Response) |
| next | <code>function</code> | دالة تمرير الأخطاء |

<a name="checkIdempotency"></a>

## checkIdempotency(req, res, next) ⇒ <code>void</code>
- يتحقق من وجود nonce في Redis.
- إذا وجد، يعيد الاستجابة السابقة.
- إذا لم يوجد، يضيف دالة لحفظ النتيجة بعد التنفيذ.

**Kind**: global function  
**Returns**: <code>void</code> - في حال التكرار يعيد الاستجابة السابقة مباشرة، وإلا يكمل المعالجة.  

| Param | Type | Description |
| --- | --- | --- |
| req | <code>Object</code> | كائن الطلب (Request) ويحتوي على:   - headers['x-atheer-nonce'] أو body.nonce: رقم عشوائي لضمان عدم التكرار |
| res | <code>Object</code> | كائن الاستجابة (Response) |
| next | <code>function</code> | دالة تمرير الأخطاء |

