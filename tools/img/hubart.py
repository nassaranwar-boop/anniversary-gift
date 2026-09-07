#!/usr/bin/env python3
"""
The five cards on the chapter menu.

They were CSS gradients: a green band with a white dot for the adventure, a
pink block for the platformer, a grey smear for the apocalypse. At the size
they are drawn that is not a picture of anything -- it is a swatch, and a
row of swatches tells her nothing about what she is choosing between.

These are small pixel scenes instead, one per chapter, painted on a 96x32
grid and emitted as run-length SVG so they stay crisp at any card size and
cost nothing to load. Pixels because four of the five chapters are pixel
games; the card should look like the thing behind it.

One rule holds across all five: SHE IS IN EVERY ONE. Three of the chapters
are named after her and she was a four-rectangle smudge on two of them, so
there is a figure function here now rather than a shape per card, and the
night shift -- which had no picture at all, only a CSS shutter with two
eyes under it -- has her at the desk between its two doors.

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


# --------------------------------------------------------------- Ouissy
def ouissy_figure(g, x, feet, skin, hair, dress, trim, dark, facing=1,
                  arm=None, legs=True):
    """Her, ten pixels of her, standing on `feet` with her middle at `x`.

    The cards used to spell a person out in four flat rectangles -- a
    block for the face, a block for the hair, a block for the coat -- and
    at the size these are actually drawn that is a smudge with a lighter
    smudge on top. It is her name on three of the five cards; she should
    be findable on all of them.

    So there is a silhouette here instead: the hair is wider than the
    head and falls behind the shoulder, the shoulders are wider than the
    waist, there are two eyes and there are two legs. None of that is
    detail for its own sake -- a head narrower than its hair and a gap
    between two legs are the two things that make a shape read as a
    person at ten pixels, and both of them were missing.

    `facing` is 1 for looking right and -1 for left; `arm` is where a
    hand goes if she is holding something."""
    top = feet - 15
    # hair: the mass behind, wider than the head, with a fall down her back
    rect(g, x - 4, top, x + 4, top + 6, hair)
    if facing > 0:                                         # the fall, behind
        rect(g, x - 5, top + 3, x - 2, top + 11, hair)     #   her shoulder,
    else:                                                  #   which is the
        rect(g, x + 2, top + 3, x + 5, top + 11, hair)     #   other one each way
    # face, inset so the hair frames it
    rect(g, x - 3, top + 2, x + 3, top + 7, skin)
    rect(g, x - 3, top + 2, x + 3, top + 3, hair)          # the fringe
    ey = top + 4
    px(g, x - 2 + (facing > 0), ey, dark)                  # two eyes
    px(g, x + (facing > 0), ey, dark)
    px(g, x - 1 + (facing > 0), top + 6, trim)             # a mouth
    # shoulders wider than the waist
    rect(g, x - 4, top + 7, x + 4, top + 9, dress)
    rect(g, x - 4, top + 7, x + 4, top + 8, trim)          # the light on top
    rect(g, x - 3, top + 9, x + 3, top + 13, dress)
    rect(g, x - 3, top + 12, x + 3, top + 13, dark)        # the hem in shadow
    if arm is not None:                                    # one arm, held out
        ax = x + 3 * facing
        rect(g, min(ax, arm), top + 8, max(ax, arm) + 1, top + 10, dress)
        rect(g, arm - (facing < 0), top + 8, arm + (facing > 0) + 1,
             top + 10, skin)                               # and a hand on it
    if legs:
        # `dark` is the colour of her own shadow, and on a night card that
        # is the colour of the road too -- drawn in it she had no legs at
        # all. `boot` is one step up from it so the gap between them shows.
        boot = dark if legs is True else legs
        rect(g, x - 3, top + 13, x - 1, feet, boot)
        rect(g, x, top + 13, x + 2, feet, boot)


# ----------------------------------------------------------------- 3. apoc
def apoc():
    g = grid("#111a2e")
    band(g, 0, 6, "#0d1425")
    band(g, 6, 12, "#182444")
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
    rect(g, 90, 18, 92, 20, "#6d5c42")
    # the road
    band(g, 27, 32, "#1a1626")
    band(g, 30, 32, "#221c30")
    for dx in range(4, W, 14):                            # centre line
        rect(g, dx, 30, dx + 6, 31, "#3a3048")

    # THE BEAM. Painted before she and the thing it lands on are, or it
    # paints over both of them.
    #
    # Two goes at this were wrong in the same way. On a picture this dark
    # every solid fill reads as an OBJECT, so a level grey wedge laid
    # down the road is not light, it is a plank someone has left there.
    # What makes it read as light is that it is a triangle with its point
    # at the lamp, that it is warm rather than grey, and above all that it
    # RUNS OUT -- a torch in a dead city lights about six feet and then
    # gives up, which is the whole reason the thing further down the road
    # is only a shape.
    # It is DITHERED, and that is the whole trick. There is no alpha in a
    # grid of flat pixels, so a beam painted solid is opaque no matter how
    # carefully its colour is chosen, and opaque is what made the first two
    # read as a plank. Leaving every other pixel as road lets the road
    # show through it, and at the size this card is actually drawn the two
    # average into something with light on the far side of it.
    for i in range(30):
        x = 37 + i
        t = i / 29.0
        top = 25 - int(t * 3.5)
        bot = 27 + int(t * 3.5)
        for y in range(top, bot + 1):
            edge = y == top or y == bot
            if t < 0.16:
                px(g, x, y, "#6a5636")                 # solid at the lens
            elif (x + y) % 2 == 0 and not (edge and t > 0.5):
                px(g, x, y, "#4c3f2c" if t < 0.5 else "#3a3129")


    # A MINI ZOMBIE, in the middle of the beam and further down the road
    # than she is, which is what makes it read as further away: it is
    # shorter, it is standing higher up the picture, and it is drawn in
    # the flat greens the light does not flatter.
    zx, zfeet, zdark = 68, 30, "#26311f"
    rect(g, zx - 2, zfeet - 9, zx + 3, zfeet - 5, "#6f8a52")     # head
    rect(g, zx - 2, zfeet - 10, zx + 3, zfeet - 8, zdark)        # ragged hair
    px(g, zx - 1, zfeet - 7, "#cfe89a")                          # two dull eyes
    px(g, zx + 1, zfeet - 7, "#cfe89a")
    px(g, zx, zfeet - 6, zdark)                                  # a slack mouth
    rect(g, zx - 3, zfeet - 5, zx + 4, zfeet - 1, "#46583a")     # torn shirt
    px(g, zx - 1, zfeet - 3, zdark)                              # and the tears
    px(g, zx + 2, zfeet - 2, zdark)
    rect(g, zx - 6, zfeet - 5, zx - 3, zfeet - 3, "#6f8a52")     # arms, reaching
    rect(g, zx - 7, zfeet - 5, zx - 6, zfeet - 3, "#a8b072")     #   back at her
    for wy in range(zfeet - 10, zfeet):                          # her torch just
        px(g, zx - 3 if wy > zfeet - 6 else zx - 2, wy, "#a8b072")   # reaches it
    rect(g, zx - 2, zfeet - 1, zx, zfeet + 2, zdark)             # legs, mid-drag
    rect(g, zx + 1, zfeet - 1, zx + 3, zfeet + 1, zdark)

    # and her, between us and it, holding the only light left
    ouissy_figure(g, 26, 32, skin="#e8c9a8", hair="#4a2f22",
                  dress="#7d4a5e", trim="#9a5c72", dark="#2a1a22",
                  facing=1, arm=32, legs="#46313f")
    rect(g, 33, 25, 35, 27, "#3f3f46")                    # the torch itself
    rect(g, 35, 25, 36, 27, "#ffcf7a")                    # and its lens
    px(g, 35, 24, "#ffe4ad")
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


# ------------------------------------------------------------ 5. nightshift
def nightshift():
    """The office, from the only side of the desk she is allowed to be on.

    The other four cards are all outdoors and all have a horizon. This
    chapter does not have one: the whole of it is a room she cannot leave,
    with a door on each side and no way to watch both. So the picture is
    the room, built the same way the outdoor ones are -- a far plane, a
    middle and a near one -- with the doors doing the work the horizon
    does elsewhere. The card it replaces was a CSS shutter with two eyes
    floating under it, which is a mood and not a place.

    Everything in here is in the chapter: the toy-shop shelf, the amber
    the building is lit in, the camera monitor in its own sour green, the
    charge meter with a bite already out of it, and Cogsworth standing in
    the left doorway where the game puts him."""
    g = grid("#1b1510")
    band(g, 0, 5, "#0e0b09")                  # the ceiling, out of the light
    band(g, 5, 24, "#241c16")                 # the back wall
    band(g, 24, 27, "#2e241b")                # the skirting
    band(g, 27, 32, "#15100c")                # and the floor

    # WHAT THE BULB REACHES, before anything is put in front of it.
    #
    # This began as a stepped triangle, which does not read as light --
    # it reads as a dark tent pitched against the back wall. Light falls
    # off in every direction at once, so it is three flat ellipses, each
    # one a shade above the one outside it. And it is then clipped back
    # to the wall, because an unclipped ellipse bulges through the
    # ceiling and the skirting and stops being light again: it becomes a
    # hill with a shop built on it.
    blob(g, 47, 16, 42, 14, "#2a211a")
    blob(g, 47, 13, 26, 10, "#33281d")
    blob(g, 47, 9, 13, 6, "#3e3022")
    band(g, 0, 5, "#0e0b09")
    band(g, 24, 27, "#2e241b")
    band(g, 27, 32, "#15100c")

    # the bulb itself, on its flex
    rect(g, 47, 0, 48, 3, "#3a2f22")
    disc(g, 47, 4, 2, "#ffcf7a")
    px(g, 47, 3, "#fff0c4")

    # the shelf of stock along the back wall: this is a toy shop, and it
    # is the only line in the picture with any colour left in it
    rect(g, 18, 12, 78, 13, "#3a2c1f")
    for tx, c in ((21, "#c8564a"), (28, "#e6b7cd"), (35, "#8ea9c6"),
                  (58, "#b46fd0"), (65, "#c8a24a"), (72, "#7f9a5e")):
        rect(g, tx, 8, tx + 4, 12, c)
        rect(g, tx, 8, tx + 4, 9, "#0e0b09")   # each one in its own shadow
        px(g, tx + 1, 10, "#0e0b09")

    # ---- the left door: open, lit, and occupied ----
    rect(g, 1, 6, 17, 28, "#0b0806")           # the doorway
    rect(g, 3, 8, 15, 28, "#4a3a26")
    rect(g, 3, 8, 15, 10, "#5e4a30")           # the corridor's far end
    rect(g, 1, 6, 17, 8, "#332619")            # the frame, top
    rect(g, 1, 6, 3, 28, "#332619")
    rect(g, 15, 6, 17, 28, "#332619")
    rect(g, 13, 24, 15, 27, "#c8b06a")         # the door light beside it
    #   COGSWORTH, the clockwork soldier, standing in it. A silhouette,
    #   because the light is behind him -- all he gets is his shako, his
    #   shoulders, and the two lamps he has for eyes.
    #   The shako is what makes a tin soldier a tin soldier, so it is
    #   taller than his head and narrower than his shoulders, and the
    #   shoulders are square. Without those three the silhouette is a
    #   skittle with two eyes in it.
    rect(g, 7, 12, 12, 18, "#0f0b08")          # the shako
    px(g, 9, 11, "#c8564a"); px(g, 10, 11, "#c8564a")   # its plume, still red
    rect(g, 6, 18, 13, 19, "#0f0b08")          # the brim
    rect(g, 7, 19, 12, 23, "#0f0b08")          # his face
    px(g, 8, 20, "#ffb347"); px(g, 10, 20, "#ffb347")   # and the two lamps in it
    rect(g, 4, 23, 15, 28, "#0f0b08")          # square shoulders, and down
    px(g, 9, 25, "#c8564a"); px(g, 9, 26, "#c8564a")    # a button or two

    rect(g, 17, 27, 30, 30, "#241b13")         # what spills onto the floor
    rect(g, 17, 27, 24, 29, "#2c2118")

    # ---- the right door: shut, which is the other half of the trade ----
    rect(g, 79, 6, 95, 28, "#0b0806")
    rect(g, 81, 8, 93, 26, "#2a2f33")          # the shutter, down
    for sy in range(8, 26, 3):                 # its slats
        rect(g, 81, sy, 93, sy + 1, "#3f4650")
    rect(g, 81, 26, 93, 28, "#171b1e")         # the gap under it
    rect(g, 79, 6, 95, 8, "#332619")
    rect(g, 79, 6, 81, 28, "#332619")
    rect(g, 93, 6, 95, 28, "#332619")
    rect(g, 81, 24, 83, 27, "#c8564a")         # and its light, red: shut

    # ---- the desk, and the monitor she has to keep putting down ----
    rect(g, 24, 25, 74, 27, "#4a382a")         # the top
    rect(g, 24, 27, 74, 32, "#2e2219")         # the front
    rect(g, 24, 27, 74, 28, "#3a2c20")
    #   the charge meter, with a bite already out of it
    rect(g, 27, 29, 43, 31, "#120e0b")
    rect(g, 28, 29, 37, 31, "#ffcf5a")
    rect(g, 28, 29, 37, 30, "#ffe4ad")
    #   the monitor, turned a little away from us so the screen still shows
    rect(g, 50, 12, 70, 25, "#161c1e")
    rect(g, 52, 14, 68, 23, "#2f6f66")
    rect(g, 52, 14, 68, 16, "#4a9a8a")         # the glare across the top
    for sy in range(17, 23, 2):                # camera static
        rect(g, 53, sy, 67, sy + 1, "#3f8478")
    rect(g, 54, 18, 58, 22, "#7fe0c8")         # something moving on CAM 04
    px(g, 55, 19, "#173a34"); px(g, 57, 19, "#173a34")
    rect(g, 58, 25, 62, 27, "#161c1e")         # its little stand

    # ---- and her, between the two of them, lit from both sides ----
    ouissy_figure(g, 38, 30, skin="#e8c9a8", hair="#3e2718",
                  dress="#c05f86", trim="#e88fae", dark="#2a1a22",
                  facing=-1, arm=33, legs=False)
    #   the monitor is on her right and the doorway on her left, and she
    #   is the only thing in the room getting both
    for y in range(18, 24):
        px(g, 34, y, "#7a5c36")        # the doorway down one side of her
    px(g, 35, 16, "#7a5c36")           #   and just catching her hair
    for dx in range(42, 58):           # and the monitor's own light, which
        px(g, dx, 25, "#3f6a62")       #   falls on the desk between them
        if dx > 45:
            px(g, dx, 26, "#33544e")
    return g


def svg(g, name):
    """Run-length each row, then merge downward.

    Row-wise encoding alone was fine while every scene was flat bands and
    solid blocks. A dithered beam is one rect per pixel, and the two night
    cards between them added forty-odd kilobytes to the document that
    every visit has to parse before anything is drawn.

    So a run that repeats on the row below, at the same x and the same
    width and in the same colour, becomes one taller rect instead of two.
    That costs nothing to draw and takes most of it back: the merge is
    worth more on the flat cards than on the busy ones, because a wall
    thirty rows deep collapses to a single rect."""
    runs = []                                  # (y, x, w, colour) per row
    for y, row in enumerate(g):
        x = 0
        while x < W:
            c = row[x]
            x2 = x
            while x2 < W and row[x2] == c:
                x2 += 1
            runs.append([y, x, x2 - x, c, 1])
            x = x2

    by_row = {}
    for r in runs:
        by_row.setdefault(r[0], []).append(r)
    for r in runs:
        if r[4] == 0:
            continue                           # already swallowed from above
        y = r[0] + 1
        while True:
            below = None
            for o in by_row.get(y, ()):
                if o[4] and o[1] == r[1] and o[2] == r[2] and o[3] == r[3]:
                    below = o
                    break
            if below is None:
                break
            below[4] = 0                       # taken
            r[4] += 1
            y += 1

    body = "".join(
        '<rect x="%d" y="%d" width="%d" height="%d" fill="%s"/>' % (x, y, w, h, c)
        for y, x, w, c, h in runs if h)
    return ('<svg class="hub-scene" viewBox="0 0 %d %d" preserveAspectRatio="xMidYMid slice" '
            'aria-hidden="true" shape-rendering="crispEdges">%s</svg>' % (W, H, body))


if __name__ == "__main__":
    import sys
    for key, fn in (("quest", quest), ("ouissy", ouissy), ("apoc", apoc),
                    ("nightshift", nightshift), ("race", race)):
        sys.stdout.write("===%s===\n%s\n" % (key, svg(fn(), key)))
