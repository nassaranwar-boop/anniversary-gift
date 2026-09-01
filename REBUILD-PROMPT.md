# COMPLETE REBUILD PROMPT — "OUISSY AT THE APOCALYPSE"

> **INSTRUCTION TO CLAUDE CODE:** Delete the entire existing `apocalypse.js` file and rebuild it from zero. Do not preserve any of the old code. The game must be rebuilt from scratch to achieve a dramatically upgraded visual style — a **3D-looking or 2.5D** aesthetic inspired by third-person zombie survival games (references below). The story, dialogue, level designs, mechanics, and structure described in this document are the canonical specification. Follow them precisely.

---

## 1. PROJECT STRUCTURE

- **Single file:** `apocalypse.js` — the entire game lives in one JavaScript file
- **Canvas:** 320×180 pixels (`VW=320, VH=180`) scaled up with `image-rendering: pixelated`
- **No external assets:** Not one image file and not one audio file. Every tile, every sprite, every backdrop is drawn pixel by pixel onto the canvas. Every sound is synthesised with Web Audio API.
- **Public API:** `Apocalypse.start()` launches the title card then Level 1. `Apocalypse.stop()` tears the loop down and silences it. Used by `script.js` on the parent page.
- **Tile size:** 16×16 pixels per tile (`T = 16`)

---

## 2. VISUAL DIRECTION — THE MOST IMPORTANT SECTION

### What the game must look like:

The game must look like a **third-person 3D zombie survival game** rendered in a stylised pixel-art or 2.5D aesthetic. Think of games like **Project Zomboid**, **The Last Stand**, or **top-down survival horror games with volumetric lighting and 3D-looking environments**.

### Reference image descriptions (from the user):
1. **Third-person 3D view** of a character standing in front of a motel/building complex at night. Real-looking buildings with visible windows, roofs with structural detail, exterior walls with texture. Pine trees and vegetation in the background. The character model is visible from behind — you can see their body, clothes, equipment.
2. **Night scene on a road** — car headlights illuminating zombies ahead on the road. Volumetric light beams from the headlights. Dark atmospheric surroundings. Road with proper lane markings. Zombies visible as silhouettes in the beam.
3. **Dawn/dusk scene** — a wide landscape with a silhouetted treeline against a colourful gradient sky (orange/purple/blue). The ground is rendered with depth — grass fields, a road cutting through, telegraph poles receding into the distance. Atmospheric haze and fog layers.
4. **Close-up of a building** — wooden structure with visible planks, a porch with railings, windows with curtains or boards. Real architectural detail — not flat rectangles but structures that look three-dimensional with roof overhangs, shadow casting, and material textures.

### Visual rules for the rebuild:
- **Buildings must look 3D:** Visible roof planes with perspective, side walls with shading/shadow, window frames with depth, door frames with recesses. Not flat tile rectangles — actual structures with mass and shadow.
- **Characters must be visible and detailed:** Not tiny blobs. The player character (Ouissy) and Anwar should have recognizable silhouettes — you should be able to see their body shape, hair, clothing colour. Third-person view from slightly above and behind.
- **Lighting must be atmospheric and volumetric:** The torch/flashlight should cast a visible cone of light. Lamps should pool warm light with falloff. Fire should flicker and cast moving shadows. The darkness should feel thick and oppressive.
- **Vegetation must have volume:** Trees should look like trees — trunk, canopy with volume, not flat green circles. Bushes should be bushy. Grass should have blades or tufts.
- **Roads and paths must have perspective:** Lane markings, kerbs, cracks, puddles. Not flat grey rectangles.
- **The sky must be a full backdrop:** Stars, moon, clouds, atmospheric gradients. Dawn and dusk scenes should have spectacular colour gradients with sun rays.
- **Zombies must be unsettling:** Visible shambling posture, torn clothing, skin discolouration. Their movement should be jerky and wrong.
- **Depth and parallax:** Multiple depth layers — a far background that scrolls slowly, a mid-ground, and a foreground. Objects should occlude each other properly. Things closer to the camera should be larger and in front.
- **Post-processing effects:** Film grain, vignette, colour grading per level (warm for fire scenes, cold blue for hospital, golden for dawn). Fog/haze layers.
- **Weather and particles:** Dust motes in light beams, embers from fires, fireflies at the campsite, smoke wisps. These bring the world alive.

### The gameplay style:
- Top-down or slightly isometric 2.5D view
- The camera follows the player character
- Stealth-based: sneaking past zombies, using cover, managing noise
- The world should feel dangerous and atmospheric — not cartoonish

---

## 3. THE STORY

### Title
**OUISSY AT THE APOCALYPSE**

### Tagline
*"the world ends. you come and find me anyway."*

### The premise
Ouissy is home alone when the outbreak starts. She sees it on the television, which is still broadcasting an emergency loop. The game is her getting to Anwar (who is asleep at the hospital), and then the two of them getting somewhere safe.

### Characters
- **Ouissy** — the player character. A young woman. Long hair (golden/brown). She is brave without knowing it. She walks across a zombie-infested city at night because the person she loves is alone in a hospital.
- **Anwar** — her partner. He's been in hospital. Dark short hair. Broader build. When she finds him, he doesn't ask why she came — he already knows.

---

## 4. LEVEL CARDS — shown before each level

```
Level 1: HOME
"Your parents are away. The news is still on."

Level 2: THE STREETS
"He's asleep at the hospital. That's where you're going."

Level 3: THE HOSPITAL
"Find him before the corridors fill up."

Level 4: THE ROAD
"Out of the city, any way you can."

Level 5: THE GATES
"They only take you if you're clean."
```

---

## 5. HOW-TO CARD (shown once before Level 1)

