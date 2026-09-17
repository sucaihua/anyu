#!/bin/bash
set -e
exec > >(tee /root/s1_system.log) 2>&1
echo "=== step: base tools ==="
yum install -y tar gzip git curl

echo "=== nodejs module available? ==="
node_streams=$(dnf module list nodejs 2>/dev/null | awk '{print $2}' | sort -u | tr '\n' ' ')
echo "streams: $node_streams"
if echo "$node_streams" | grep -qw '20'; then
  echo "enable nodejs:20"
  dnf module reset -y nodejs || true
  dnf module enable -y nodejs:20
  dnf install -y nodejs
else
  echo "nodejs:20 unavailable, fallback nodesource 20"
  curl -fsSL https://rpm.nodesource.com/setup_20.x -o /tmp/setup_node20 || true
  if [ -s /tmp/setup_node20 ]; then bash /tmp/setup_node20; yum install -y nodejs; else echo "nodesource failed"; fi
fi
node -v || true

echo "=== mysql ==="
yum install -y mysql-server
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

echo "=== mysql optimization ==="
if [ ! -f /etc/my.cnf.d/90-anyu.cnf ]; then
  printf '[mysqld]\ninnodb_buffer_pool_size=128M\nperformance_schema=OFF\nmax_connections=100\n' > /etc/my.cnf.d/90-anyu.cnf
fi

echo "=== enable services ==="
systemctl enable mysqld redis 2>/dev/null || true
systemctl start mysqld || true
systemctl start redis || true
sleep 3
systemctl is-active mysqld redis || true
echo "=== done s1 ==="