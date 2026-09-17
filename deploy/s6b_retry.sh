#!/bin/bash
cd /www/wwwroot/anyu
git config http.postBuffer 524288000
git config http.version HTTP/1.1
echo "--- local head ---"
git log --oneline -1 2>&1 || echo no-commit
echo "--- remote before ---"
git ls-remote origin 2>&1 | head -5
echo "--- push ---"
git push -u origin master 2>&1 | tail -20
echo "push_pipeline=${PIPESTATUS[0]}"
echo "--- remote after ---"
git ls-remote origin 2>&1 | head -5