```
← ↑ ↓ →          move (or WASD)
SHIFT             hold to creep — slower, but almost silent
E or SPACE        use whatever you're standing at
ESC               pause
on a phone        the pad and the two buttons do all of it

the dark          you only see as far as your torch. Lit rooms show more
cover             step into a wardrobe, a bush, or behind a car and they lose you
noise             running is loud. They come and look at where the sound was
getting caught    you get pulled back to somewhere safe. That's all. Try again
```

---

## 6. ALL DIALOGUE — VERBATIM

### 6A. THE REUNION (Level 3 — when Ouissy finds Anwar)

#### Waking scene:
```
[narration] He is on his side with one arm out of the blanket. She says his name twice before anything happens.
ANWAR: ...Ouissy?
ANWAR: What time is it.
OUISSY: We have to go.
ANWAR: Okay.
[narration] He doesn't ask why. That tells her he has already heard something.
```

#### Hiding scene (they find a room with a bolt on the door):
```
[narration] The door goes shut behind them. There is a bolt on it, and the bolt works.
[silence]
ANWAR: You walked here.
OUISSY: Yeah.
ANWAR: From the house.
OUISSY: Yeah.
[silence]
ANWAR: You're insane.
OUISSY: I know.
[narration] He laughs, once, and it comes out wrong, and then he stops.
ANWAR: ...Come here.
[narration] They stay like that for a while. Neither of them says anything for a while.
ANWAR: I kept thinking, if this is real, she's on her own in that house.
OUISSY: I'm not on my own.
ANWAR: No.
[silence]
OUISSY: So what do we do.
ANWAR: I don't know yet.
ANWAR: Give me a minute and we'll work it out.
OUISSY: Okay.
[silence]
[narration] There has been a radio talking on the shelf behind them for the whole of that, too quiet to be words.
OUISSY: ...How long has that been on?
```

### 6B. THE HORSE (Level 4 — roadside submap)
```
[narration] There is a field gate at the end of the lane with a name painted on it by hand, a long time ago, by somebody who was not in a hurry.
[narration] They hear her before they see her: a shift of weight, and then hooves on a concrete floor.
[narration] There is one animal left in the barn and she has heard them coming from the yard.
[narration] She puts her whole head over the door before Ouissy has got near it.
OUISSY: Oh — hello. Hello.
ANWAR: She's enormous.
OUISSY: She's lovely. Look at her.
[narration] There is a headcollar on the hook and somebody's name painted over the stall. She is not going to be collected.
ANWAR: Can you actually ride?
OUISSY: No.
ANWAR: Right.
OUISSY: Get on.
```

### 6C. THE CAMPSITE ARRIVAL
```
[narration] The clearing is just off the lane, behind a wall that was a house once. The grass is flat enough and the trees cut the wind.
[narration] She lets the horse stop on its own. It dips its head and doesn't move again.
ANWAR: ...Here?
OUISSY: Hang on.
[narration] She stands still and listens. Wind in the branches. The stream somewhere below them. Nothing else.
OUISSY: Yeah. Here.
ANWAR: You're sure? There's nothing — no walls, no—
OUISSY: That's why here. Nothing to hide behind, nothing to come out of. If anything moves we'll see it a mile off.
[narration] He looks at the treeline and the open grass and the sky, which is starting to turn. He nods.
ANWAR: Okay. What do we need?
OUISSY: Wood, before it gets dark. There should be enough around — dead branches, anything dry.
ANWAR: I can help—
OUISSY: You can sit down is what you can do. You've been on a horse for four hours and you were in bed for a week before that.
ANWAR: I'm fine.
OUISSY: You're grey. Sit.
[narration] He sits. She doesn't say anything about the fact that he sits down immediately, which is as close to kindness as she can manage right now.
```

### 6D. WOOD GATHERING DIALOGUE (3 stages)

**Wood piece 1:**
```
[narration] She snaps a branch off a dead elm. It is dry enough that it comes away clean.
[narration] Across the clearing, he is on his knees pulling grass out of the dirt with both hands, making a bare circle in the ground.
```

**Wood piece 2:**
```
[narration] She finds another piece wedged in a low fork — birch, pale and papery. Good kindling.
OUISSY: How's it going over there?
ANWAR: I found some stones. Flat ones, for a ring.
OUISSY: You don't have to—
ANWAR: I want to do something. Let me do something.
```

**Wood piece 3:**
```
OUISSY: Right. That's plenty.
[narration] She carries the last armful back and stops. He has built a proper fire pit — a circle of flat stones on bare earth, with a gap on one side for air.
OUISSY: ...That's actually good.
ANWAR: Don't sound so surprised.
```

### 6E. LIGHTING THE FIRE
```
[narration] She kneels by the pit he made and starts stacking the wood: a loose cone with the driest pieces in the centre and the bark facing in, the way her mother showed her years ago in somebody's garden.
ANWAR: Where did you learn that?
OUISSY: Mum. Bonfire night. I was about seven.
[narration] He crouches on the other side of the pit and holds the cone steady while she wedges the last piece in. The birch bark curls inward and the whole thing looks like it might actually work.
OUISSY: Right. Lighter?
ANWAR: Still in my pocket, somehow.
[narration] The first spark catches nothing. She cups her hand around it and tries again — the flame licks sideways, finds air instead of bark, and goes out.
OUISSY: ...Come on.
ANWAR: Try the other side. The wind's coming from—
OUISSY: I know where the wind's coming from.
[narration] She moves around. He strips a curl of bark off one of the birch pieces and tucks it into the base where the gap in the stones lets air through.
OUISSY: That's good. Hold it there.
[narration] Third try. The spark catches the curl. A thin thread of smoke, and then a crackle, and then the whole thing talks back at once — a low, steady roar that neither of them has heard for days.
```

