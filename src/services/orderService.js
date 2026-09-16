const { getConnection } = require('../config/db');
const productModel = require('../models/productModel');
const orderModel = require('../models/orderModel');
const balanceModel = require('../models/balanceModel');
const popupConfigModel = require('../models/popupConfigModel');
const userModel = require('../models/userModel');
const mailConfigService = require('./mailConfigService');
const { generateOrderNo } = require('../utils/orderNo');
const cache = require('../utils/cache');
const AppError = require('../utils/appError');
const { ERR } = require('../utils/response');
const logger = require('../utils/logger');

// 下单核心流程：单事务完成库存行锁 + 扣余额原子 + 扣库存原子 + 写订单 + 写流水
// 幂等：用 Redis 短期幂等键防同一用户短时间内重复点击
async function placeOrder({ userId, productId, idempotencyKey }) {
  if (!productId) throw new AppError(ERR.PARAMS, '缺少商品 id');

  // 幂等：10 秒内同一 key 直接拒绝
  if (idempotencyKey) {
    const key = `idem:${userId}:${idempotencyKey}`;
    const lockOk = await cache.setLock(key, 10);
    if (!lockOk) {
      throw new AppError(ERR.CONFLICT, '请勿重复提交');
    }
  }

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // 1. 商品行锁（FOR UPDATE）
    const product = await productModel.findByIdForUpdate(conn, productId);
    if (!product || product.status !== 1) {
      await conn.rollback();
      throw new AppError(ERR.NOT_FOUND, '商品不存在或已下架');
    }
    if (product.stock <= 0) {
      await conn.rollback();
      throw new AppError(ERR.STOCK_NOT_ENOUGH, '库存不足');
    }

    // 2. 原子扣余额（amount >= ? 兜底）
    const amount = Number(product.price);
    const affected = await balanceModel.decreaseBalance(conn, userId, amount);
    if (affected !== 1) {
      await conn.rollback();
      throw new AppError(ERR.BALANCE_NOT_ENOUGH, '余额不足');
    }
    // 扣款成功后让余额缓存立即失效，避免下单后余额显示不更新
    await cache.del(`balance:${userId}`);

    // 3. 原子扣库存（WHERE stock > 0）
    const stockAffected = await productModel.decreaseStock(conn, productId);
    if (stockAffected !== 1) {
      await conn.rollback();
      throw new AppError(ERR.STOCK_NOT_ENOUGH, '库存不足');
    }

    // 4. 写订单（含商品快照）
    const orderNo = generateOrderNo(userId);
    const orderId = await orderModel.createOrder(conn, {
      orderNo,
      userId,
      productId,
      productName: product.name,
      amount,
      status: 1 // 已支付
    });

    // 5. 写余额流水（消费）
    // 取扣款后余额用于流水对账
    const [balRows] = await conn.execute(
      'SELECT amount FROM balances WHERE user_id = ? LIMIT 1',
      [userId]
    );
    const balanceAfter = balRows[0]?.amount ?? 0;
    await balanceModel.insertRecord(conn, {
      userId,
      type: 2, // 消费
      amount,
      balanceAfter,
      refOrderId: orderId,
      remark: `下单：${product.name}`
    });

    await conn.commit();

    // 失效商品缓存（库存变了）
    await cache.del('products:list');
    await cache.del(`product:${productId}`);

    const result = { orderId, orderNo, amount, productName: product.name };

    // 下单后邮箱提醒（fire-and-forget：邮件失败不影响下单结果）
    userModel.findById(userId).then((u) => {
      if (u) {
        mailConfigService
          .sendOrderReminder({ to: u.email, orderNo, productName: product.name, amount })
          .catch(() => {});
      }
    }).catch(() => {});

    return result;
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    if (err.isAppError) throw err;
    logger.error('[order] placeOrder error', { err: err.message });
    throw new AppError(ERR.SERVER, '下单失败');
  } finally {
    conn.release();
  }
}

// 用户订单列表
async function listMyOrders(userId, params) {
  return orderModel.listByUser(userId, params);
}

// 后台订单列表
async function adminListOrders(params) {
  return orderModel.listForAdmin(params);
}

// 后台退款：把订单状态改回，余额加回，写流水
async function refund(orderId, operatorId) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const [orderRows] = await conn.execute(
      'SELECT id, user_id, amount, status FROM orders WHERE id = ? LIMIT 1 FOR UPDATE',
      [orderId]
    );
    const order = orderRows[0];
    if (!order) {
      await conn.rollback();
      throw new AppError(ERR.NOT_FOUND, '订单不存在');
    }
    if (order.status !== 1) {
      await conn.rollback();
      throw new AppError(ERR.CONFLICT, '订单状态不可退款');
    }
    // 订单标记退款
    await conn.execute('UPDATE orders SET status = 2 WHERE id = ?', [orderId]);
    // 余额加回
    await balanceModel.increaseBalance(conn, order.user_id, order.amount);
    // 取新余额
    const [balRows] = await conn.execute(
      'SELECT amount FROM balances WHERE user_id = ? LIMIT 1',
      [order.user_id]
    );
    const balanceAfter = balRows[0]?.amount ?? 0;
    await balanceModel.insertRecord(conn, {
      userId: order.user_id,
      type: 3, // 退款
      amount: order.amount,
      balanceAfter,
      refOrderId: order.id,
      operatorId,
      remark: '订单退款'
    });
    await conn.commit();
    return { ok: true };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    if (err.isAppError) throw err;
    logger.error('[order] refund error', { err: err.message });
    throw new AppError(ERR.SERVER, '退款失败');
  } finally {
    conn.release();
  }
}

// 下单弹窗提示配置（缓存）
async function getPopupConfig() {
  const cached = await cache.get('config:order_popup');
  if (cached) return cached;
  const cfg = await popupConfigModel.getConfig();
  await cache.set('config:order_popup', cfg, 300);
  return cfg;
}

async function updatePopupConfig(data, operatorId) {
  await popupConfigModel.updateConfig({ ...data, updatedBy: operatorId });
  await cache.del('config:order_popup');
  return { ok: true };
}

module.exports = {
  placeOrder,
  listMyOrders,
  adminListOrders,
  refund,
  getPopupConfig,
  updatePopupConfig
};
