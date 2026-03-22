import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import AdminJSSequelize from '@adminjs/sequelize';

import Merchant from '../models/Merchant.js';
import Transaction from '../models/Transaction.js';
import OfflineToken from '../models/OfflineToken.js';

// تفعيل محول Sequelize
AdminJS.registerAdapter({
  Resource: AdminJSSequelize.Resource,
  Database: AdminJSSequelize.Database,
});

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
      },
    },
    {
      resource: Merchant,
      options: {
        properties: {
          apiKey: {
            isVisible: { list: true, filter: true, show: true, edit: false },
          },
        },
      },
    },
    {
      resource: OfflineToken,
    },
  ],
  branding: {
    companyName: 'Atheer Switch - Control Center',
  },
};

const admin = new AdminJS(adminOptions);
const adminRouter = AdminJSExpress.buildRouter(admin);

export { adminRouter };