Then:
```
ANWAR: ...Oh, that's good.
[narration] He sits back on his heels and the firelight catches his face and he looks exhausted and relieved and something else she doesn't have a word for.
OUISSY: Sit down properly. You look awful.
ANWAR: I've looked awful for a week. You just couldn't see it in the dark.
[silence]
[narration] He moves to the log on the far side of the fire and lowers himself onto it carefully, the way people do when everything hurts. She sits on the other log, closer than she needs to, and pulls her knees up.
[narration] For a while neither of them says anything. The fire crackles. The stream moves. The sky is turning the colour it turns when there is nothing left of the day.
[narration] It is the first time since the television came on that there is nothing she has to do next.
```

### 6F. CAMPFIRE DIALOGUE (the long scene)
```
ANWAR: How did you know where I was?
OUISSY: You were in hospital. Where else were you going to be?
ANWAR: That's not what I mean. The ward — it was locked. The whole floor was dark. How did you find the right room?
OUISSY: I tried every door.
ANWAR: ...There are a lot of doors in that building.
OUISSY: Yes.
[silence]
[narration] He doesn't push it. The fire pops, and something in the wood shifts, and neither of them says anything for a while.
[silence]
ANWAR: Were you frightened?
OUISSY: The whole time.
ANWAR: Of the—
OUISSY: Of everything. Of the noise, and the dark, and not knowing if you were—
OUISSY: Yes. I was frightened the whole time.
ANWAR: I woke up and the power was out and nobody was on the ward. I didn't know what had happened. I thought—
ANWAR: I thought maybe everyone just left.
OUISSY: I didn't leave.
ANWAR: No. You came and got me.
[silence]
[narration] A long time passes. The stream sounds different in the dark — closer, as though the water has risen. It hasn't. There is just nothing else to hear.
[silence]
OUISSY: Anwar.
ANWAR: Mm.
OUISSY: I need to tell you something and I need you not to make it into a thing.
ANWAR: ...Okay.
OUISSY: When I got to the car park and the car actually started — that was the first time I thought I might actually get to you.
OUISSY: Not before that. Not in the house, not on the street, not in the hospital. I was just doing the next thing because I didn't know how to stop.
OUISSY: I wasn't being brave. I didn't have a plan. I was just — moving.
ANWAR: That is brave.
OUISSY: It isn't. It's just not stopping.
ANWAR: Same thing.
[silence]
[narration] She pulls a twig apart and drops the pieces into the fire one at a time.
[silence]
OUISSY: I'm going to say something and I don't want you to say anything back. I just want you to hear it.
ANWAR: All right.
OUISSY: I would do it again.
OUISSY: All of it. The house, the streets, the hospital. Every door and every dark corridor and every time I thought something was right behind me.
OUISSY: I would do every single second of it again.
[silence]
[narration] He doesn't say anything. He said he wouldn't.
[silence]
ANWAR: Can I say something now?
OUISSY: No.
ANWAR: Okay.
OUISSY: ...Fine. What.
ANWAR: I know.
[silence]
[narration] The fire burns low. Above the clearing the stars are out, which neither of them has seen in a city for a long time, and which neither of them mentions because it would break something.
[silence]
OUISSY: We should sleep. The gates can't be far.
ANWAR: How far?
OUISSY: The radio said north road, past the reservoir. An hour, maybe, on the horse.
ANWAR: You should sleep first. I'll watch the fire.
OUISSY: You were in a hospital bed for a week.
ANWAR: And you carried me out of it. Sleep.
[silence]
[narration] She doesn't argue. She doesn't move either.
[silence]
[narration] Her head finds his shoulder, and stays there.
[narration] He doesn't move. He barely breathes.
[silence]
[narration] She is asleep before he has counted to ten.
[narration] He sits by the fire and watches the dark, which is what it looks like when somebody loves you back.
```

### 6G. THE ROOFTOP DIALOGUE (final scene)
```
[narration] The roof is flat and wide and the air up here is clean.
[narration] The whole of the valley is underneath them, and whatever is burning in it is a long way off.
[silence]
ANWAR: I can't believe we're here.
OUISSY: I know.
[silence]
ANWAR: I didn't think we'd make it past the ring road.
OUISSY: I didn't think past the hospital.
[narration] He laughs, short and real, and it is the first time in days it has sounded like him.
[silence]
ANWAR: Have you tried the phone again?
OUISSY: There's no signal. There's been nothing since the second day.
ANWAR: Mine too. Network's gone.
[silence]
OUISSY: My mum would've gone to Aunt Sara's. That's what they always said — if anything happened, go to Sara's.
ANWAR: My parents would've gone to the mosque. Or to Nana's.
OUISSY: Then that's where we look. When things calm down, that's where we go first.
ANWAR: Both places. Yours and mine.
OUISSY: Both places.
[silence]
[narration] They are quiet for a while. A light goes on and off in a window three streets away, and then it stays off.
[silence]
ANWAR: You know the worst part?
OUISSY: What.
ANWAR: I wasn't scared for me. I was scared because I didn't know where you were.
[silence]
OUISSY: I was scared for you too.
OUISSY: That's why I walked.
[silence]
[narration] He reaches over and takes her hand, and neither of them lets go.
[silence]
ANWAR: What do we do now?
OUISSY: We wait until it's safe. Then we find our families.
ANWAR: And if it doesn't get safe?
OUISSY: Then we work it out. Like we worked out everything else.
[silence]
ANWAR: Together.
OUISSY: Obviously together. That's the whole point.
[narration] He turns and looks at her, properly looks, for the first time since the hospital.
[silence]
ANWAR: Come here.
[narration] She leans into him, and he puts his arm around her, and the city below them is the quietest it has ever been.
[silence]
[narration] They stay like that for a long time. There is nowhere else to be.
[narration] The moon is up and the smoke has cleared enough to see the stars.
[silence]
OUISSY: Hey.
ANWAR: Yeah?
OUISSY: We made it.
[silence]
ANWAR: Yeah. We did.
```

