#!/usr/bin/env bash
# Збирає вебверсію і складає одну сторінку preview/svitlo.html для тесту за посиланням.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist
npx expo export --platform web --output-dir dist >/dev/null
mkdir -p preview
python3 - <<'EOF'
import glob, re
js = open(glob.glob('dist/_expo/static/js/web/index-*.js')[0], encoding='utf-8').read()
js = js.replace('</script', '<\\/script')
head = '''<title>Світло Дніпро</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700;900&display=swap">
<style>
/* Тестова вебверсія застосунку: одна колонка шириною телефона, нижня панель вкладок. */
:root { --bg: #FFFFFF; --fg: #000000; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #000000; --fg: #FFFFFF; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #000000; --fg: #FFFFFF; color-scheme: dark; }
html { height: 100%; box-sizing: border-box; }
body { height: 100%; overflow: hidden; background: var(--bg); color: var(--fg); }
#root { display: flex; height: 100%; flex: 1; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
</style>
'''
html = head + '<div id="root"></div>\n<script>\n' + js + '\n</script>\n'
open('preview/svitlo.html', 'w', encoding='utf-8').write(html)
print('preview/svitlo.html', len(html) // 1024, 'KB')
EOF
