#!/bin/sh
# Full Phase 0 verification. Exits non-zero on any failure.
set -e
cd "$(dirname "$0")"
echo "── node --check ──────────────────────────────────────"
python3 -c "
import re;s=open('index.html').read()
open('/tmp/aegis.js','w').write(re.search(r'<script>(.*)</script>',s,re.S).group(1))"
node --check /tmp/aegis.js && echo "  index.html inline script OK"
node --check sw.js && echo "  sw.js OK"
./extract.sh >/dev/null
node verify-version.mjs
node verify-fsrs-oracle.mjs
node verify-app.mjs
