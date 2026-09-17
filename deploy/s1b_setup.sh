#!/bin/bash
exec > >(tee /root/s1b.log) 2>&1
echo "=== diag mysql exclude ==="
grep -Ei '^exclude' /etc/yum.conf || echo "no exclude in yum.conf"

echo "=== fix & install mysql ==="
dnf module reset -y mysql 2>/dev/null || true
dnf module enable -y mysql:8.0 2>/dev/null || true
yum install -y mysql-server --nobest 2>/dev/null || yum install -y mysql-server
mysql --version 2>/dev/null || true

echo "=== redis ==="
yum install -y redis
echo "=== nginx ==="
yum install -y nginx

echo "=== swap ==="
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q swapfile /etc/fstab || echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
fi
free -m

echo "=== mysql optimize ==="
if [ ! -f /etc/my.cnf.d/90-anyu.cnf ]; then
  printf '[mysqld]\ninnodb_buffer_pool_size=128M\nperformance_schema=OFF\nmax_connections=100\n' > /etc/my.cnf.d/90-anyu.cnf
fi

echo "=== start services ==="
systemctl enable mysqld redis 2>/dev/null || true
systemctl start mysqld
systemctl start redis
sleep 4
systemctl is-active mysqld redis || true

echo "=== mysql root init ==="
# 首次启动 root 走 socket 免密，随后改为密码认证
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'qSHrSP1LH4bAh_myRoot'; FLUSH PRIVILEGES;" 2>&1 || true
echo "=== create db & app user ==="
mysql -uroot -p'qSHrSP1LH4bAh_myRoot' 2>/dev/null <<'SQL'
CREATE DATABASE IF NOT EXISTS anyu_shop DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'anyu'@'127.0.0.1' IDENTIFIED BY 'An2uDB2026App';
CREATE USER IF NOT EXISTS 'anyu'@'localhost' IDENTIFIED BY 'An2uDB2026App';
GRANT ALL PRIVILEGES ON anyu_shop.* TO 'anyu'@'127.0.0.1';
GRANT ALL PRIVILEGES ON anyu_shop.* TO 'anyu'@'localhost';
FLUSH PRIVILEGES;
SQL
echo "=== verify root/app login ==="
mysql -uroot -p'qSHrSP1LH4bAh_myRoot' -e "SELECT VERSION();" 2>/dev/null
mysql -uanyu -p'An2uDB2026App' -h127.0.0.1 -e "SELECT CURRENT_USER();" 2>/dev/null
echo "=== done s1b ==="