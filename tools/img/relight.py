#!/usr/bin/env python3
"""
Bring a photograph up to the level of the ones beside it on its page.

His note about page one: photo 1 is her in a room lit bright red, and 2 and
3 are the same evening from the far side of the room -- much darker and much
flatter. Measured, the gap is not subtle:

    photo-1   light 0.200   sat 0.579   contrast 0.101   p98 0.446
    photo-2   light 0.193   sat 0.620   contrast 0.086   p98 0.393
    photo-3   light 0.198   sat 0.629   contrast 0.096   p98 0.417

against the three across the gutter from them:

    photo-4   light 0.314   sat 0.814   contrast 0.215   p98 0.831
    photo-5   light 0.249   sat 0.769   contrast 0.177   p98 0.723
    photo-7   light 0.198   sat 0.371   contrast 0.196   p98 0.825

A first pass lifted the mean lightness and the saturation and left the rest
alone, and that was the wrong half of the problem: it made them brighter
without making them any less flat, which is exactly what "pale" means. The
tone never reached white -- the brightest two per cent of those frames stop
around 0.45 where the ones beside them run to 0.83 -- so nothing in the
picture read as light, and nothing read as black either.

So the curve is built in four moves, in this order:

  1. LEVELS.   The measured black and white points are stretched to the ends
               of the range. This is the move that was missing.
  2. GAMMA.    Solved, not guessed -- the exponent is searched until the
               mean lightness lands on the target, so each photo gets what
               IT needs rather than a fixed nudge.
  3. S-CURVE.  A gentle sigmoid about the midpoint for local contrast.
  4. COLOUR.   Saturation rescaled, because lifting a dark frame washes it.

The shadows are held back through all of it: pulling the blacks all the way
up in a frame this dark just amplifies its noise, so the result is blended
back towards the original in the darkest tones. The room stays dark, the
faces come up.

    python3 tools/img/relight.py 1 2 3 --light 0.29 --sat 0.80 \
        --white 0.86 --contrast 0.30

Reads the untouched originals where they are available, writes the .jpg and
the .webp the site actually loads.
"""
import sys, os
import numpy as np
from PIL import Image

BACKUPS = [
    "/tmp/photo-backup",
    "/tmp/claude-0/-home-user-anniversary-gift/f6a1d9e6-69e6-54e0-a49a-944a07d9886c/scratchpad/assets-backup",
]
SHADOW_HOLD = 0.28      # how much of the original to keep in the darkest tones


def stats(a):
    mx, mn = a.max(axis=2), a.min(axis=2)
    l = (mx + mn) / 2
    d = mx - mn
    s = np.where(d < 1e-6, 0,
                 np.where(l < 0.5, d / np.clip(mx + mn, 1e-6, None),
                                   d / np.clip(2 - mx - mn, 1e-6, None)))
    lum = a.mean(axis=2)
    return (float(l.mean()), float(s.mean()), float(lum.std()),
            float(np.percentile(lum, 98)))


def solve_gamma(a, target):
    """the exponent that puts the mean lightness on target"""
    lo, hi = 0.25, 1.6
    for _ in range(44):
        g = (lo + hi) / 2
        if stats(np.clip(a ** g, 0, 1))[0] < target:
            hi = g
        else:
            lo = g
    return (lo + hi) / 2


def levels(a, white_out):
    """stretch the measured black and white points to the ends of the range"""
    lum = a.mean(axis=2)
    lo = float(np.percentile(lum, 0.6))
    hi = float(np.percentile(lum, 99.0))
    if hi - lo < 1e-3:
        return a, lo, hi
    return np.clip((a - lo) / (hi - lo) * white_out, 0, 1), lo, hi


def scurve(a, amount):
    """x + k*x*(1-x)*(2x-1) -- steeper through the midtones, ends pinned"""
    if amount <= 0:
        return a
    return np.clip(a + amount * a * (1 - a) * (2 * a - 1), 0, 1)


def relight(path_in, path_base, light, sat, white, contrast):
    im = Image.open(path_in).convert("RGB")
    a = np.asarray(im, dtype=np.float64) / 255.0
    l0, s0, c0, p0 = stats(a)

    out, blk, wht = levels(a, white)
    g = solve_gamma(out, light)
    out = np.clip(out ** g, 0, 1)
    out = scurve(out, contrast)

    # hold the deepest tones back towards where they were, or the noise in
    # the dark half of the frame comes up with everything else
    lum = a.mean(axis=2, keepdims=True)
    keep = SHADOW_HOLD * np.clip(1 - lum / 0.16, 0, 1)
    out = out * (1 - keep) + a * keep

    # and put the colour back that the lift washed out
    s1 = stats(out)[1]
    # this scales down as well as up: the levels stretch can push the colour
    # past the target on its own, and an oversaturated frame is as wrong as
    # a washed one
    k = min(2.2, max(0.7, sat / max(1e-6, s1)))
    grey = out.mean(axis=2, keepdims=True)
    out = np.clip(grey + (out - grey) * k, 0, 1)

    l2, s2, c2, p2 = stats(out)
    print("  %-12s light %.3f->%.3f  sat %.3f->%.3f  contrast %.3f->%.3f  p98 %.3f->%.3f"
          % (os.path.basename(path_base), l0, l2, s0, s2, c0, c2, p0, p2))
    print("               (black %.3f  white %.3f  gamma %.3f  colour x%.2f)"
          % (blk, wht, g, k))
    return Image.fromarray((out * 255).astype(np.uint8))


def original(n):
    for d in BACKUPS:
        p = os.path.join(d, "photo-%s.jpg" % n)
        if os.path.exists(p):
            return p
    print("  (no original for %s, working from the shipped file)" % n)
    return "assets/photo-%s.jpg" % n


def main():
    light, sat, white, contrast, args, skip = 0.29, 0.80, 0.86, 0.30, [], False
    for i, x in enumerate(sys.argv[1:], 1):
        if skip: skip = False; continue
        if   x == "--light":    light = float(sys.argv[i + 1]); skip = True
        elif x == "--sat":      sat = float(sys.argv[i + 1]); skip = True
        elif x == "--white":    white = float(sys.argv[i + 1]); skip = True
        elif x == "--contrast": contrast = float(sys.argv[i + 1]); skip = True
        elif not x.startswith("--"): args.append(x)

    for n in args:
        base = "assets/photo-%s" % n
        im = relight(original(n), base, light, sat, white, contrast)

        # the site never shows these bigger than the lightbox, same rule as
        # tools/img/compress.py: short edge <= 1200, long edge <= 2000
        w, h = im.size
        sc = min(1.0, 1200 / min(w, h), 2000 / max(w, h))
        if sc < 1.0:
            im = im.resize((round(w * sc), round(h * sc)), Image.LANCZOS)

        im.save(base + ".jpg", "JPEG", quality=90, subsampling=2,
                optimize=True, progressive=True)
        im.save(base + ".webp", "WEBP", quality=88, method=6)
        print("     %s  %dx%d  jpg %dKB  webp %dKB" % (
            base, im.size[0], im.size[1],
            os.path.getsize(base + ".jpg") // 1024,
            os.path.getsize(base + ".webp") // 1024))


if __name__ == "__main__":
    main()
