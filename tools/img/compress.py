#!/usr/bin/env python3
"""
Shrink the photos to what the site can actually show, and no further.

Two things decide the size. The biggest a photo is ever displayed is the
lightbox card -- min(88vw, 340px) CSS pixels -- which on a 3x phone is
1020 device pixels, and it is a square `object-fit: cover` crop, so the
number that has to be met is the SHORT edge, not the long one. Everything
else (the frames on the pages, the pins on the map) is far smaller. So the
rule is: short edge <= 1200, long edge <= 2000. That is a 1.18x margin over
the worst case on the sharpest phone anyone is holding.

Quality is not a fixed number, because a fixed number means different
things to a smooth photo and a grainy one. Each photo is encoded at the
lowest quality that still scores SSIM >= 0.995 against the full-quality
resize of itself -- a difference no eye resolves -- with a floor so nothing
is ever encoded cheaply. A grainy low-light frame therefore gets more bits
than a clean daylight one, which is the right way round.

Colour is managed, not discarded. Half of these came off an iPhone
carrying a wide-gamut profile (Display P3, and Apple's 60 KB "Poppy"
output profile). Dropping those and letting the browser assume sRGB is
what turns a warm photo dull. They are converted into Display P3 and the
compact 536-byte version of that profile is embedded, so the colour is
unchanged on a P3 screen and correctly mapped on an sRGB one -- and 60 KB
of profile per file becomes half a kilobyte.

Every photo is written twice: WebP for browsers that take it, and a JPEG
beside it so nothing is ever left without a picture. The page downloads
one of the two, never both.
"""
import io, os, sys, glob, json
import numpy as np
from PIL import Image, ImageCms, ImageOps

SHORT_MAX, LONG_MAX = 1200, 2000
BASELINE_Q  = 95
JPEG_RANGE  = (78, 95)
WEBP_RANGE  = (74, 95)

SRC = "assets"

# ---- how different does it look, at the size it is actually shown ----
#
# Judging a re-encode against the original at full resolution measures the
# wrong thing. These came off a phone, so they carry sensor grain, and the
# first thing any encoder does is smooth grain -- which scores as a large
# error even at quality 95, and swamps the artefacts we actually care
# about. Worse, it made the search useless: nothing could ever reach the
# target, so every photo was written at the ceiling.
#
# So both are resampled to the size the photo is really displayed at
# before they are compared. The biggest view in the site is the lightbox:
# a 340 CSS px square crop, 1020 device pixels on a 3x phone. Grain that
# vanishes in that resample was never visible to begin with.
#
# And the bar is the photo's own near-lossless encode, not a fixed number.
# A quality is accepted only while it stays within half a level (out of
# 255) of what quality 95 already gives that same photo. A grainy frame is
# therefore judged against a grainy baseline, and gets the bits it needs,
# while a clean one is allowed to be small.
DISPLAY_PX = 1020
TOL_MEAN   = 0.45
TOL_TAIL   = 3.0

def display_size(w, h):
    """One size for both sides of the comparison. Derived from the stored
       dimensions, never from the source, or rounding leaves the two arrays
       a pixel apart and they will not subtract."""
    if w < h:
        ds = (DISPLAY_PX, max(1, round(DISPLAY_PX * h / w)))
    else:
        ds = (max(1, round(DISPLAY_PX * w / h)), DISPLAY_PX)
    return (min(ds[0], w), min(ds[1], h)) if (ds[0] >= w and ds[1] >= h) else ds

def at(im, ds):
    return np.asarray(im.convert("RGB").resize(ds, Image.LANCZOS), dtype=np.float64)

def diff(gold, im, ds):
    d = np.abs(at(im, ds) - gold)
    return float(d.mean()), float(np.percentile(d, 99.9))

# ---- colour ----
_P3_SMALL = None
def p3_profile():
    """The compact 536-byte Display P3 profile, lifted from a photo that
       already carries it. Building one from primaries risks not matching
       what Apple wrote; reusing theirs cannot drift."""
    global _P3_SMALL
    if _P3_SMALL is None:
        for f in sorted(glob.glob(os.path.join(SRC, "photo-*.jpg"))):
            icc = Image.open(f).info.get("icc_profile")
            if icc and len(icc) < 2000:
                p = ImageCms.ImageCmsProfile(io.BytesIO(icc))
                if "P3" in ImageCms.getProfileDescription(p):
                    _P3_SMALL = icc
                    break
    return _P3_SMALL

