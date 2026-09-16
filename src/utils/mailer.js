const nodemailer = require('nodemailer');
const logger = require('./logger');

// 校验 SMTP 配置是否完整
function isSmtpUsable(cfg) {
  return !!(cfg && cfg.host && cfg.mail_user && cfg.mail_pass);
}

// 发送单封邮件。cfg 为含密码的完整配置。
async function send(cfg, { to, subject, html }) {
  if (!isSmtpUsable(cfg)) {
    logger.warn('[mail] 未配置 SMTP，跳过发送', { to });
    return { sent: false, reason: 'smtp_not_configured' };
  }
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: Number(cfg.port) || 465,
    secure: Number(cfg.secure) === 1,
    auth: { user: cfg.mail_user, pass: cfg.mail_pass }
  });
  const from = `"${cfg.from_name || 'Anyu'}" <${cfg.from_email || cfg.mail_user}>`;
  const info = await transport.sendMail({ from, to, subject, html });
  return { sent: true, messageId: info.messageId };
}

module.exports = { send, isSmtpUsable };