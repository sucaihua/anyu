#!/bin/bash
exec > >(tee /root/s3.log) 2>&1
ANYU=/www/wwwroot/anyu

echo "=== git identity & safe.directory ==="
git config --global --add safe.directory "$ANYU" 2>/dev/null || true
git config --global user.email "deploy@anyu.local"
git config --global user.name "anyu-deploy"

echo "=== append webhook env ==="
grep -q '^WEBHOOK_SECRET=' "$ANYU/.env" || echo "WEBHOOK_SECRET=2813319028" >> "$ANYU/.env"
grep -q '^WEBHOOK_PORT=' "$ANYU/.env" || echo "WEBHOOK_PORT=9011" >> "$ANYU/.env"

echo "=== nginx: add /pull location ==="
CONF=/www/server/panel/vhost/nginx/ziyuanclub.site.conf
if ! grep -q 'location /pull' "$CONF"; then
  sed -i 's|#PROXY-CONF-START|location /pull {\n        proxy_pass http://127.0.0.1:9011;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n    }\n    #PROXY-CONF-START|' "$CONF"
fi
nginx -t 2>&1 || true
systemctl start nginx 2>/dev/null || true
systemctl reload nginx 2>/dev/null || true

echo "=== git: branch + remote ==="
cd "$ANYU" || exit 1
git remote remove origin 2>/dev/null || true
git remote add origin https://gitee.com/sucaihua/anyu_shop.git
if git symbolic-ref -q HEAD; then
  echo "current: $(git symbolic-ref --short HEAD)"
else
  git checkout -b master 2>/dev/null; git symbolic-ref HEAD refs/heads/master; echo "set master"
fi

echo "=== install & start webhook ==="
cp "$ANYU/deploy/webhook.service" /etc/systemd/system/anyu-webhook.service
systemctl daemon-reload
systemctl enable anyu-webhook 2>/dev/null || true
systemctl restart anyu-webhook
sleep 1
echo "status: $(systemctl is-active anyu-webhook 2>/dev/null)"
echo "--- local webhook test ---"
curl -s -X POST -H 'X-Gitee-Token: 2813319028' http://127.0.0.1:9011/ ; echo

echo "=== done s3 ==="