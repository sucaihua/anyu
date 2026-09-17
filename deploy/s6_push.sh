#!/bin/bash
set -e
cd /www/wwwroot/anyu
TOKEN=60ffd44f44fc262f7e42197a3003c30f
git branch -m main master 2>/dev/null || true
git remote set-url origin "https://sucaihua:${TOKEN}@gitee.com/sucaihua/anyu_shop.git"
echo "=== add files ==="
git add -A
echo "=== commit ==="
if ! git diff --cached --quiet; then
  git commit -m "initial deployment" 2>&1 | tail -5
else
  echo "no changes to commit"
fi
echo "=== push ==="
git push -u origin master 2>&1 | tail -15
echo "=== remote heads ==="
git ls-remote origin 2>&1 | head