require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'anyu_shop',
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
    charset: 'utf8mb4',
    timezone: '+08:00'
  },

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB) || 0,
    keyPrefix: 'anyu:'
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'change_me_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change_me_refresh_secret',
    accessExpires: Number(process.env.JWT_ACCESS_EXPIRES) || 900,    // 15 分钟
    refreshExpires: Number(process.env.JWT_REFRESH_EXPIRES) || 604800 // 7 天
  },

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100
  },

  loginFail: {
    limit: Number(process.env.LOGIN_FAIL_LIMIT) || 5,
    lockMs: Number(process.env.LOGIN_FAIL_LOCK_MS) || 15 * 60 * 1000
  }
};
