const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/userController');
const rcCtrl = require('../controllers/rechargeController');
const { authRequired } = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');

router.use(authRequired);

// 个人余额
router.get('/balance', ctrl.balance);
// 充值/消费流水
router.get('/records', ctrl.records);

// 充值申请
router.post('/recharge/submit', validate(rcCtrl.submitSchema), rcCtrl.submit);
router.get('/recharge/list', rcCtrl.listMine);

module.exports = router;
