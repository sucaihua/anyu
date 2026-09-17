#!/bin/bash
set -x
cd /www/wwwroot/anyu || { echo "DIR_MISSING"; exit 1; }
echo "=== node & arch ==="
node -v
uname -m
echo "=== ensure build tools ==="
yum install -y gcc-c++ make python3 2>/dev/null || true
echo "=== remove bad (Windows) bcrypt ==="
rm -rf node_modules/bcrypt
echo "=== reinstall bcrypt (Linux binary) ==="
npm install --no-audit --no-fund --no-update-notifier bcrypt 2>&1 | tail -30
echo "=== verify ==="
node -e "const b=require('bcrypt'); (async()=>{const h=await b.hash('test',4); console.log('bcrypt-ok compare=', await b.compare('test',h));})().catch(e=>{console.error('VERIFY_FAIL', e.message); process.exit(1);});"
echo "=== done ==="