### 6H. THE RADIO (found in Level 3 / campsite)
```
"— stay off the roads at night. Do not attempt to reach us after dark —"
"— Ashcombe reception is open. We are accepting anyone who is not bitten —"
"— you will be checked at the gate and you will be given the serum. Both are required —"
"— that is Ashcombe. North road, past the reservoir. We are still here —"
```

### 6I. THE TV BROADCAST (Level 1)
The broadcast text that loops:
```
"STAY INSIDE. LOCK WHAT YOU CAN LOCK."
"DO NOT APPROACH ANYONE WHO SEEMS UNWELL."
"DO NOT ATTEMPT TO HELP THEM."
"HOSPITALS IN THESE DISTRICTS ARE NO LONGER TAKING CALLS."
```

Ticker text:
```
"EMERGENCY BROADCAST • THIS IS NOT A TEST • REMAIN INDOORS • DO NOT TRAVEL • KEEP THIS CHANNEL OPEN • "
```

The broadcast must be drawn as a scene: a TV studio that has lost most of its lights, somebody still sitting at the desk who should have gone home, the emergency triangle on the wall behind them, a chyron running along the bottom with the same four lines going round, and static/scanlines over all of it that thicken and tear whenever the signal drops.

### 6J. ENDING CARD
```
"TO BE CONTINUED…"
"the world ended. you came and found me anyway."
```

---

## 7. ALL LEVEL MAPS

The grid system uses characters to define tiles. Preserve these grids exactly — they define the game's layout and progression.

### LEGEND
```
space  nothing (outside the map)
.      floor, walkable
,      outdoor ground
#      wall — blocks her and blocks sight
o      tall furniture / hedge / car — blocks her and blocks sight
=      low furniture — blocks her, sight passes over it
h      a hiding place: walkable, and while she is in it nothing can see her
d      a door she can just open
D      a door locked with a code — needs the note
P      a door with no power — needs the wire panel
W      the wire panel itself
N      the note with the code on it
T      the television / a radio — a story beat
C      a car, in Level 4: the one she gets running
A      Anwar
H      the horse
S      where she starts
X      the way out — reaching it ends the level
z      a zombie
l      a lamp: lights the room around it, walkable
L      a lamp on a post: lights the street, solid
G      a gate (Level 5)
Q      checkpoint/quarantine desk (Level 5)
```

Additional tile characters used in the grids:
```
v      window (exterior wall with glass)
B      bed
F      large furniture (sofa/couch)
K      kitchen counter / long counter
n      small furniture / nightstand
u      chair/stool
q      small item (object on floor)
r      rug/carpet
f      fridge/appliance
i      item/interactable (generic)
x      zombie (alternate placement)
y      medical equipment / debris (hospital)
Y      large medical equipment
j      janitor closet / storage
c      car (parked, not drivable) / crate
w      woodpile (campsite)
b      bedroll (campsite)
g      gathering point for wood (campsite)
~      stream (campsite)
*      fire pit (depth test)
```

### LEVEL 1 — HOME
A house at night with the power out. Her room and the landing above, the living room, kitchen, and garage below. The TV is still on in the living room. The only way out is the garage door, which has no power.

Theme: `house`, Dark: `0.68`
Grade: `[180, 115, 55, 0.16]`, Haze: `[30, 38, 60, 0.28]`

```
####vv####################v#######
v.h..BB....#..=.....#.=nn.......o#
#....BB....#........#....BB......#
#...S......#....h...#..i........h#
#..=...n...#........#............#
#..........#...=....#.o..=......o#
#####d###########d#########d######
#................................#
#..=.........................o...#
#................................#
#######d########d#########d#######
#.nn......FFF..#fKKK.h...#.o....o#
#.uT......FFF..#....K....#...W...#
v.......rr=r...#....K....#.......#
v.q.==..rrrr...#....K....#o.....o#
#...==....o....#...i.....#.......#
#qh............#KKKKKKK..#.......#
#..............#.........#.......#
#############################P####
#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
#,,,,,,,,,,,,,,,,,,,,,,,,,,,,X,,,#
```

Steps:
1. "The TV is still on downstairs. Go and see." → clears: "tv"
2. "Get out. The garage door has no power." → clears: "panel"
3. "The garage door is open. Go." → clears: "exit"

### LEVEL 2 — THE STREETS
Three roads across, three roads down, and the blocks between them. Deliberately bigger and more open than the house. The main road east is the short one and the worst one. The alleys are slow and dark and safe. Behind the shops there is a staff gate with a code (4180), written on a scrap of paper in the corner shop.

Theme: `street`, Base: `,`, Dark: `0.62`
Grade: `[60, 90, 180, 0.18]`, Haze: `[35, 48, 80, 0.36]`

