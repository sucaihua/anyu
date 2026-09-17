-- Anyu Shop Schema
-- Engine: InnoDB / Charset: utf8mb4

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- users 用户表
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL,
  `email` VARCHAR(120) NOT NULL,
  `password_hash` VARCHAR(100) NOT NULL,
  `role` TINYINT NOT NULL DEFAULT 0 COMMENT '0 用户 / 1 管理员',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '0 禁用 / 1 正常',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ----------------------------
-- balances 余额表（与用户 1:1）
-- ----------------------------
DROP TABLE IF EXISTS `balances`;
CREATE TABLE `balances` (
  `user_id` BIGINT NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '当前余额',
  `version` INT NOT NULL DEFAULT 0 COMMENT '乐观锁',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_balances_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户余额表';

-- 余额非负约束（MySQL 8+ 用 CHECK，低版本用触发器）
ALTER TABLE `balances` ADD CONSTRAINT `chk_amount_nonneg` CHECK (`amount` >= 0);

-- ----------------------------
-- balance_records 充值/消费流水
-- ----------------------------
DROP TABLE IF EXISTS `balance_records`;
CREATE TABLE `balance_records` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `type` TINYINT NOT NULL COMMENT '1 充值 / 2 消费 / 3 退款',
  `amount` DECIMAL(12,2) NOT NULL COMMENT '变动金额（正数）',
  `balance_after` DECIMAL(12,2) NOT NULL COMMENT '变动后余额',
  `ref_order_id` BIGINT NULL COMMENT '关联订单（消费时）',
  `operator_id` BIGINT NULL COMMENT '手动操作的管理员',
  `remark` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_created` (`user_id`, `created_at`),
  KEY `idx_order` (`ref_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='余额流水';

-- ----------------------------
-- categories 商品分类表
-- ----------------------------
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序，越小越靠前',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '0 停用 / 1 启用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  KEY `idx_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品分类';

-- ----------------------------
-- products 商品表
-- ----------------------------
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `category_id` INT NULL,
  `name` VARCHAR(120) NOT NULL,
  `price` DECIMAL(12,2) NOT NULL,
  `stock` INT NOT NULL DEFAULT 0,
  `cover` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '0 下架 / 1 上架',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_category` (`category_id`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品表';

INSERT INTO `categories` (`name`, `sort_order`) VALUES ('未分类', 9999);

-- ----------------------------
-- orders 订单表
-- ----------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_no` VARCHAR(32) NOT NULL,
  `user_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `product_name` VARCHAR(120) NOT NULL COMMENT '商品快照',
  `amount` DECIMAL(12,2) NOT NULL COMMENT '扣款金额',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0 待支付 / 1 已支付 / 2 已退款',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_user_created` (`user_id`, `created_at`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- ----------------------------
-- refresh_tokens 刷新令牌（可吊销）
-- ----------------------------
DROP TABLE IF EXISTS `refresh_tokens`;
CREATE TABLE `refresh_tokens` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `token_hash` VARCHAR(100) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `revoked` TINYINT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_token` (`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='刷新令牌';

-- ----------------------------
-- order_popup_config 下单弹窗配置（单条记录）
-- ----------------------------
DROP TABLE IF EXISTS `order_popup_config`;
CREATE TABLE `order_popup_config` (
  `id` INT NOT NULL DEFAULT 1,
  `enabled` TINYINT NOT NULL DEFAULT 0,
  `title` VARCHAR(120) NULL,
  `content` TEXT NULL,
  `account_name` VARCHAR(120) NULL,
  `bank_card` VARCHAR(120) NULL,
  `bank_name` VARCHAR(120) NULL,
  `updated_by` BIGINT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='下单/充值弹窗配置（含银行卡收款信息）';

INSERT INTO `order_popup_config` (`id`, `enabled`, `title`, `content`)
VALUES (1, 0, '充值提示', '请按以下银行卡信息转账，转账后提交申请等待后台确认到账。');

-- ----------------------------
-- mail_config 邮件通知配置（单条记录，用于下单后邮箱提醒）
-- ----------------------------
DROP TABLE IF EXISTS `mail_config`;
CREATE TABLE `mail_config` (
  `id` INT NOT NULL DEFAULT 1,
  `enabled` TINYINT NOT NULL DEFAULT 0 COMMENT '是否开启下单邮箱提醒',
  `host` VARCHAR(120) NOT NULL DEFAULT '' COMMENT 'SMTP 主机',
  `port` INT NOT NULL DEFAULT 465 COMMENT 'SMTP 端口',
  `secure` TINYINT NOT NULL DEFAULT 1 COMMENT '是否 SSL 连接',
  `mail_user` VARCHAR(120) NOT NULL DEFAULT '' COMMENT 'SMTP 账号',
  `mail_pass` VARCHAR(120) NOT NULL DEFAULT '' COMMENT 'SMTP 授权码',
  `from_name` VARCHAR(60) NOT NULL DEFAULT 'Anyu',
  `from_email` VARCHAR(120) NOT NULL DEFAULT '' COMMENT '发件邮箱',
  `notify_user` TINYINT NOT NULL DEFAULT 1 COMMENT '是否给下单用户发邮件',
  `admin_to` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '额外通知的管理员邮箱，多个用英文逗号分隔',
  `updated_by` BIGINT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邮件通知配置';

INSERT INTO `mail_config` (`id`) VALUES (1);

-- ----------------------------
-- recharge_requests 用户充值申请单
-- ----------------------------
DROP TABLE IF EXISTS `recharge_requests`;
CREATE TABLE `recharge_requests` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0 待确认 / 1 已到账 / 2 已拒绝',
  `remark` VARCHAR(255) NULL,
  `operator_id` BIGINT NULL COMMENT '处理该申请的管理员',
  `confirmed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户充值申请单';

-- ----------------------------
-- 默认管理员（密码 admin123，bcrypt 哈希需手动生成，建议部署后调用注册接口并改 role）
-- 占位字段后续由 init-db 脚本写入
-- ----------------------------
SET FOREIGN_KEY_CHECKS = 1;
