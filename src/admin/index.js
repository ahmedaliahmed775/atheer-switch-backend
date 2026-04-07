
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import AdminJSSequelize from '@adminjs/sequelize';
import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import statsService from '../services/statsService.js';
import express from 'express';

// تفعيل محول Sequelize
AdminJS.registerAdapter({
  Resource: AdminJSSequelize.Resource,
  Database: AdminJSSequelize.Database,
});

// صفحة مخصصة للإحصائيات اللحظية (Dashboard)
const dashboardHandler = async (req, res) => {
  // جلب إحصائيات مزودي الخدمة الرئيسيين
  const providers = ['jawali', 'wecash', 'mock'];
  const stats = await Promise.all(providers.map(p => statsService.getProviderStats(p)));

  // جلب عدد التجار والمعاملات
  const merchantCount = await Merchant.count();
  const transactionCount = await Transaction.count();

  // بناء واجهة بسيطة (يمكن تحسينها لاحقاً)
  let html = `<div style="direction:rtl;text-align:right;font-family:'Cairo',sans-serif;">
    <h1>لوحة التحكم - مركز عمليات أثير</h1>
    <h2>إحصائيات المزودين</h2>
    <table border="1" cellpadding="8" style="border-collapse:collapse;">
      <tr><th>المزود</th><th>إجمالي المعاملات</th><th>الناجحة</th><th>الفاشلة</th><th>إجمالي المبالغ</th><th>اليومي</th><th>نسبة النجاح</th></tr>`;
  for (const s of stats) {
    html += `<tr><td>${s.provider}</td><td>${s.totalCount}</td><td>${s.successCount}</td><td>${s.failedCount}</td><td>${s.totalVolume}</td><td>${s.dailyVolume}</td><td>${s.successRate}</td></tr>`;
  }
  html += `</table><br/><h2>إحصائيات عامة</h2><ul>`;
  html += `<li>عدد التجار: <b>${merchantCount}</b></li>`;
  html += `<li>عدد المعاملات: <b>${transactionCount}</b></li>`;
  html += `</ul></div>`;
  res.send(html);
};

// إعداد خيارات AdminJS
const adminOptions = {
  resources: [
    {
      resource: Transaction,
      options: {
        properties: {
          requestPayload: { type: 'textarea' },
          responsePayload: { type: 'textarea' },
        },
        actions: {
          // إجراء مخصص: مراجعة تفاصيل المعاملة (يمكن التوسع لاحقاً)
        }
      },
    },
    {
      resource: Merchant,
      options: {
        properties: {
          apiKey: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
          status: {
            availableValues: [
              { value: 'active', label: 'نشط' },
              { value: 'inactive', label: 'غير نشط' },
              { value: 'suspended', label: 'موقوف' }
            ]
          }
        },
        actions: {
          changeStatus: {
            actionType: 'record',
            icon: 'Adjust',
            label: 'تغيير حالة التاجر',
            guard: 'هل أنت متأكد أنك تريد تغيير حالة التاجر؟',
            isVisible: true,
            component: false, // استخدام نافذة افتراضية
            handler: async (request, response, context) => {
              const { record, h } = context;
              if (!record) {
                return {
                  record: record.toJSON(),
                  notice: {
                    message: 'لم يتم العثور على التاجر',
                    type: 'error',
                  },
                };
              }
              // تدوير الحالة: active -> suspended -> inactive -> active
              const current = record.param('status');
              let next;
              if (current === 'active') next = 'suspended';
              else if (current === 'suspended') next = 'inactive';
              else next = 'active';
              await record.update({ status: next });
              return {
                record: record.toJSON(),
                notice: {
                  message: `تم تغيير حالة التاجر إلى: ${next}`,
                  type: 'success',
                },
              };
            },
            showFilter: false,
          },
        }
      },
    },
  ],
  dashboard: {
    component: false, // سنستخدم route مخصص
    handler: dashboardHandler
  },
  rootPath: '/switch-admin',
  locale: {
    language: 'ar',
    translations: {
      labels: {
        // موارد
        Merchant: 'التجار',
        Transaction: 'المعاملات',
        // صفحات
        Dashboard: 'لوحة الإحصائيات',
      },
      resources: {
        Merchant: {
          properties: {
            name: 'اسم التاجر',
            apiKey: 'مفتاح التاجر',
            status: 'الحالة',
            webhookUrl: 'رابط التنبيهات',
            createdAt: 'تاريخ الإنشاء',
            updatedAt: 'آخر تحديث',
          },
          actions: {
            new: 'إضافة تاجر',
            edit: 'تعديل التاجر',
            show: 'عرض تفاصيل التاجر',
            delete: 'حذف التاجر',
            list: 'قائمة التجار',
            changeStatus: 'تغيير حالة التاجر',
          },
        },
        Transaction: {
          properties: {
            amount: 'المبلغ',
            currency: 'العملة',
            status: 'الحالة',
            provider: 'مزود الخدمة',
            customerMobile: 'رقم العميل',
            createdAt: 'تاريخ الإنشاء',
            updatedAt: 'آخر تحديث',
          },
          actions: {
            new: 'إضافة معاملة',
            edit: 'تعديل المعاملة',
            show: 'عرض تفاصيل المعاملة',
            delete: 'حذف المعاملة',
            list: 'قائمة المعاملات',
          },
        },
      },
      messages: {
        loginWelcome: 'مرحباً بك في مركز عمليات أثير',
        successfullyBulkDeleted: 'تم حذف العناصر بنجاح',
        successfullyDeleted: 'تم حذف العنصر بنجاح',
        successfullyUpdated: 'تم تحديث البيانات بنجاح',
        successfullyCreated: 'تمت إضافة العنصر بنجاح',
        noRecordsInResource: 'لا توجد بيانات لعرضها',
        confirmDelete: 'هل أنت متأكد أنك تريد الحذف؟',
        errorFetchingRecords: 'حدث خطأ أثناء جلب البيانات',
        error404Resource: 'العنصر غير موجود',
        forbiddenError: 'غير مصرح لك بتنفيذ هذا الإجراء',
      },
      buttons: {
        save: 'حفظ',
        addNewItem: 'إضافة جديد',
        filter: 'تصفية',
        applyChanges: 'تطبيق التغييرات',
        resetFilter: 'إعادة التصفية',
        confirm: 'تأكيد',
        cancel: 'إلغاء',
        delete: 'حذف',
        edit: 'تعديل',
        show: 'عرض',
        back: 'رجوع',
        close: 'إغلاق',
        export: 'تصدير',
      },
    },
    direction: 'rtl',
  },
  branding: {
    companyName: 'أثير - مركز العمليات',
    logo: false,
    softwareBrothers: false,
    favicon: '/favicon.ico',
    theme: {
      colors: {
        primary100: '#0d6efd',
        accent: '#198754',
        filterBg: '#f8f9fa',
      },
    },
  },
};

const admin = new AdminJS(adminOptions);
const adminRouter = AdminJSExpress.buildRouter(admin);

// إضافة route مخصص للوحة الإحصائيات
const customRouter = express.Router();
customRouter.get('/dashboard', dashboardHandler);
adminRouter.use('/dashboard', customRouter);

export { adminRouter };