```
                                                
                                                
                                                
################################################
####,S,.############.,,.################.,,.####
####,,,.############.,,.################.,,.####
####,,,.############.,,.################.,,.####
#....,,L...........c.,,L.................,,L...#
#,,,.,,.,,z,,,,,,,,,.,,.,,,,,,,,,,,,,,,,.,,.,,,#
#,,,.,,.h,,,,.,,,,,,.,,.,,,,z,,,,,,,,,,,.,,.,,,#
#....,,.h...........h,,................c.,,....#
####.,,.#####.######h,,.################.,,.####
####.,,.#####.######.,,...i..............,,.####
####.,,.#####x######.,,.################.,,.####
####.,,.#####.######.,,.################.,h.####
####h,,.#####.######.,,c################.,h.####
#...h,,..............,,c.................,,....#
#,,,.,,.,,,,,,,,,z,,.,,.,,,,,,,,,,z,,,,,.,,.,,,#
#,,,.,,.,,,,,,,,,,,,.,,.,,,,,,,,,,,,,,,,.,,.i,,#
#....,,.....L....hh..,,.......h..........,,....#
####.,,.##d#########.,,.#######.########.,,.####
####.,,......#######.,,.#######.#....hh#.,,.####
####.,,......#######.,,.#######x#..c...#.,,.####
####.,,cKK...#######.,,.#######.D..c...#.,,.####
####.,,c...N.#######.,,.#######.#....c.#.,,.####
####.,,.h....#######.,,.#######.#......#.,,.####
####.,,.#.##########.,,.###########.####.z,.####
#....,,L......hh.....,,L.........##.####.,,.####
#,,,.,,.,,,,,,,,,,,,.,,.z,,,,i,,,##.#####,,#####
#,,,.,,.,,,,,,,,,,,,.,,.,,,,..x...L.......L..h.#
#....,,.....hh.....c.,,....hh.........c.z..cc.h#
####.,,.#########################...........X..#
################################################
```

Steps:
1. "Cross town to the hospital — south, then east." → clears: "exit"

### LEVEL 3 — THE HOSPITAL
Entrance hall, one corridor east to west and one crossing it, the west wing with the plant room, and Ward C behind doors with no power. He is in the far bay of Ward C.

**Pressure mechanic:** The room tone climbs the whole time. Every ~21 seconds one more zombie finds its way in through the front. This is not announced — she is just meant to notice it getting worse.

Theme: `hospital`, Dark: `0.63`
Grade: `[104, 176, 168, 0.13]`, Haze: `[58, 84, 92, 0.34]`
Dead Zone: `[20, 1, 39, 10]` (Ward C — no doors, no lights)

```
########################################
##################..####################
##oo............##..##..Bh.Bh.Bh.Bh.B.##
##......=====...##.l##..B..B.lB..B..B.##
##...W.o........##..##................##
##.....o.............P........A.......##
##....x..............P................##
##.l............##..##................##
##......=====...##.z##..B..B..B..B..B.##
##..h.........h.##.l##..BhlBh.Bh.Bh.B.##
##..............##..##................##
##################..####################
#....lyy...x..l.y.......l.....i..yl....#
#..y....x..Yy.............yy.......Y...#
#########.########..####################
##.......j##.....#....................##
##.X......##.ooo.#...KKKKKK.....=====.##
##........##.ooo.#.l...z....hhY....x..##
##........##h....#...............h....##
#########.####.###..####.###############
########......i.......Y........#########
########..KKKKKK...l..======y..#########
########....l...............l..#########
########...h....BB..yy....h....#########
########...........S......x....#########
########################################
```

Steps:
1. "Ward C has no power on the doors. Find the plant room." → clears: "panel"
2. "Ward C is open. He's in there somewhere." → clears: "anwar"
3. "Get off the corridor. Anywhere with a door that shuts." → clears: "exit"

### LEVEL 4 — THE ROAD (first half: hospital escape + car park)
Two places, one journey. First the hospital again (much worse now), and a car park with something that might start. Then a lane twenty miles out of town where the tank runs dry and the rest is somebody's horse.

The swap between the two is the drive itself — a cinematic, not playable.

Theme: `hospital`, Dark: `0.68`
Grade: `[96, 150, 170, 0.12]`, Haze: `[46, 62, 76, 0.32]`

```
####################################
####################################
##......#.##########....l........###
##..S...d.##########..=.=.=.=.=..###
##.B..h.#.##########...h.....h...###
##......#l##########..=...=...=..###
#########.##########d............###
#########x##########.###############
##.........x.zl...i...x.l.x....l..##
##.............................z..##
#########.##########################
##......#.###........###.....i...###
##.h..h.#l###..h.xh..###.o..o..o.###
##...x..#.......l...........l.B..###
##......#.###.B....B.###...z.....###
##.h....#i###..hx.h..###.o..o..o.###
##......#.###......x.###....d....###
##,z,,,,,,,,,,,,,,,,,,,,,,.....#####
##,,cc,,cc,,,i,,cc,,cc,,,,,....#####
##,,,,l,,,,,C,,,,,,l,,,x,,.....#####
##,,,,,,,,,,,,,,,,,,,,,,,,##########
####################################
```

Steps:
1. "Out of the building. Then find anything with four wheels." → clears: "car"
2. "The tank is dry. Find something else that can carry two." → clears: "horse"

### LEVEL 4 SUBMAP — ROADSIDE (after the drive cinematic)
Theme: `road`, Base: `,`, Dark: `0.42` (dawn — first level she can actually see in)
Grade: `[220, 180, 100, 0.15]`, Haze: `[140, 155, 180, 0.30]`

```
                                                
                                                
                                                
################################################
#,o,,,,,o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
#,o.....o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
#,o.....o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
#,o.CS..o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
#,o.....o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
#,o.....o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
#,o.....o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
#,o..l..o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
#,o.....o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
#,o..h..o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#
#,o.....oooooooooo..ooooooooooooooooooooo,,,,,,#
#,o.......l.h............z..h......l.....,,,,,,#
#,o............z....h.l...........h......,,,,,,#
#,o.....ooooooooooooooooooooo..oooooooo..,,,,,,#
#,o.....o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,..,,,,,,#
#,o...z.o,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,..,,,,,,#
#,o.....o,,,,,,,,,,,,,,,,,,,..................,#
#,o..h..o,,,,,,,,,,,,,,,,,,,...l.........z..h.,#
#,o.....o,,,,,,,,,,,,,,,,,,,......####d####...,#
#,o.....o,,,,,,,,,,,,,,,,,,,...h..#.......#...,#
#,o..l..o,,,,,,,,,,,,,,,,,,,......#.==..=.#...,#
#,o.....o,,,,,,,,,,,,,,,,,,,......#...H...#h..,#
#,o..z..o,,,,,,,,,,,,,,,,,,,......#.......#...,#
#,o.....o,,,,,,,,,,,,,,,,,,,......#########...,#
#,o.....o,,,,,,,,,,,,,,,,,,,..h..z.........l..,#
#,o,,,,,o,,,,,,,,,,,,,,,,,,,..................,#
################################################
```

