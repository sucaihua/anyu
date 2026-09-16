const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminController');
const catCtrl = require('../controllers/categoryController');
const rcCtrl = require('../controllers/rechargeController');
const { validate } = require('../middlewares/validator');
const { authRequired, adminRequired } = require('../middlewares/auth');

router.use(authRequired, adminRequired);

router.get('/users', ctrl.listUsers);
router.put('/users/:id/status', validate(ctrl.statusSchema), ctrl.setStatus);
router.post('/users/balance', validate(ctrl.addBalanceSchema), ctrl.addBalance);
router.get('/users/:id/records', ctrl.userRecords);

// 商品分类管理
router.get('/categories', catCtrl.adminList);
router.post('/categories', authRequired, adminRequired, validate(catCtrl.categorySchema), catCtrl.adminCreate);
router.put('/categories/:id', authRequired, adminRequired, validate(catCtrl.categorySchema), catCtrl.adminUpdate);
router.delete('/categories/:id', authRequired, adminRequired, catCtrl.adminDelete);

// 充值申请管理
router.get('/recharges', rcCtrl.adminList);
router.put('/recharges/:id/confirm', rcCtrl.confirm);
router.put('/recharges/:id/reject', rcCtrl.reject);

// 邮件通知配置（下单邮箱提醒）
router.get('/mail-config', ctrl.getMailConfig);
router.put('/mail-config', validate(ctrl.updateMailConfigSchema), ctrl.updateMailConfig);
router.post('/mail-config/test', validate(ctrl.testMailSchema), ctrl.testMailConfig);

module.exports = router;
