const mailConfigModel = require('../models/mailConfigModel');
const cache = require('../utils/cache');
const mailer = require('../utils/mailer');
const logger = require('../utils/logger');
const AppError = require('../utils/appError');
const { ERR } = require('../utils/response');

const CACHE_KEY = 'config:mail';

// 后台展示用（不含密码）
async function getConfig() {
  const cached = await cache.get(CACHE_KEY);
  if (cached) return cached;
  const cfg = await mailConfigModel.getConfig();
  await cache.set(CACHE_KEY, cfg, 300);
  return cfg;
}

async function updateConfig(data, operatorId) {
  await mailConfigModel.updateConfig({
    enabled: data.enabled,
    host: data.host || '',
    port: data.port || 465,
    secure: data.secure,
    mail_user: data.mailUser || '',
    mail_pass: data.mailPass || '',
    from_name: data.fromName || 'Anyu',
    from_email: data.fromEmail || '',
    notify_user: data.notifyUser,
    notify_recharge: data.notifyRecharge !== undefined ? data.notifyRecharge : 1,
    admin_to: data.adminTo || '',
    updatedBy: operatorId
  });
  await cache.del(CACHE_KEY);
  return { ok: true };
}

// 测试发送：向指定地址发一封测试邮件
async function sendTest({ to, operatorId }) {
  const secret = await mailConfigModel.getSecretConfig();
  if (!mailer.isSmtpUsable(secret)) {
    throw new AppError(ERR.PARAMS, 'SMTP 尚未配置完成，请先填写主机、账号、授权码');
  }
  try {
    const ok = await mailer.send(secret, {
      to,
      subject: '【Anyu】邮件配置测试',
      html: `<h3>Anyu 邮件通知测试</h3><p>如果您收到这封邮件，说明 SMTP 邮件配置生效。</p>`
    });
    await cache.del(CACHE_KEY);
    return ok;
  } catch (e) {
    logger.error('[mail] 测试发送失败', { err: e.message });
    throw new AppError(ERR.SERVER, '测试邮件发送失败，请检查 SMTP 主机、账号、授权码及网络');
  }
}

// 下单后发送邮箱提醒（fire-and-forget：失败不阻断下单主流程）
async function sendOrderReminder({ to, orderNo, productName, amount }) {
  try {
    const secret = await mailConfigModel.getSecretConfig();
    if (!secret || Number(secret.enabled) !== 1) return;
    if (!mailer.isSmtpUsable(secret)) return;

    const list = [];
    if (Number(secret.notify_user) === 1 && to) {
      list.push({ to, html: orderHtml({ kind: 'user', orderNo, productName, amount }) });
    }
    // 额外通知管理员（可选）
    if (secret.admin_to) {
      secret.admin_to
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((adminMail) => {
          list.push({ to: adminMail, html: orderHtml({ kind: 'admin', orderNo, productName, amount }) });
        });
    }
    for (const item of list) {
      await mailer.send(secret, { to: item.to, subject: '【Anyu】新订单提醒', html: item.html });
    }
  } catch (err) {
    logger.error('[mail] 下单邮件提醒失败', { err: err.message });
  }
}

function orderHtml({ kind, orderNo, productName, amount }) {
  const title = kind === 'user' ? '您的订单已生成' : '新订单提醒';
  return contentHelpers.html({ title, orderNo, productName, amount, kind });
}

const contentHelpers = {
  html({ title, orderNo, productName, amount, kind }) {
    const data = {
      kind: kind === 'user' ? '用户在商城充值后的账号下单成功' : '系统检测到一笔新订单'
    };
    return `
      <div style="font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px;">
        <h2 style="color:#1e293b;margin:0 0 16px;">${title}</h2>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;">
          <p style="margin:0 0 12px;color:#475569;">${data.kind}</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1e293b;">
            <tr><td style="padding:8px 0;color:#64748b;">订单号</td><td style="padding:8px 0;font-weight:600;text-align:right;">${orderNo}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">商品</td><td style="padding:8px 0;font-weight:600;text-align:right;">${productName}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">金额</td><td style="padding:8px 0;font-weight:700;color:#6366f1;text-align:right;">$${Number(amount).toFixed(2)}</td></tr>
          </table>
        </div>
        <p style="margin-top:20px;color:#94a3b8;font-size:12px;">此邮件由 Anyu 系统自动发送，请勿直接回复。</p>
      </div>`;
  }
};

