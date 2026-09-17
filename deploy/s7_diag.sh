#!/bin/bash
cd /www/wwwroot/anyu
echo "=== pack size ==="
git count-objects -vH | grep -E "size-pack|count|size"
echo "=== biggest tracked files ==="
git ls-files -z | while IFS= read -r -d '' f; do
  s=$(stat -c %s "$f" 2>/dev/null || echo 0)
  printf "%s\t%s\n" "$s" "$f"
done | sort -rn | head -12