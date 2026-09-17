#!/bin/bash
TOKEN=60ffd44f44fc262f7e42197a3003c30f
echo "=== existing hooks ==="
curl -s "https://gitee.com/api/v5/repos/sucaihua/anyu_shop/hooks?access_token=$TOKEN" | head -c 600
echo
echo "=== create webhook ==="
curl -s -X POST "https://gitee.com/api/v5/repos/sucaihua/anyu_shop/hooks" \
  -H "Content-Type: application/json" \
  -d "{\"access_token\":\"$TOKEN\",\"url\":\"http://ziyuanclub.site/pull\",\"password\":\"2813319028\",\"push_events\":true,\"merge_events\":false,\"note\":\"anyu auto deploy\",\"active\":true}" \
  | head -c 600
echo