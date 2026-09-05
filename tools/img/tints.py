#!/usr/bin/env python3
"""
Work out what colour each page of the book should be, from the photographs
that are on it.

His note was that the pages and the photos disagreed -- warm lamplit prints
mounted on cold pink and purple paper, so each picture looked cut out of
somebody else's album. This reads the photos and writes two tables that
scrapbook.js applies as a wash: PAGE_TINT (a hue and a saturation per page)
and PHOTO_TINT (the same per photo, which tints only the card that photo is
mounted on).

Two rules make a photograph's colour usable as paper.

ONLY TWO FAMILIES COUNT. This book is made of warm amber and plum-to-rose
and nothing else, so pixels outside those two bands get no vote. Averaging
everything is how page 3 -- one warm photo, one teal one -- first came out
at hue 66, a yellow-green that matched neither photo and would have looked
ill under them. A green lawn in the corner of a frame has no opinion about
what colour the paper should be.

SATURATION IS SCALED DOWN AND CAPPED. The page is tinted, not painted. The
crumpled paper texture underneath has to stay visible or it stops reading
as paper.

Pixels are weighted by how colourful they are and how mid-toned: a blown
highlight and a black night sky both have colour readings, and neither is
telling you anything.

    python3 tools/img/tints.py          # prints both tables

Paste the output over PAGE_TINT / PHOTO_TINT in scrapbook.js. Page N is the
Nth entry of PAGES.
"""
import re, sys
import numpy as np
from PIL import Image

WARM = (0, 52)        # amber, gold, terracotta
PLUM = (258, 360)     # violet through rose
SRC  = "assets/photo-%s.jpg"


def pixels(path):
    """hue, saturation and a per-pixel weight for one photo."""
    im = Image.open(path).convert("RGB")
    im.thumbnail((130, 130), Image.LANCZOS)
    a = np.asarray(im, dtype=np.float64) / 255.0
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    mx, mn = a.max(axis=2), a.min(axis=2)
    l, d = (mx + mn) / 2, mx - mn
    s = np.where(d < 1e-6, 0,
                 np.where(l < 0.5, d / np.clip(mx + mn, 1e-6, None),
                                   d / np.clip(2 - mx - mn, 1e-6, None)))
    hr = np.where(mx == r, ((g - b) / np.clip(d, 1e-6, None)) % 6,
         np.where(mx == g,  (b - r) / np.clip(d, 1e-6, None) + 2,
                            (r - g) / np.clip(d, 1e-6, None) + 4))
    h = np.where(d > 1e-6, hr * 60, 0)
    w = (s ** 1.4) * np.clip(1 - np.abs(l - 0.48) * 1.7, 0, 1)
    return h.ravel(), s.ravel(), w.ravel()


def tint(hsw, sat_scale, sat_cap):
    h, s, w = hsw
    mw = (h >= WARM[0]) & (h <= WARM[1])
    mp = (h >= PLUM[0]) & (h <= PLUM[1])
    sel = mw if w[mw].sum() >= w[mp].sum() else mp
    if w[sel].sum() < 1e-6:
        return 26, 14                       # the book's own warmth
    ang, ww = np.deg2rad(h[sel]), w[sel]
    hue = np.rad2deg(np.arctan2((np.sin(ang) * ww).sum(),
                                (np.cos(ang) * ww).sum())) % 360
    sat = float((s[sel] * ww).sum() / ww.sum())
    return round(hue), round(max(0.06, min(sat_cap, sat * sat_scale)) * 100)


def pages_from_source():
    """Which photo sits on which page, read straight out of scrapbook.js so
       the two can never drift apart."""
    src = open("scrapbook.js", encoding="utf-8").read()
    block = src[src.index("  var PAGES = ["):src.index("  /* =====", src.index("  var PAGES = ["))]
    parts = re.split(r"/\* ---- (\d+) · ([^-]*?)-+ \*/", block)
    out = []
    for i in range(1, len(parts), 3):
        body = parts[i + 2]
        ns = [int(m) for m in re.findall(r"\bn:\s*(\d+)\b", body)]
        for cl in re.findall(r"cells:\s*\[([^\]]*)\]", body):
            ns += [int(x) for x in re.findall(r"\d+", cl)]
        out.append((int(parts[i]), parts[i + 1].strip(), sorted(set(ns))))
    return out


def main():
    cache = {}
    def px(n):
        if n not in cache:
            cache[n] = pixels(SRC % n)
        return cache[n]

    print("  var PAGE_TINT = {")
    row = []
    for num, name, photos in pages_from_source():
        got = []
        for n in photos:
            try: got.append(px(n))
            except Exception: pass
        if not got:
            continue
        merged = tuple(np.concatenate([g[i] for g in got]) for i in range(3))
        h, s = tint(merged, 0.72, 0.40)
        row.append("%d: [%d, %d]" % (num, h, s))
    for i in range(0, len(row), 5):
        print("    " + ", ".join(row[i:i + 5]) + ",")
    print("  };")

    print("\n  var PHOTO_TINT = {")
    row = []
    n = 1
    while True:
        try: hsw = px(n)
        except Exception:
            if n > 40: break
            n += 1; continue
        h, s = tint(hsw, 0.60, 0.34)
        row.append("%d:[%d,%d]" % (n, h, s))
        n += 1
        if n > 40: break
    for i in range(0, len(row), 6):
        print("    " + ", ".join(row[i:i + 6]) + ",")
    print("  };")


if __name__ == "__main__":
    main()