### CAMPSITE SUBMAP (after the ride cinematic)
Theme: `campsite`, Base: `,`, Dark: `0.40`
Grade: `[190, 150, 85, 0.14]`, Haze: `[70, 64, 46, 0.22]`

```
                             
                             
                             
,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,o,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,o,,,,,,,,
,,,o,,,,,,,,,,,~,,,,,,,,,,,,,
,,,,,,w,,,,,,,,~,,,,,,,,,,,,,
,,,,,,,,,,,,,,,~,,,,,,,,o,,,,
,,,,,,,,,,g,,,,~,,,,,,,,,,,,,
,,,,,,,,,,,,,,,~,,,,b,,,,,,,,
,,,,,,,,,,g,,,,,,,,,,,,,,,,,,
,,,,,S,,,,,,,,,,,,,,b,,,,,,,,
,,,,,,,,,,,,,,,,,w,,,,,,o,,,,
,,o,,,,,,,,,,,,,,,,,,,,,,,,,o
,,,,,,,,,,,,w,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
,,,,o,,,,,,,,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,,,,,o,,,,,,,
```

Campsite steps:
1. "Make camp." → clears: "arrival"
2. "Find some wood for a fire." → clears: "wood"
3. "Light the fire." → clears: "fire"

Campsite tiles: `w` = woodpile, `b` = bedroll, `g` = wood gathering point, `~` = stream, `o` = tree

### LEVEL 5 — THE GATES
Almost no game in this one, on purpose. The road up to the fence, a holding pen with a bench and a table, and the compound on the other side. What happens here is the protocol: they are looked at, given the serum, and then somebody opens a gate. It is the quiet after four levels of not being able to stop. It should feel like being allowed to sit down.

Theme: `road`, Base: `,`, Dark: `0.28` (full morning — nothing is hiding)
Grade: `[225, 185, 110, 0.15]`, Haze: `[145, 160, 185, 0.26]`

```
                                    
                                    
                                    
####################################
#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#
#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#
#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#
#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#
#,,,,,,,,,,,,,#..........#....L....#
#,,,,,,,,,,,,,#.L......L.#.L####.L.#
#,,,,,,,,,,,,,#....===...#..####...#
#,,,h,,,,,,,,,#.....Q....#.........#
#.............#.L........#.........#
#S............G..........G......X..#
#.............#........L.#.........#
#,,,,,h,,h,,,,#..........#.........#
#,,,,,,,,,,,,,#..======..#..####...#
#,,,,,,,,,,,,,#.L......L.#.L####.L.#
#,,,,,,,,,,,,,#..........#.........#
#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#
#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#
#,,,,,,,,,,,,,#,,,,,,,,,,#,,,,,,,,,#
####################################
```

Steps:
1. "Go up to the gate. Do what they tell you." → clears: "hail"
2. "Wait at the table. They have to look at both of you." → clears: "check"
3. "They're opening the inner gate. Go in." → clears: "exit"

---

## 8. GAME MECHANICS

### 8A. TUNING VALUES
```javascript
tile: 16,               // world units per tile
walk: 52,               // px/sec
creep: 26,              // px/sec while SHIFT is held
accel: 420,
friction: 520,

torch: 64,              // how far she sees, in px
torchCreep: 54,         // smaller pool while creeping
lampFall: 1.0,

noiseWalk: 60,          // how far walking carries, in px
noiseCreep: 0,          // creeping makes none
noiseDoor: 110,         // opening a door is loud
noiseSpark: 130,        // so is a wire going wrong

zSpeed: 26,             // zombie shuffle speed
zChase: 58,             // chase speed — faster than walk, on purpose
zReact: 0.5,            // reaction delay before chasing (her window)
zSight: 84,             // how far it sees down its facing
zCone: 0.62,            // half-angle of vision cone (~35 degrees)
zNear: 20,              // notices anything this close regardless of facing
zLose: 2.0,             // seconds out of sight before giving up
zInvestigate: 4.0,      // seconds it stands looking at a noise

caughtHold: 1.5,        // how long the close-call beat holds
camLerp: 0.12,
```

### 8B. MOVEMENT
- Arrow keys or WASD to move
- Hold SHIFT to creep (slower but silent)
- E or SPACE to interact
- ESC to pause
- Mobile: virtual pad and two buttons

### 8C. ZOMBIE AI
Three types:
- **IDLE** — stands still, looking one direction
- **PATROL** — walks a line back and forth
- **DRAWN** — restless, hears 2x further than others

Zombie behaviour:
1. Each zombie has a **vision cone** (84px range, 35° half-angle). Walls block sight.
2. They react to **noise** — walking is loud (60px radius), creeping is silent, doors are very loud (110px), wire sparks are loudest (130px).
3. When they hear a noise, they walk to where it came from and investigate for 4 seconds.
4. When they see her, they rear up first (0.5s reaction time — her window to break line of sight), then chase at 58px/s (faster than her walk).
5. She must break line of sight to lose them (2 seconds out of sight).
6. They cannot see her if she is in a hiding spot (`h` tile).

### 8D. CLOSE CALL SYSTEM
- Getting caught is NOT death. She gets pulled back to the last safe point.
- It's a tense beat: screen effect (vignette, red pulse), hold for 1.5 seconds, then she's back.
- This is important to the design — it means the player can keep trying without frustration.

