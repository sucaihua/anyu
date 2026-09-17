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
router.put('/password', authRequired, validate(ctrl.changePasswordSchema), ctrl.changePassword);
router.put('/email', authRequired, validate(ctrl.changeEmailSchema), ctrl.changeEmail);

module.exports = router;
