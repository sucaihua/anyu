const express = require('express');
const path = require('path');
const morgan = require('morgan');
const config = require('./config');
const logger = require('./utils/logger');
const { apiLimiter } = require('./middlewares/rateLimit');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

// API 路由
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/product');
const orderRoutes = require('./routes/order');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const homePopupRoutes = require('./routes/homePopup');

const app = express();

// 基础中间件
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

// 静态前端
app.use(express.static(path.join(__dirname, '../public')));

// 全局限流（仅作用于 API）
app.use('/api', apiLimiter);

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/home-popup', homePopupRoutes);

// 健康检查
app.get('/health', (req, res) => res.json({ code: 0, message: 'ok', data: { status: 'up' } }));

// 前端页面路由（用户端 + 管理端，各自独立的目录与布局）
// HTML 页面逐次返回最新内容，避免浏览器缓存旧页面
const sendPage = (file) => (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(file);
};
const pages = [
  ['/', 'index.html'],
  ['/login', 'login.html'],
  ['/register', 'register.html'],
  ['/user', 'user.html']
];
pages.forEach(([route, file]) => {
  app.get(route, sendPage(path.join(__dirname, '../public', file)));
});

// 管理端独立入口（与用户端完全分开的前端）
app.get('/admin', sendPage(path.join(__dirname, '../public/admin/admin.html')));

// 404 + 错误处理
app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    logger.info(`server running on :${config.port} env=${config.env}`);
  });
}

module.exports = app;