### 8E. GRAB MECHANIC
- When caught, there's a brief grab sequence
- Press any key twice within 1.6 seconds to break free
- Escape animation plays

### 8F. LIGHTING SYSTEM
- **Torch:** Three pools of light around her (64px normal, 54px while creeping)
- **Lamps (l):** Floor lamps that light rooms, walkable
- **Lamp posts (L):** Street lights, solid, light the area
- **Fire:** Flickering warm light source
- **TV:** Cool blue light source
- **Windows (v):** Faint ambient light
- **Dead zone (hospital Ward C):** No lights at all — pure darkness
- The **light map** is rendered at half resolution (160×90) and multiplied over the scene

### 8G. WIRE PANEL MINI-GAME
- Found in Level 1 (garage power) and Level 3 (Ward C power)
- A salvaged panel: connect wires to sockets by dragging
- Each wire has a colour-coded endpoint
- Wrong connections spark (loud noise, attracts zombies)
- Complete all connections to restore power

### 8H. KEYPAD + NOTE SYSTEM
- The gate code is **4180** (it means something to the characters)
- A note with the code is found in the corner shop in Level 2 (tile `N`)
- The locked door (tile `D`) requires entering this code on a keypad

### 8I. HIDING SPOTS
- Wardrobes, bushes, behind cars, curtains (tile `h`)
- While standing on an `h` tile, she is invisible to all zombies
- Essential mechanic for survival

### 8J. PRESSURE SYSTEM (Level 3 only)
- Every ~21 seconds, one more zombie enters from the hospital entrance
- The room tone/ambient sound climbs the whole time
- Not announced to the player — they just notice it getting worse
- Forces urgency without an explicit timer

### 8K. COVER SYSTEM
- Low furniture (`=`) blocks her movement but sight passes over it
- Tall objects (`o`) block both movement and sight
- Cars (`c`) provide hiding when parked

---

## 9. CINEMATIC SCENES

### 9A. THE DRIVE (between Level 4 first half and roadside)
- Side-scrolling view of a car driving at night
- Car is drawn in profile — bonnet, windscreen, both side windows with Ouissy and Anwar visible inside, boot, spinning wheels
- Background: starry pre-dawn sky, rolling hills at three parallax depths, telegraph poles and signs scrolling past, fence posts, grass verge
- Road markings scroll beneath
- The car coughs and dies as the fuel runs out — speed decreases, steam from the bonnet
- Headlights illuminate the road, tail-lights glow red
- Mist drifts through the headlight beams
- Caption: "Out past the ring road, and then twenty miles of nobody."

### 9B. THE RIDE (between roadside and campsite)
- Similar side-scrolling view but warmer palette
- Dawn breaking: sky gradient from indigo through rose and gold to pale morning blue
- Sun disc rising with rays
- Horse carrying two riders in silhouette
- Rolling hills at three parallax depths, trees on hilltops
- Slower, gentler pace than the drive
- Caption: "It takes most of the morning, and neither of them minds."

### 9C. THE CAMPFIRE CINEMATIC
- Wide shot composition
- Starry night sky
- Irregular treeline silhouette across the frame
- Ground level with slight texture
- Small campfire at centre — flickering flames, embers floating upward, smoke wisps
- Two silhouette figures on either side of fire, sitting on logs
- Rim-lit by firelight (warm orange edge on the fire-facing sides)
- Fire glow on ground as radial gradient
- When Ouissy falls asleep: she leans toward him over 2 seconds, head on his shoulder

### 9D. THE SUNRISE
- Full canvas sunrise over the landscape
- Sky transitions from deep indigo through rose/gold to pale morning blue over 7 seconds
- Sun rises from behind the treeline with halo and rays
- Treeline silhouette with individual tree shapes
- Birds begin flying (tiny silhouettes)
- Caption: "She wakes to birdsong, and the fire is still warm, and he is still there."

### 9E. THE ROOFTOP (final scene)
- Night sky with stars (twinkling at different rates)
- Large moon with craters and a glow halo
- Drifting clouds
- City skyline — 32 buildings of varying heights, some with lit windows that flicker
- Smoke rising from 3 buildings
- A few lights along the rooftop edge
- Water tower and antenna silhouettes
- Two small silhouette figures sitting together on the rooftop
- Fireflies/embers floating up from below
- Atmosphere of hard-won peace

---

## 10. PALETTES

Each location has its own colour palette. All drawing for a level pulls colours from the palette.

