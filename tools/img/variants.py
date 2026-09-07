#!/usr/bin/env python3
"""
A second, page-sized copy of every photograph.

Measured (tools/_pxsize.js), the largest a print is ever drawn in this book
is 537 device pixels on the long edge -- an iPhone at DPR 3, the biggest
photograph on the biggest spread. The lightbox goes to 842. The files being
shipped for that are up to 2000px long and 723KB each, 8.2MB across the
book, and every byte above what is drawn is time she spends looking at a
frame with nothing in it.

So each photograph is written twice:

    assets/photo-N.webp        the full file, for the lightbox only
    assets/photo-N.page.webp   long edge 760, for the prints on the pages

760 rather than 537 leaves room for a bigger phone and for the two prints
that run nearly full width on a spread; it is still a quarter of the pixels
and about a sixth of the bytes. Nothing is upscaled -- a photograph already
smaller than that is copied at its own size rather than blown up, because a
resampled small file is worse than the original and no faster.

Both encodings are written, .webp and .jpg, for the same reason the full
files are: the JPEG is the fallback for a browser that cannot take WebP.

    python3 tools/img/variants.py            # all of them
    python3 tools/img/variants.py 4 17 25    # just these
"""
import sys, os, glob, re
from PIL import Image

LONG_EDGE = 760
WEBP_Q = 86          # at a quarter of the pixels this is visually lossless
JPEG_Q = 88


def sources(args):
    if args:
        return ["assets/photo-%s.jpg" % a for a in args]
    out = []
    for f in sorted(glob.glob("assets/photo-*.jpg")):
        if ".page." in f:
            continue
        out.append(f)
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    before = after = 0
    made = 0
    for src in sources(args):
        if not os.path.exists(src):
            print("  missing", src)
            continue
        n = re.search(r"photo-([^.]+)\.jpg$", src).group(1)
        full_webp = "assets/photo-%s.webp" % n
        before += os.path.getsize(full_webp if os.path.exists(full_webp) else src)

        im = Image.open(src).convert("RGB")
        w, h = im.size
        sc = min(1.0, LONG_EDGE / max(w, h))
        if sc < 1.0:
            im = im.resize((max(1, round(w * sc)), max(1, round(h * sc))), Image.LANCZOS)

        pw = "assets/photo-%s.page.webp" % n
        pj = "assets/photo-%s.page.jpg" % n
        im.save(pw, "WEBP", quality=WEBP_Q, method=6)
        im.save(pj, "JPEG", quality=JPEG_Q, subsampling=2, optimize=True, progressive=True)
        after += os.path.getsize(pw)
        made += 1
        print("  photo-%-4s %5dx%-5d -> %4dx%-4d  webp %4dKB -> %3dKB"
              % (n, w, h, im.size[0], im.size[1],
                 os.path.getsize(full_webp) // 1024 if os.path.exists(full_webp) else 0,
                 os.path.getsize(pw) // 1024))
    print("\n  %d photographs.  the book now loads %dKB of prints instead of %dKB"
          % (made, after // 1024, before // 1024))


if __name__ == "__main__":
    main()
