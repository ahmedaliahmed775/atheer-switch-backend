/**
 * حماية مسارات الإدارة في الإنتاج عبر ترويسة x-atheer-admin-key
 */
export const requireAdminApiKey = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const expected = process.env.ADMIN_API_KEY;
  if (!expected || String(expected).length < 16) {
    return res.status(503).json({
      success: false,
      message:
        'مسارات الإدارة غير مفعّلة. عيّن ADMIN_API_KEY قوياً (16 حرفاً على الأقل) في متغيرات البيئة.'
    });
  }

  const provided = req.headers['x-atheer-admin-key'];
  if (provided !== expected) {
    return res.status(401).json({
      success: false,
      message: 'مفتاح الإدارة غير صالح أو مفقود.'
    });
  }

  next();
};