### House
- Warm browns and dark purples
- Floor: warm wood tones (#7a5e3e range)
- Walls: dark purples (#4a4260 range)
- Cover: aged wood (#9a7650 range)
- Ambient: very dark blue-black (#0a0c18)

### Street
- Cold blue-greys with dark green foliage
- Floor: blue-grey pavement (#586878 range)
- Walls: dark blue (#384454 range)
- Tall/hedge: dark green (#384e44 range)
- Brick: warm red-brown (#5a3e36 range)
- Asphalt: near-black (#22262e range)
- Ambient: deep blue-black (#080c18)

### Hospital
- Clinical blue-greens, institutional and cold
- Floor: light blue-grey (#9aacb2 range)
- Walls: medium blue-grey (#647880 range)
- Tiles: light cool grey (#a0b4ba range)
- Ambient: dark teal-black (#0c1820)

### Road
- Warmer tones — dawn breaking, first light
- Floor: warm earth/dust (#7a6a4e range)
- Walls: warm brown (#584e40 range)
- Tall: forest green (#4e7050 range)
- Grass: vibrant green (#4a6838 range)
- Ambient: dark indigo (#141428)

### Campsite
- Warmest palette — earth and forest
- Floor: dark earth (#685c42 range)
- Tall: deep forest green (#3a6438 range)
- Bark: dark brown (#4a3820 range)
- Moss: forest green (#3a5e30 range)
- Ambient: dark navy (#0e0e20)

---

## 11. SOUND DESIGN

All audio is Web Audio API synthesised — no audio files.

Required sounds:
- **Footsteps** — different for walk vs creep, floor type
- **Doors** — opening creak
- **Wire sparks** — electrical snap when wire panel fails
- **Zombie shuffle** — dragging feet
- **Zombie alert** — sharp intake / growl when they spot her
- **Close call** — heartbeat + breath
- **Item found** — quiet positive tone
- **Ambient bed** — per-level droning atmosphere that builds tension
- **Horde proximity** — grows louder as more zombies are near
- **Heartbeat** — when being chased
- **Fire crackle** — campfire
- **Static** — TV/radio interference
- **Tuning/radio** — distant radio signal
- **Car engine** — starting, running, dying
- **Horse hooves** — clip-clop rhythm
- **Wind/stream** — campsite ambience
- **Birdsong** — sunrise scene

---

## 12. RENDERING PIPELINE

The paint order (each frame):
1. Ambient fill (level darkness)
2. Far plane / sky / parallax background
3. Map tiles (blit from cached atlas)
4. Actors (player, zombies, Anwar, horse)
5. Foreground occlusion (tiles in front of actors for depth)
6. Interactive things (items, fire, etc.)
7. Atmospheric particles (dust motes, fireflies, shimmer)
8. Fog wisps
9. Near plane (foreground parallax layer)
10. Light map (multiply blend — half-resolution)
11. Colour grade (overlay blend — per-level tint)
12. Vignette
13. Film grain
14. Vision cones (zombie sight visualisation)
15. Noise rings (sound radius visualisation)
16. Door effects
17. Pressure indicator (Level 3)
18. Caught/flash effects

---

## 13. DEPTH SYSTEM

The game needs a proper depth/occlusion system:
- Walls and tall objects have **lit tops**, **darker side faces**, and **cast shadows**
- Objects properly occlude the player — she walks behind pillars and tall furniture
- A **far skyline** scrolls at a fraction of the camera's rate (parallax)
- **Haze** thins the top of the frame
- Dust particles float in light beams
- A **near plane** drifts over everything (atmospheric depth)

---

## 14. GAME FLOW

```
Title Card → How-To Card → 
Level 1 (HOME) → TV Broadcast → Wire Panel → Garage Exit →
Level Card → Level 2 (THE STREETS) → Note → Keypad → Hospital Exit →
Level Card → Level 3 (THE HOSPITAL) → Wire Panel → Find Anwar → Reunion Dialogue → Safe Room →
Level Card → Level 4 (THE ROAD) → Hospital Escape → Find Car → DRIVE CINEMATIC →
  → Roadside → Find Horse → RIDE CINEMATIC →
  → Campsite → Gather Wood → Light Fire → CAMPFIRE DIALOGUE → CAMPFIRE CINEMATIC → SUNRISE CINEMATIC →
Level Card → Level 5 (THE GATES) → Approach → Quarantine Check → Enter Compound →
ROOFTOP SCENE + DIALOGUE →
"TO BE CONTINUED..." Card
```

---

## 15. MOBILE SUPPORT

The game must work on phones:
- Virtual directional pad (bottom-left)
- Two action buttons (bottom-right): one for USE, one for CREEP
- Touch input handling
- The canvas scales to fit the viewport

---

## 16. DEBUG / TEST HOOKS

The game must expose these global functions for headless testing:
- `__apEnter(levelIndex)` — jump to a level
- `__apPump(dt)` — step the game by dt seconds
- `__apPaint()` — force a paint
- `__apTeleport(tx, ty)` — teleport player to tile coordinates
- `__apCampsite()` — jump to campsite submap
- `__apDrive()` — play drive cinematic
- `__apRide()` — play ride cinematic

---

## 17. CRITICAL DESIGN NOTES

1. **The close call is not death.** Getting caught pulls her back to somewhere safe. This is deliberate — the game is about the journey, not punishment.

2. **The dialogue is underplayed.** Neither character makes speeches. A line with no words is a beat of silence and should be held on screen like any other line. Do not rewrite the tone.

3. **The gate code 4180 means something.** It appears on the note in the corner shop and on the locked staff gate. Keep it as-is.

4. **Level 5 has almost no game, on purpose.** It is the quiet after four levels of tension. It should feel like being allowed to sit down.

5. **The campsite has no zombies.** It is the only safe place in the game.

6. **The pressure system is never announced.** The player just notices it getting worse.

7. **The game is a love letter.** Every design decision serves the emotional arc: fear → determination → reunion → escape → safety → intimacy → hope.

---

## 18. SUMMARY OF WHAT TO BUILD

Delete everything. Build a single `apocalypse.js` file that:
1. Renders a 320×180 canvas with a **3D/2.5D visual aesthetic** — buildings with depth, characters with visible form, atmospheric lighting, volumetric effects
2. Contains all 5 levels + 3 submaps with the exact grid maps above
3. Contains all dialogue verbatim as written above
4. Implements stealth gameplay: noise system, vision cones, hiding, close calls
5. Implements all mini-games: wire panel, keypad
6. Implements all cinematic scenes: drive, ride, campfire, sunrise, rooftop
7. Implements the TV broadcast scene
8. Implements the full sound design via Web Audio API
9. Has full mobile support with virtual controls
10. Exposes the debug hooks for testing
11. Uses `Apocalypse.start()` / `Apocalypse.stop()` as its public API

The visual quality should make someone looking at it think "this looks like a real 3D zombie survival game" — not a flat tile game. Use every pixel of that 320×180 canvas to create atmosphere, depth, and immersion.