// 用户提交充值申请后通知管理员（fire-and-forget：失败不阻断提交主流程）
async function sendRechargeSubmitNotify({ username, email, amount, requestId, remark }) {
  try {
    const secret = await mailConfigModel.getSecretConfig();
    if (!secret || Number(secret.enabled) !== 1) return;
    if (!mailer.isSmtpUsable(secret)) return;
    if (Number(secret.notify_recharge) !== 1) return;

    // 管理员邮箱：优先 admin_to；未配置时默认发到 SMTP 发送邮箱（mail_user）
    const targets = (secret.admin_to || '')
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!targets.length && secret.mail_user) targets.push(secret.mail_user);
    if (!targets.length) return;

    targets.forEach((adminMail) => {
      mailer.send(secret, {
        to: adminMail,
        subject: '【Anyu】新充值申请提醒',
        html: rechargeHtml({ kind: 'submit', username, email, amount, requestId, remark })
      }).catch((e) => logger.warn('[mail] 充值申请通知发送失败', { err: e.message, to: adminMail }));
    });
  } catch (err) {
    logger.error('[mail] 充值申请邮件提醒失败', { err: err.message });
  }
}

// 充值确认到账后通知用户（fire-and-forget：失败不阻断确认主流程）
async function sendRechargeConfirmedNotify({ to, username, amount, balanceAfter, requestId }) {
  try {
    const secret = await mailConfigModel.getSecretConfig();
    if (!secret || Number(secret.enabled) !== 1) return;
    if (!mailer.isSmtpUsable(secret)) return;
    if (Number(secret.notify_recharge) !== 1) return;
    if (!to) return;

    await mailer.send(secret, {
      to,
      subject: '【Anyu】充值到账提醒',
      html: rechargeHtml({ kind: 'confirmed', username, amount, balanceAfter, requestId })
    });
  } catch (err) {
    logger.error('[mail] 充值到账邮件提醒失败', { err: err.message });
  }
}

function rechargeHtml({ kind, username, email, amount, balanceAfter, requestId, remark }) {
  const isSubmit = kind === 'submit';
  const title = isSubmit ? '新的充值申请' : '充值已到账';
  const rows = `
    <tr><td style="padding:8px 0;color:#64748b;">用户</td><td style="padding:8px 0;font-weight:600;text-align:right;">${username || '-'}</td></tr>
    ${isSubmit && email ? `<tr><td style="padding:8px 0;color:#64748b;">用户邮箱</td><td style="padding:8px 0;font-weight:600;text-align:right;">${email}</td></tr>` : ''}
    <tr><td style="padding:8px 0;color:#64748b;">申请单号</td><td style="padding:8px 0;font-weight:600;text-align:right;">#${requestId}</td></tr>
    <tr><td style="padding:8px 0;color:#64748b;">金额</td><td style="padding:8px 0;font-weight:700;color:#10b981;text-align:right;">$${Number(amount).toFixed(2)}</td></tr>
    ${isSubmit
      ? `<tr><td style="padding:8px 0;color:#64748b;">备注</td><td style="padding:8px 0;font-weight:600;text-align:right;">${remark || '-'}</td></tr>`
      : `<tr><td style="padding:8px 0;color:#64748b;">当前余额</td><td style="padding:8px 0;font-weight:700;color:#6366f1;text-align:right;">$${Number(balanceAfter).toFixed(2)}</td></tr>`
    }`;
  const tip = isSubmit
    ? '用户已提交充值申请，请登录后台尽快核对并确认到账。'
    : '您的充值申请已确认到账，余额已更新，祝您购物愉快。';
  return `
    <div style="font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px;">
      <h2 style="color:#1e293b;margin:0 0 16px;">${title}</h2>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;">
        <p style="margin:0 0 12px;color:#475569;">${tip}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1e293b;">${rows}</table>
      </div>
      <p style="margin-top:20px;color:#94a3b8;font-size:12px;">此邮件由 Anyu 系统自动发送，请勿直接回复。</p>
    </div>`;
}

module.exports = { getConfig, updateConfig, sendTest, sendOrderReminder, sendRechargeSubmitNotify, sendRechargeConfirmedNotify };