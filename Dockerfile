# استخدام صورة Node.js الرسمية كقاعدة
FROM node:22-alpine

# تحديد مجلد العمل داخل الحاوية
WORKDIR /usr/src/app

# نسخ ملفات التبعيات أولاً لتحسين سرعة البناء
COPY package*.json ./

# تثبيت التبعيات
RUN npm install --production

# نسخ باقي ملفات المشروع
COPY . .

# تحديد المنفذ الذي سيعمل عليه التطبيق
EXPOSE 3000

# أمر تشغيل التطبيق
CMD ["npm", "start"]
