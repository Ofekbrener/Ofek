"""Build a publishable copy for a claude.ai artifact: the host wraps the page in its own
<!doctype><html><head><body>, so the page file keeps only the head content and body content."""
import re, shutil, sys, os, json
src = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1]
shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
html = open(os.path.join(src, 'index.html')).read()
head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', html, re.S).group(1)
head = re.sub(r'<meta charset[^>]*>\s*|<meta name="viewport"[^>]*>\s*', '', head)
open(os.path.join(out, 'index.html'), 'w').write(head.strip() + '\n' + body.strip() + '\n')
files = {}
audio = set(re.findall(r"'([A-Za-z_0-9]+)'", open(os.path.join(src, 'js/audio.js')).read()))
for d, _, fs in os.walk(src):
    rel = os.path.relpath(d, src)
    if rel.startswith(('tools', '.')): continue
    for f in fs:
        r = os.path.normpath(os.path.join(rel, f))
        if r in ('index.html', '.gitignore', 'CREDITS.md'): continue
        if r.startswith('assets/audio/') and f[:-4] not in audio and not any(f.startswith(a) for a in audio): continue
        os.makedirs(os.path.join(out, os.path.dirname(r)), exist_ok=True); shutil.copy(os.path.join(src, r), os.path.join(out, r)); files[r] = r
json.dump(sorted(files), open(os.path.join(out, 'files.json'), 'w'))
print(len(files), 'files')