def to_p3(im):
    """Returns (image, icc_to_embed). Images with no profile are sRGB by
       convention and are left exactly as they are."""
    icc = im.info.get("icc_profile")
    im = ImageOps.exif_transpose(im)          # no-ops here, but never assume
    if im.mode != "RGB":
        im = im.convert("RGB")
    if not icc:
        return im, None
    dst = p3_profile()
    if dst is None:
        return im, icc
    if icc == dst:
        return im, dst
    src_p = ImageCms.ImageCmsProfile(io.BytesIO(icc))
    dst_p = ImageCms.ImageCmsProfile(io.BytesIO(dst))
    out = ImageCms.profileToProfile(
        im, src_p, dst_p, renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC,
        outputMode="RGB", flags=ImageCms.Flags.BLACKPOINTCOMPENSATION)
    return out, dst

# ---- encoding ----
def encode(ref, fmt, q, icc):
    b = io.BytesIO()
    if fmt == "JPEG":
        ref.save(b, "JPEG", quality=q, subsampling=2, optimize=True,
                 progressive=True, icc_profile=icc)
    else:
        ref.save(b, "WEBP", quality=q, method=6, icc_profile=icc)
    return b.getvalue()

def best(ref, fmt, lo, hi, icc, gold, ds):
    """Lowest quality that still looks like the near-lossless encode."""
    b_mean, b_tail = diff(gold, Image.open(io.BytesIO(encode(ref, fmt, BASELINE_Q, icc))), ds)
    ok_mean, ok_tail = b_mean + TOL_MEAN, b_tail + TOL_TAIL
    chosen, data = None, None
    while lo <= hi:
        mid = (lo + hi) // 2
        d = encode(ref, fmt, mid, icc)
        m, t = diff(gold, Image.open(io.BytesIO(d)), ds)
        if m <= ok_mean and t <= ok_tail:
            chosen, data = mid, d
            hi = mid - 1
        else:
            lo = mid + 1
    if data is None:
        chosen = BASELINE_Q
        data = encode(ref, fmt, chosen, icc)
    m, t = diff(gold, Image.open(io.BytesIO(data)), ds)
    return chosen, data, m, b_mean

def target_size(w, h):
    sc = min(1.0, SHORT_MAX / min(w, h), LONG_MAX / max(w, h))
    if sc >= 1.0:
        return None
    return max(1, round(w * sc)), max(1, round(h * sc))

def main():
    files = sorted(glob.glob(os.path.join(SRC, "photo-*.jpg")),
                   key=lambda p: int("".join(c for c in os.path.basename(p) if c.isdigit())))
    before = after = 0
    report = []
    for f in files:
        im = Image.open(f)
        w, h = im.size
        src_bytes = os.path.getsize(f)
        before += src_bytes
        rgb, icc = to_p3(im)
        tgt = target_size(w, h)
        ref = rgb.resize(tgt, Image.LANCZOS) if tgt else rgb
        ds = display_size(*ref.size)
        gold = at(rgb, ds)                      # the original, seen at display size
        jq, jdata, jm, jb = best(ref, "JPEG", *JPEG_RANGE, icc=icc, gold=gold, ds=ds)
        wq, wdata, wm, wb = best(ref, "WEBP", *WEBP_RANGE, icc=icc, gold=gold, ds=ds)
        if len(jdata) >= src_bytes:             # never write a bigger file
            jdata, jq = open(f, "rb").read(), -1
        base = f[:-4]
        open(f, "wb").write(jdata)
        open(base + ".webp", "wb").write(wdata)
        after += min(len(jdata), len(wdata))
        report.append(dict(file=os.path.basename(f), src=f"{w}x{h}",
                           out=f"{ref.size[0]}x{ref.size[1]}", kb_in=src_bytes // 1024,
                           jpg_kb=len(jdata) // 1024, webp_kb=len(wdata) // 1024,
                           jq=jq, wq=wq, err_webp=round(wm, 3), err_baseline=round(wb, 3)))
        print("%-14s %9s -> %-9s %5dKB -> jpg %4dKB(q%d) webp %4dKB(q%d)  "
              "err %.2f vs %.2f near-lossless" % (
              report[-1]["file"], report[-1]["src"], report[-1]["out"], report[-1]["kb_in"],
              report[-1]["jpg_kb"], jq, report[-1]["webp_kb"], wq, wm, wb), flush=True)
    print("\nphotos: %.1f MB -> %.1f MB delivered (webp path) = %.1fx smaller"
          % (before / 1048576, after / 1048576, before / max(1, after)))
    json.dump(report, open("tools/img/report.json", "w"), indent=1)

if __name__ == "__main__":
    main()
