#!/usr/bin/env python3
"""
The four cards on the chapter menu.

They were CSS gradients: a green band with a white dot for the adventure, a
pink block for the platformer, a grey smear for the apocalypse. At the size
they are drawn that is not a picture of anything -- it is a swatch, and four
swatches in a row tell her nothing about what she is choosing between.

These are small pixel scenes instead, one per chapter, painted on a 96x32
grid and emitted as run-length SVG so they stay crisp at any card size and
cost nothing to load. Pixels because three of the four chapters are pixel
games; the card should look like the thing behind it.

    python3 tools/img/hubart.py > /tmp/hubart.txt
"""
W, H = 96, 32


def grid(bg):
    return [[bg for _ in range(W)] for _ in range(H)]


def rect(g, x0, y0, x1, y1, c):
    for y in range(max(0, y0), min(H, y1)):
        for x in range(max(0, x0), min(W, x1)):
            g[y][x] = c


def band(g, y0, y1, c):
    rect(g, 0, y0, W, y1, c)


def disc(g, cx, cy, r, c):
    for y in range(max(0, cy - r), min(H, cy + r + 1)):
        for x in range(max(0, cx - r), min(W, cx + r + 1)):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                g[y][x] = c


def px(g, x, y, c):
    if 0 <= x < W and 0 <= y < H:
        g[y][x] = c


def blob(g, cx, cy, rx, ry, c):
    for y in range(max(0, cy - ry), min(H, cy + ry + 1)):
        for x in range(max(0, cx - rx), min(W, cx + rx + 1)):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                g[y][x] = c


