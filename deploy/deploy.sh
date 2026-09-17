#!/bin/bash
# Anyu 自动部署：拉代码 + 重装依赖 + 通过 PM2 重启
export PATH=/www/server/nvm/versions/node/v24.14.1/bin:/usr/local/bin:/usr/bin:/bin
cd /www/wwwroot/anyu || { echo "[deploy] dir missing"; exit 1; }
echo "[deploy] git fetch + reset (以远程代码为准)"
git fetch origin 2>&1
git reset --hard origin/master 2>&1
reset_rc=$?
if [ $reset_rc -ne 0 ]; then
  echo "[deploy] git fetch/reset failed ($reset_rc)"
  exit $reset_rc
fi
echo "[deploy] npm install"
npm install --production --no-audit --no-fund 2>&1 || true
echo "[deploy] pm2 restart anyu (as www)"
WWW_HOME=$(getent passwd www | cut -d: -f6)
su -s /bin/bash www -c "export PATH=$PATH; export HOME=$WWW_HOME; cd /www/wwwroot/anyu && pm2 restart anyu --update-env 2>&1"
echo "[deploy] done"