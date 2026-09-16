const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { validate } = require('../middlewares/validator');
const { authRequired } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimit');

// 注册 / 登录 走严格限流
router.post('/register', authLimiter, validate(ctrl.registerSchema), ctrl.register);
router.post('/login', authLimiter, validate(ctrl.loginSchema), ctrl.login);
router.post('/refresh', authLimiter, validate(ctrl.refreshSchema), ctrl.refresh);
router.post('/logout', ctrl.logout);

// 当前用户
router.get('/me', authRequired, ctrl.me);

module.exports = router;
