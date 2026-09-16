const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/orderController');
const { validate } = require('../middlewares/validator');
const { authRequired, adminRequired } = require('../middlewares/auth');

// 下单弹窗提示配置（公开读取，管理员修改）
router.get('/popup', ctrl.getPopup);

// 用户下单
router.post('/', authRequired, validate(ctrl.placeOrderSchema), ctrl.placeOrder);
// 我的订单
router.get('/my', authRequired, ctrl.myOrders);

// 后台
router.get('/admin/list', authRequired, adminRequired, ctrl.adminList);
router.post('/admin/:id/refund', authRequired, adminRequired, ctrl.adminRefund);
router.put('/admin/popup', authRequired, adminRequired, validate(ctrl.popupSchema), ctrl.updatePopup);

module.exports = router;
