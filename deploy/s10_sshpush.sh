#!/bin/bash
set -e
cd /www/wwwroot/anyu
echo "=== switch remote to ssh ==="
git remote set-url origin git@gitee.com:sucaihua/anyu_shop.git
echo "=== test gitee ssh auth ==="
ssh -o StrictHostKeyChecking=accept-new -T git@gitee.com 2>&1 | head -3 || true
git config core.sshCommand "ssh -o StrictHostKeyChecking=accept-new"
echo "=== push ==="
git push -u origin master 2>&1 | tail -15
echo "=== heads ==="
git ls-remote origin 2>&1 | head -5