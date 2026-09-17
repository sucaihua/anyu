#!/bin/bash
cd /www/wwwroot/anyu
git config http.postBuffer 1048576000
for i in 1 2 3; do
  echo "== attempt $i =="
  git push -u origin master 2>&1 | tail -6
  if git ls-remote origin 2>/dev/null | grep -q master; then echo PUSHED_OK; break; fi
  sleep 3
done
echo "--- heads ---"
git ls-remote origin 2>&1 | head