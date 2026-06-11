#!/usr/bin/env python3
"""Fix Instagram icon size in footer - make it slightly larger for visibility."""

import os

SITE_DIR = '/home/karam/legend-stories-website'

# Replace w-4 h-4 with w-5 h-5 for Instagram SVG in footer social icons
OLD = 'class="w-4 h-4 text-text-secondary" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163'
NEW = 'class="w-5 h-5 text-text-secondary" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163'

count = 0
for fname in sorted(os.listdir(SITE_DIR)):
    if not fname.endswith('.html') or 'backups' in fname:
        continue
    fpath = os.path.join(SITE_DIR, fname)
    with open(fpath, 'r') as f:
        content = f.read()
    if OLD in content:
        new_content = content.replace(OLD, NEW)
        with open(fpath, 'w') as f:
            f.write(new_content)
        n = content.count(OLD)
        print(f'{fname}: {n} icon(s) resized')
        count += 1

print(f'\nTotal: {count} files updated')
