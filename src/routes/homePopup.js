const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/homePopupController');

// 首页弹窗配置（公开读取）
router.get('/', ctrl.getPublic);

module.exports = router;
