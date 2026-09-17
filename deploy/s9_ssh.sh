#!/bin/bash
TOKEN=60ffd44f44fc262f7e42197a3003c30f
echo "=== gitee ssh reachability ==="
timeout 6 bash -c 'exec 3<>/dev/tcp/gitee.com/22' 2>/dev/null && echo ssh22-ok || echo ssh22-fail
echo "=== gen key ==="
mkdir -p ~/.ssh && chmod 700 ~/.ssh
[ -f ~/.ssh/id_ed25519 ] || ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 -q
echo "--- pubkey ---"
cat ~/.ssh/id_ed25519.pub
echo "=== add key to gitee via api ==="
curl -s -X POST "https://gitee.com/api/v5/user/keys?access_token=$TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "title=anyu-server" \
  --data-urlencode "key=$(cat ~/.ssh/id_ed25519.pub)" | head -c 400
echo