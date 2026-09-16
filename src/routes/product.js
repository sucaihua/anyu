const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/productController');
const { validate } = require('../middlewares/validator');
const { authRequired, adminRequired } = require('../middlewares/auth');

// 公共：上架商品 + 商品分类
router.get('/', ctrl.list);
router.get('/categories', ctrl.listCategories);
router.get('/:id', ctrl.detail);

// 后台：商品管理
router.get('/admin/list', authRequired, adminRequired, ctrl.adminList);
router.post('/admin', authRequired, adminRequired, validate(ctrl.productSchema), ctrl.adminCreate);
router.put('/admin/:id', authRequired, adminRequired, validate(ctrl.productSchema), ctrl.adminUpdate);

module.exports = router;