# ---------------------------------------------------------------- 1. quest
def quest():
    """A fork in the road at dusk, and the two of them standing at it.

    The first version was a green field with a path running away to the
    corner and two four-pixel blocks on it; at card size that reads as a
    swatch with a smudge. This chapter is a story that branches, so the
    picture is the branch: the road comes toward you, splits, and they are
    standing at the split with nothing decided yet."""
    g = grid("#cbd8ea")
    band(g, 0, 4,  "#5f5384")     # the last of the night at the top
    band(g, 4, 7,  "#8a6f96")
    band(g, 7, 10, "#c08e9a")
    band(g, 10, 13, "#eeb392")    # the warm band at the horizon
    band(g, 13, 15, "#f8dcb0")
    for sx, sy in ((8, 2), (19, 4), (30, 1), (41, 3), (57, 2), (70, 4), (86, 1), (92, 5)):
        px(g, sx, sy, "#fbf0ff")
    disc(g, 76, 12, 4, "#fff6d8")                       # the sun going down

    blob(g, 16, 16, 30, 5, "#6a7f74")                   # the far ridge
    blob(g, 62, 15, 28, 5, "#7a8e78")
    for tx, th in ((4, 5), (9, 7), (13, 4), (86, 6), (91, 4)):   # a treeline
        rect(g, tx, 17 - th, tx + 3, 18, "#3f5748")
    band(g, 17, 32, "#5f8a55")                          # the meadow
    band(g, 22, 32, "#4e7746")
    band(g, 28, 32, "#436a3d")

    # the road: one trunk coming toward you, forking away to two horizons
    for y in range(31, 22, -1):                         # the trunk
        half = 4 + (y - 23)
        rect(g, 48 - half, y, 48 + half + 1, y + 1, "#cdb98d")
        rect(g, 48 - half + 1, y, 48 + half, y + 1, "#e2d3ab")
    for k in range(0, 7):                               # the left branch
        y = 22 - k
        cx = 45 - k * 4
        half = max(1, 4 - k // 2)
        rect(g, cx - half, y, cx + half, y + 1, "#cdb98d")
    for k in range(0, 7):                               # the right branch
        y = 22 - k
        cx = 51 + k * 4
        half = max(1, 4 - k // 2)
        rect(g, cx - half, y, cx + half, y + 1, "#cdb98d")

    # the signpost standing in the crook, an arm down each road
    rect(g, 47, 9, 49, 22, "#4a3423")
    rect(g, 38, 10, 47, 13, "#a97f52")
    rect(g, 38, 10, 47, 11, "#c39a68")
    rect(g, 49, 14, 58, 17, "#8f6942")
    rect(g, 49, 14, 58, 15, "#a9814f")
    disc(g, 48, 8, 1, "#ffd98a")                        # a small lamp on top

    def walker(x, coat, hair, skin):
        rect(g, x, 20, x + 5, 23, skin)                 # head
        rect(g, x, 18, x + 5, 20, hair)                 # hair
        rect(g, x - 1, 23, x + 6, 29, coat)             # coat
        rect(g, x, 29, x + 2, 32, "#2f2a26")            # legs
        rect(g, x + 3, 29, x + 5, 32, "#2f2a26")

    walker(33, "#e07d9c", "#5a3524", "#f6d8bc")         # her
    walker(57, "#4a5f86", "#2f231b", "#e8c3a2")         # him
    return g


# --------------------------------------------------------------- 2. ouissy
def ouissy():
    g = grid("#7fd4f5")
    band(g, 0, 4, "#63c6f0")
    for cx in (14, 46, 78):                              # clouds
        blob(g, cx, 6, 7, 2, "#ffffff")
        blob(g, cx + 5, 5, 5, 2, "#ffffff")
    disc(g, 84, 5, 4, "#fff6c0")                          # sun
    # the castle on the skyline
    rect(g, 6, 11, 22, 22, "#b9748a")
    for tx in (6, 11, 16):
        rect(g, tx, 8, tx + 4, 12, "#a4617a")
        rect(g, tx + 1, 6, tx + 3, 8, "#8e4d68")
    rect(g, 12, 16, 16, 22, "#5c2438")                    # the gate
    # the ground
    band(g, 25, 27, "#77c65a")
    band(g, 27, 32, "#a97448")
    band(g, 29, 32, "#8e5c36")
    # blocks: two brick, one gift with a heart on it
    for bx in (30, 38):
        rect(g, bx, 15, bx + 7, 22, "#c9743f")
        rect(g, bx, 15, bx + 7, 16, "#e09257")
        px(g, bx + 3, 18, "#8e4d28"); px(g, bx + 4, 18, "#8e4d28")
    rect(g, 46, 15, 53, 22, "#f0c24a")
    rect(g, 46, 15, 53, 16, "#ffe08a")
    for hx, hy in ((48, 18), (50, 18), (49, 19), (48, 19), (50, 19), (49, 20)):
        px(g, hx, hy, "#d4405f")
    # her, mid jump, between the blocks and the ground
    rect(g, 60, 17, 66, 20, "#f6d8bc")                    # face
    rect(g, 60, 15, 66, 17, "#6b4326")                    # hair
    rect(g, 59, 20, 67, 26, "#f27ba4")                    # dress
    rect(g, 61, 26, 63, 28, "#f6d8bc")                    # legs
    rect(g, 64, 26, 66, 28, "#f6d8bc")
    return g


# ----------------------------------------------------------------- 3. apoc
def apoc():
    g = grid("#111a2e")
    band(g, 0, 6, "#0d1425")
    band(g, 6, 12, "#182games" if False else "#182444")
    band(g, 12, 17, "#243155")
    disc(g, 78, 6, 3, "#e8eeff")                          # moon
    for sx, sy in ((12, 3), (30, 5), (52, 2), (64, 8), (88, 12), (20, 9)):
        px(g, sx, sy, "#cdd8f0")
    # a broken skyline
    blocks = [(2, 14, 11, 32), (13, 18, 20, 32), (22, 11, 32, 32),
              (34, 16, 41, 32), (43, 9, 52, 32), (54, 15, 62, 32),
              (64, 13, 74, 32), (76, 19, 86, 32), (88, 15, 96, 32)]
    for x0, y0, x1, y1 in blocks:
        rect(g, x0, y0, x1, y1, "#0b1120")
        rect(g, x0, y0, x1, y0 + 1, "#16203a")
    # one window still lit, and a couple of dim ones
    rect(g, 45, 12, 48, 15, "#ffcf7a")
    rect(g, 45, 12, 48, 13, "#ffe4ad")
    rect(g, 26, 15, 28, 17, "#7d6a4a")
    rect(g, 67, 17, 69, 19, "#6d5c42")
    # the road, and her on it with a torch
    band(g, 27, 32, "#1a1626")
    band(g, 30, 32, "#221c30")
    for dx in range(4, W, 14):                            # centre line
        rect(g, dx, 30, dx + 6, 31, "#3a3048")
    # the torch beam, thrown forward from her
    for i in range(20):
        y = 24 + i // 4
        rect(g, 36 + i, y, 37 + i, y + 3 - i // 8, "#3a3c42")
    rect(g, 30, 20, 35, 24, "#e8c9a8")                    # face
    rect(g, 30, 18, 35, 20, "#4a2f22")                    # hair
    rect(g, 29, 24, 36, 30, "#7d4a5e")                    # coat
    rect(g, 35, 24, 37, 26, "#ffcf7a")                    # the torch itself
    return g


# ----------------------------------------------------------------- 4. race
def race():
    g = grid("#ffb27a")
    band(g, 0, 4,  "#f2836a")
    band(g, 4, 8,  "#ff9d72")
    band(g, 8, 12, "#ffc48c")
    band(g, 12, 14, "#ffdcae")
    disc(g, 72, 12, 5, "#fff2c6")                         # sun on the horizon
    band(g, 14, 17, "#4f8f6a")                            # far treeline
    blob(g, 10, 14, 5, 3, "#3f7d5c")
    blob(g, 30, 14, 4, 3, "#3f7d5c")
    blob(g, 88, 14, 5, 3, "#3f7d5c")
    band(g, 17, 32, "#5f9e57")                            # verge
    band(g, 22, 32, "#4f8c49")
    # the road, running to a vanishing point
    for y in range(17, 32):
        t = (y - 17) / 14.0
        half = int(4 + t * 40)
        rect(g, 48 - half, y, 48 + half, y + 1, "#8e8172")
        rect(g, 48 - half, y, 48 - half + max(1, int(1 + t * 3)), y + 1, "#e8556b")
        rect(g, 48 + half - max(1, int(1 + t * 3)), y, 48 + half, y + 1, "#e8556b")
    for y0, y1 in ((18, 20), (22, 25), (27, 32)):         # centre dashes
        for y in range(y0, y1):
            t = (y - 17) / 14.0
            w = max(1, int(1 + t * 3))
            rect(g, 48 - w, y, 48 + w, y + 1, "#fff6e2")
    # two karts, hers ahead
    rect(g, 30, 24, 42, 30, "#f27ba4")
    rect(g, 32, 21, 40, 25, "#f6d8bc")
    rect(g, 32, 20, 40, 22, "#6b4326")
    rect(g, 29, 29, 33, 32, "#2a1c22"); rect(g, 39, 29, 43, 32, "#2a1c22")
    rect(g, 55, 25, 65, 30, "#5fb0d6")
    rect(g, 57, 22, 63, 26, "#d8ab86")
    rect(g, 57, 21, 63, 23, "#33241c")
    rect(g, 54, 29, 57, 32, "#2a1c22"); rect(g, 62, 29, 66, 32, "#2a1c22")
    return g


def svg(g, name):
    """run-length encode each row into as few rects as possible"""
    out = []
    for y, row in enumerate(g):
        x = 0
        while x < W:
            c = row[x]
            x2 = x
            while x2 < W and row[x2] == c:
                x2 += 1
            out.append('<rect x="%d" y="%d" width="%d" height="1" fill="%s"/>'
                       % (x, y, x2 - x, c))
            x = x2
    body = "".join(out)
    return ('<svg class="hub-scene" viewBox="0 0 %d %d" preserveAspectRatio="xMidYMid slice" '
            'aria-hidden="true" shape-rendering="crispEdges">%s</svg>' % (W, H, body))


if __name__ == "__main__":
    import sys
    for key, fn in (("quest", quest), ("ouissy", ouissy), ("apoc", apoc), ("race", race)):
        sys.stdout.write("===%s===\n%s\n" % (key, svg(fn(), key)))
