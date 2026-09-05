#!/usr/bin/env python3
"""
Cut the still that shows on the video card in the book, out of the video.

The card used to show a film slate over a black rectangle, and a video
element's own first frame is no use here either -- our-video.mp4 opens on a
dark blur of somebody's sleeve. This takes a named second, crops it to the
16:9 the card wants, and warms it so it sits on a page of cream paper
instead of punching a hole in it.

24.33s is the frame in use: both faces sharp, both of them laughing. It was
chosen by scoring the variance of a laplacian over the band where the faces
are, across every frame between 6s and 33s, and then looking at the best
dozen.

    python3 tools/img/poster.py [seconds]

Writes assets/our-video.jpg and assets/our-video.webp.
"""
import sys, os
import av
import numpy as np
from PIL import Image

AT     = float(sys.argv[1]) if len(sys.argv) > 1 else 24.33
CROP   = (100, 45, 1180, 652)      # 16:9 out of the 1280x720 frame
OUT    = (1080, 607)

# a lift, a little warmth, and the contrast put back so the night stays night
LIFT, WARM, CONTRAST, SAT = 1.55, 0.055, 1.08, 1.12


def grade(im):
    a = np.asarray(im.convert("RGB"), dtype=np.float64) / 255.0
    a = a ** (1.0 / LIFT)
    a = np.clip((a - 0.5) * CONTRAST + 0.5, 0, 1)
    mid = 1 - np.abs(a - 0.5) * 2
    a[:, :, 0] = np.clip(a[:, :, 0] + WARM * mid[:, :, 0], 0, 1)
    a[:, :, 2] = np.clip(a[:, :, 2] - WARM * 0.55 * mid[:, :, 2], 0, 1)
    g = a.mean(axis=2, keepdims=True)
    a = np.clip(g + (a - g) * SAT, 0, 1)
    return Image.fromarray((a * 255).astype(np.uint8))


def main():
    c = av.open("assets/our-video.mp4")
    v = c.streams.video[0]
    v.thread_type = "AUTO"
    frame = None
    for f in c.decode(video=0):
        if float(f.pts * v.time_base) >= AT:
            frame = f.to_image()
            break
    c.close()
    if frame is None:
        sys.exit("no frame at %.2fs" % AT)
    im = grade(frame.crop(CROP)).resize(OUT, Image.LANCZOS)
    im.save("assets/our-video.jpg", "JPEG", quality=90, subsampling=2,
            optimize=True, progressive=True)
    im.save("assets/our-video.webp", "WEBP", quality=88, method=6)
    for p in ("assets/our-video.jpg", "assets/our-video.webp"):
        print("%s  %d KB" % (p, os.path.getsize(p) // 1024))


if __name__ == "__main__":
    main()
