#!/bin/bash
TOKEN='60ffd44f44fc262f7e42197a3003c30f'
echo "=== configure git credentials ==="
git config --global credential.helper store
printf 'http://sucaihua:%s@gitee.com\n' "$TOKEN" > /root/.git-credentials
chmod 600 /root/.git-credentials
echo "credentials set"
echo "=== remote diagnostic ==="
cd /www/wwwroot/anyu || exit 1
echo "remote:"; git remote -v
echo "--- ls-remote ---"
git ls-remote origin 2>&1 | head -20
echo "--- repo api ---"
curl -s "https://gitee.com/api/v5/repos/sucaihua/anyu_shop?access_token=$TOKEN" -o /tmp/repo.json
python3 -c "import json;d=json.load(open('/tmp/repo.json'));print('default_branch=',d.get('default_branch'));print('size=',d.get('size'));print('msg=',d.get('message'))" 2>/dev/null || head -c 300 /tmp/repo.json
echo
echo "--- local branch ---"
cd /www/wwwroot/anyu && git symbolic-ref --short HEAD 2>/dev/null || echo none