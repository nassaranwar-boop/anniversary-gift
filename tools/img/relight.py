#!/usr/bin/env python3
"""
Bring a photograph up to the level of the ones beside it on its page.

His note about page one: photo 1 is her in a room lit bright red, and 2 and
3 are the same evening from the far side of the room -- much darker and much
flatter. Measured, the gap is not subtle:

    photo-1   mean lightness 0.343   mean saturation 0.830
    photo-2   mean lightness 0.133   mean saturation 0.641
    photo-3   mean lightness 0.194   mean saturation 0.630

Two and a half stops between the first and the second, on one page. That is
what makes the page feel like it was assembled out of two different nights.

The lift is a gamma on the luminance, solved rather than guessed -- the
exponent is searched until the mean lands on the target -- so each photo
gets the amount IT needs instead of a fixed nudge that overcooks one and
leaves the other. Saturation is scaled to match after, because lifting a
dark frame washes it out.

The shadows are held back deliberately. Pulling the blacks all the way up
in a photo this dark just amplifies its noise, so the curve is blended
towards the original at the bottom end: the room stays dark, the faces come
up.

    python3 tools/img/relight.py 2 3 --light 0.30 --sat 0.78

Reads the untouched originals where they are available, writes the .jpg and
the .webp the site actually loads.
"""
import sys, os, io
import numpy as np
from PIL import Image

BACKUP = "/tmp/claude-0/-home-user-anniversary-gift/f6a1d9e6-69e6-54e0-a49a-944a07d9886c/scratchpad/assets-backup"
SHADOW_HOLD = 0.30      # how much of the original to keep in the darkest tones


def stats(a):
    mx, mn = a.max(axis=2), a.min(axis=2)
    l = (mx + mn) / 2
    d = mx - mn
    s = np.where(d < 1e-6, 0,
                 np.where(l < 0.5, d / np.clip(mx + mn, 1e-6, None),
                                   d / np.clip(2 - mx - mn, 1e-6, None)))
    return float(l.mean()), float(s.mean())


def solve_gamma(a, target):
    """the exponent that puts the mean lightness on target"""
    lo, hi = 0.25, 1.0
    for _ in range(40):
        g = (lo + hi) / 2
        if stats(np.clip(a ** g, 0, 1))[0] < target:
            hi = g
        else:
            lo = g
    return (lo + hi) / 2


def relight(path_in, path_base, light, sat):
    im = Image.open(path_in).convert("RGB")
    a = np.asarray(im, dtype=np.float64) / 255.0
    l0, s0 = stats(a)

    g = solve_gamma(a, light)
    lifted = np.clip(a ** g, 0, 1)

    # hold the deepest tones back towards where they were, or the noise in
    # the dark half of the frame comes up with everything else
    lum = a.mean(axis=2, keepdims=True)
    keep = SHADOW_HOLD * np.clip(1 - lum / 0.18, 0, 1)
    out = lifted * (1 - keep) + a * keep

    # and put the colour back that the lift washed out
    l1, s1 = stats(out)
    k = min(2.2, max(1.0, sat / max(1e-6, s1)))
    grey = out.mean(axis=2, keepdims=True)
    out = np.clip(grey + (out - grey) * k, 0, 1)

    l2, s2 = stats(out)
    print("  %-14s light %.3f -> %.3f   sat %.3f -> %.3f   (gamma %.3f, colour x%.2f)"
          % (os.path.basename(path_base), l0, l2, s0, s2, g, k))
    return Image.fromarray((out * 255).astype(np.uint8))


def main():
    light, sat, args, skip = 0.30, 0.78, [], False
    for i, x in enumerate(sys.argv[1:], 1):
        if skip: skip = False; continue
        if x == "--light": light = float(sys.argv[i + 1]); skip = True
        elif x == "--sat": sat = float(sys.argv[i + 1]); skip = True
        elif not x.startswith("--"): args.append(x)

    for n in args:
        base = "assets/photo-%s" % n
        src = os.path.join(BACKUP, "photo-%s.jpg" % n)
        if not os.path.exists(src):
            src = base + ".jpg"
            print("  (no original for %s, working from the shipped file)" % n)
        im = relight(src, base, light, sat)

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
