#!/usr/bin/env python3
"""Lay the rendered shots out as contact sheets, six to a page, labelled
with the shot number -- so the whole film can be looked at in a dozen
pictures instead of eighty-nine.

    python3 tools/contact.py <indir> <outdir> [cols] [rows]
"""
import sys, os, glob, re
from PIL import Image, ImageDraw

src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/allshots'
out = sys.argv[2] if len(sys.argv) > 2 else '/tmp/sheets'
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3
rows = int(sys.argv[4]) if len(sys.argv) > 4 else 4
os.makedirs(out, exist_ok=True)

files = sorted(glob.glob(os.path.join(src, 'shot-*.png')),
               key=lambda f: int(re.search(r'(\d+)', os.path.basename(f)).group(1)))
if not files:
    print('no frames in ' + src); sys.exit(1)

TW, TH = 420, 262           # thumbnail size
PAD, LAB = 8, 16
per = cols * rows
sheets = 0
for p0 in range(0, len(files), per):
    chunk = files[p0:p0 + per]
    W = cols * TW + (cols + 1) * PAD
    H = rows * (TH + LAB) + (rows + 1) * PAD
    sheet = Image.new('RGB', (W, H), (18, 17, 16))
    d = ImageDraw.Draw(sheet)
    for k, f in enumerate(chunk):
        n = int(re.search(r'(\d+)', os.path.basename(f)).group(1))
        im = Image.open(f).convert('RGB').resize((TW, TH), Image.LANCZOS)
        cx = PAD + (k % cols) * (TW + PAD)
        cy = PAD + (k // cols) * (TH + LAB + PAD)
        sheet.paste(im, (cx, cy))
        d.text((cx + 4, cy + TH + 2), 'shot %d' % n, fill=(210, 190, 150))
    name = os.path.join(out, 'sheet-%02d.png' % sheets)
    sheet.save(name)
    print('  ' + name + '   shots ' +
          re.search(r'(\d+)', os.path.basename(chunk[0])).group(1) + '-' +
          re.search(r'(\d+)', os.path.basename(chunk[-1])).group(1))
    sheets += 1
print('\n  %d frames -> %d sheets' % (len(files), sheets))
