#!/bin/bash
echo "=== reload nginx ==="
nginx -s reload
echo "reload-rc=$?"
sleep 1
echo "=== auth-ok (correct token) ==="
curl -s -H "Host: ziyuanclub.site" -X POST -H "X-Gitee-Token: 2813319028" http://127.0.0.1/pull
echo
echo "=== wrong-token (expect 403) ==="
curl -s -o /dev/null -w "code=%{http_code}\n" -H "Host: ziyuanclub.site" -X POST -H "X-Gitee-Token: WRONG" http://127.0.0.1/pull
echo "=== external-domain ==="
curl -s -H "X-Gitee-Token: 2813319028" -X POST -w "\nexternal_code=%{http_code}\n" http://ziyuanclub.site/pull
echo "=== done ==="