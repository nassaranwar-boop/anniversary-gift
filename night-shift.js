/* =========================================================
   WICK & COGS — a night shift at the toy emporium

   An original camera-and-doors survival horror. You are the new night
   guard at Wick & Cogs Toy Emporium, alone from midnight to six, with a
   power meter, two doors, a ceiling hatch and eight cameras between you
   and four wind-up performers that are not supposed to move.

   ---------------------------------------------------------
   HOW THIS IS BUILT, AND WHY

   Three.js, on the copy already bundled in vendor/ for the book intro.
   The racing chapter is NOT Three.js — it is a hand-written Mode 7
   scanline renderer — so there was nothing there to extend. This is a
   clean parallel setup, deliberately kept generic (the texture library,
   the prop kit, the light rig and the contact-shadow helper below are
   all game-agnostic) so that if the racer is ever rebuilt in 3D the
   tooling is already here rather than written twice.

   Four rules were learned the hard way on the racer and are load-bearing
   here. Breaking any of them is a regression:

   1. NOTHING IS A FLAT CUTOUT. Every wall, shelf, cabinet, door and prop
      is a solid with faces the light hits differently. `slab()` and the
      kit builders below never return a single plane. The only planes in
      the whole file are contact shadows and glass, and both are marked.

   2. EVERYTHING IS GROUNDED. `place()` is the only way a prop enters a
      room, and it lays a soft contact shadow under whatever it places.
      If an object is in a room and it is not floating, it went through
      `place()`.

   3. NOTHING IS RECOMPUTED PER FRAME. A room is built once, in its own
      local space, into a Group whose world transform is set once at boot
      and never touched again. The camera moves; the world does not. On
      the racer, props were re-derived from the camera each frame and
      visibly swam. There is no code path here that can do that — the
      frame loop only writes to lights, doors, the cast and the clock.

   4. NOTHING IS STAMPED TWICE. Anything that appears more than once has
      a variant kit (`KIT.shelf` has four, `KIT.cabinet` four, `KIT.chair`
      three, `KIT.crate` three, `KIT.toy` six) and `place()` jitters
      rotation and scale. No two rooms share a builder.

   It carries no files of its own, the same rule Super Ouissy and the
   apocalypse follow: every texture is painted into a canvas at boot and
   every sound is synthesised, so the chapter adds one script and nothing
   else to the repo.
   ========================================================= */
window.OuissysNightShift = (function () {
"use strict";

/* =========================================================
   1. THE WORDS — everything the player reads
   ========================================================= */
const NS = {
  title: "OUISSY’S",
  title2:"NIGHT SHIFT",
  shop:  "WICK & COGS",
  sub:   "TOY EMPORIUM",
  tag:   "est. 1931 · wind-ups, marvels & mechanical friends",
  who:   "OUISSY",

  /* --------------------------------------------------------------
     Nobody talks to her.

     There is no voice on a phone explaining the job and no friend
     checking in between nights. There is one recording, at the very
     start, of a dead man reading a statement into his own shop — and
     after that everything she learns she finds: a card taped inside
     the drawer, a tin of tags, a delivery book, the shop's own log.
     The only other voice in the building is the security system's, and
     that one only ever reports its own state — see ANNUNCIATOR below.
     -------------------------------------------------------------- */

  /* Night one opens on the card that was already on the desk. The
     printed half is the job; the pencil at the bottom is not. */
  shiftCard: {
    title: "taped inside the desk drawer",
    lines: [
      "NIGHT SECURITY — SHIFT CARD",
      "12:00 to 06:00. One charge on the meter for the whole of it.",
      "Both doors close by hand. So does the ceiling hatch.",
      "The monitor shows the shop floor. It draws while it is up.",
      "Do not leave the office.",
    ],
    pencil: "and underneath, in his hand, in pencil — <i>wind the four in the back. do not open the door to anything else. it will not be one of mine.</i>",
  },

  /* Between nights: paper, and one object. Two sentences at a time.
     Nobody explains it and nobody says what it means. */
  beats: {
    2: {
      title: "a tin of tags, tipped out of the workshop drawer",
      lines: [
        "Hundreds of them. Every one reads SOLD, a date, and a family name.",
        "Four of them read NOT FOR SALE. Those four are still wired to something.",
      ],
    },
    3: {
      title: "the delivery book, under the till",
      lines: [
        "Addresses. Some of them crossed out, and the crossing-out is not tidy.",
        "Beside one of them, in his hand: <i>came back on its own. do not sign for it.</i>",
      ],
    },
    4: {
      title: "a note taped inside the workshop cupboard",
      lines: [
        "Stopped taking orders. Told them the workshop was closed.",
        "It has not made the slightest difference to the ones already out.",
      ],
    },
    5: {
      title: "a page torn out and put back in the wrong place",
      lines: [
        "The four in the back are the only ones I did not make to order.",
        "If anything ever comes through that front door that I did not build for her, they will be between it and her before I would have been.",
      ],
    },
    6: {
      title: "the shop’s own log, printed the night he stopped coming in",
      lines: [
        "23:58 — PROPRIETOR ON PREMISES. 04:12 — STATEMENT RECORDED.",
        "04:14 — PROPRIETOR OFF PREMISES. No further entries until she opened the door.",
      ],
    },
  },

  /* --- the opening ---------------------------------------------------
     A machine reading a dead man's statement while the camera walks his
     shop in the dark. The robotic voice is not a limitation dressed up
     as a choice: he recorded this eleven days before he died, into the
     only thing in the building that would still be listening, and what
     she is hearing is a terminal doing its best with a transcript. That
     is why he sounds like that. It is the saddest thing in the chapter
     and it happens before she has pressed a single button.

     Each beat is a camera move through a real room, a line or three of
     his statement, and the caption that lights up word by word as the
     machine gets to it. `room` and `from`/`to` are in that room's own
     space; `secs` is how long the move takes, and the beat runs for as
     long as the lines take or `secs`, whichever is longer.

     Everything he says here is true and none of it is the whole truth.
     He does not tell her the four are hers — he tells her to wind them
     and not to open the door to anything else, which is exactly what a
     man who cannot say the thing would say. She finds that out herself,
     over six nights, which is the only way it would land. ---------- */
  intro: {
    head: "PLAYBACK — PROPRIETOR STATEMENT",
    sub: "recorded eleven days before decease",
    beats: [
      { room: "foyer", secs: 9,
        from: [2.7, 1.62, 3.1], to: [1.5, 1.5, 1.1], look: [-0.5, 1.2, -2.0], fov: 58,
        lines: [
          "Ouissy.",
          "If you are listening to this, the shop is yours, and I am not there to explain it.",
        ] },
      { room: "hall", secs: 11,
        from: [0.05, 2.2, 6.4], to: [0.05, 1.72, 1.8], look: [-0.05, 1.1, -5.2], fov: 62,
        lines: [
          "For fifteen years you asked me how my day had been.",
          "For fifteen years I told you it was fine.",
        ] },
      { room: "workshop", secs: 10,
        from: [-2.6, 1.9, 2.9], to: [-1.1, 1.42, 1.5], look: [0.4, 0.95, -1.7], fov: 56,
        lines: [
          "I made toys. That part was true.",
          "I made them very well. That was the problem.",
        ] },
      { room: "stage", secs: 12,
        from: [0.2, 2.5, 6.2], to: [0.2, 1.9, 2.6], look: [0, 1.3, -2.4], fov: 60,
        lines: [
          "The ones I sold did not stay sold.",
          "They went into other people's houses, and they did what I had asked them to do, and nobody ever knew why.",
        ] },
      { room: "arcade", secs: 11,
        from: [2.1, 2.2, 4.6], to: [1.1, 1.6, 2.2], look: [-0.4, 1.0, -3.0], fov: 58,
        lines: [
          "I was paid a great deal of money for that.",
          "You have been living in it. The house. The car. All of it.",
          "I am sorry.",
        ] },
      { room: "party", secs: 12,
        from: [-3.4, 2.2, 3.6], to: [-1.9, 1.5, 1.4], look: [0.4, 1.0, -1.2], fov: 60,
        lines: [
          "There are four in the back room that I never sold. Cogsworth. Chime. Marabelle. Jax.",
          "They are the only ones I ever made right.",
        ] },
      { room: "office", secs: 13,
        from: [0, 2.0, 4.2], to: [0, 1.66, 2.36], look: [0, 1.0, -2.7], fov: 66,
        lines: [
          "Wind them. Every night, before six.",
          "And whatever else comes to that door — and something will — do not open it.",
          "I am sorry for the money. I am sorrier for the fifteen years.",
        ] },
    ],
    /* the page itself, in his hand, after the machine stops talking */
    note: {
      head: "and folded under the key, in his handwriting",
      lines: [
        "There is a shop. It is yours now.",
        "Wind the four in the back room every night.",
        "Do not open the door to anything else.",
        "I am sorry for what you are about to find out about me.",
      ],
      sign: "— Anwar",
    },
    end: "MIDNIGHT TO SIX. SIX NIGHTS.",
  },

  /* --- the six things hidden in the shop -----------------------------
     One per night, small, somewhere on the eight cameras, catching the
     light about as much as a brass tag catches light. She has to go
     looking, and looking is the thing the cameras were always for.

     They are the whole reason to keep playing. The first four are the
     maker's tags off the four he never sold, and each one says what
     its toy does and then, on the back, why he built it that way —
     and the why is always one thing about her. Her timekeeping. Her
     roof. The dancing she will not do while anyone is looking. The
     fact that she has never walked out of a room. The fifth is the
     ledger and what four hundred of them were sold to do; the sixth
     is him, finally, saying it.

     Which means the four things that have been standing at her door
     all week are a portrait of her, and the tags are also the tutorial:
     read them and you know exactly how each one moves.

     `room` is where it hides, `on` the night it can be found, `kind`
     which small object gets built. Miss one and it stays missed — that
     is what makes her go back in. --------------------------------- */
  finds: [
    {
      id: "cogsworth", on: 1, room: "workshop", kind: "tag",
      where: "wired to an empty plinth on the workshop bench",
      title: "No. 1 — COGSWORTH",
      lines: [
        "NOT FOR SALE. Wound daily. Walks the length of a room and turns at the end of it, and stops for nothing but a shut door.",
      ],
      back: "She has never been late for anything in her life. I built one that keeps better time than she does, so there would be somebody for her to be early with.",
    },
    {
      id: "chime", on: 2, room: "foyer", kind: "tag",
      where: "on the ledge over the front door, where something roosts",
      title: "No. 2 — CHIME",
      lines: [
        "NOT FOR SALE. Goes over the top of everything — doors, walls, the lot. There is no ground floor as far as this one is concerned.",
      ],
      back: "She takes her book up to the roof and stays there until it is dark. I made something that would rather be up there too.",
    },
    {
      id: "marabelle", on: 3, room: "party", kind: "card",
      where: "slipped under the ballerina’s glass",
      title: "No. 3 — MARABELLE",
      lines: [
        "NOT FOR SALE. Do not overwind. Stops dead the moment she is looked at, and will not start again until she is not.",
      ],
      back: "Fifteen years and she has never once danced while I was in the room. She thinks I do not know that she does it at all.",
    },
    {
      id: "jax", on: 4, room: "closet", kind: "tag",
      where: "in the bottom of the jester’s box",
      title: "No. 4 — JAX",
      lines: [
        "NOT FOR SALE. Does not knock politely and does not go away when he is told. Made in an afternoon, badly, and I have never improved him.",
      ],
      back: "She stays. Whatever it is, whoever it is, she stays until it is finished. I wanted one thing in this building that would not leave a door either.",
    },
    {
      id: "ledger", on: 5, room: "party", kind: "letter",
      where: "the ledger, open at the last page anyone wrote on",
      title: "SOLD",
      lines: [
        "Four hundred and eleven of them, out of this shop, into houses with people asleep in them. Every one made to want something on somebody else’s behalf.",
        "I stopped taking orders in the spring. It did not stop the ones already out there, and it will not stop them coming back here, because this is the only address any of them has.",
      ],
      back: "The four in the back are the only things I ever built that wanted something for themselves. Whatever else gets in, it is not mine and it is not hers.",
    },
    {
      id: "last", on: 6, room: "stage", kind: "page",
      where: "left on the lip of the stage, in the one bit of light",
      title: "the last page",
      lines: [
        "I have been sitting here trying to write down what I am, and every version of it is a man asking to be forgiven, so here is the other thing instead.",
        "I made four toys out of my wife. Her timekeeping, her roof, the dancing she does when she thinks nobody can see, and the fact that she has never once walked out of a room I was in.",
        "They have been standing at your door all week trying to get to you. That is the whole of what they are for. I could not say it to your face in fifteen years and I have had to build it out of brass instead.",
      ],
      back: "— Anwar",
    },
  ],

  /* The first time one of his gets there before something else does.
     She is shown this once, and after that it is simply how the shop
     works. Nothing in the how-to mentions it and nothing before it
     hints that it can happen. */
  held: {
    where: "on the west door, with its back to her",
    lines: [
      "The handle stopped turning.",
      "There is something standing in the doorway that she has spent four nights keeping out of it, and it is not looking at her. It is looking at the thing in the corridor, and the thing in the corridor is going back the way it came.",
      "When it is gone he stands there a moment longer, and then walks back to his place in the dark, and stops, run all the way down.",
    ],
    who: "$1 will not do that again until she winds him.",
  },

  /* the one line at the end of a night, in place of a score. It is not
     a summary; it is a door left open. */
  /* =====================================================
     THE TERMS — why she is standing here at all

     The complaint this exists to answer: you start playing and you are
     lost. You survive a night, and another one, and nothing has told
     you why you are doing it. Surviving is a thing that happens TO
     her; it is not a thing she has decided.

     So the shop tells her, in his voice, on the way in. The shutters
     come down and he sets the terms: six nights, all six, and he is
     asking her to get through them without being caught, because he is
     not going to explain any of it to somebody who might not last long
     enough to hear the end.

     That does three things at once. She now has a goal she chose
     rather than a situation she is in. Every night after it is a
     payment against a debt she agreed to. And the last night is not
     "you survived", it is "he kept his word". */
  terms: {
    head: "WICK &amp; COGS — INTERNAL ADDRESS",
    sub: "the shutters come down at midnight, and they lock",
    lines: [
      "Ouissy. Stop. Before you touch anything, listen.",
      "The shutters are down. They will not go up again until six. That is not me being dramatic, it is a timer, and I set it a long time ago.",
      "Six nights. That is what I am asking for. Six, and then everything.",
      "I have left the whole of it in here — on the tapes, on the shelves, in the book under the till. It is all yours. But I am not handing the worst thing I ever did to somebody who might not be here on Saturday.",
      "So get through them. All six. And try very hard not to let anything reach you, because I would like you to hear the end of this from me and not work it out from the mess.",
      "You have been braver than me for fifteen years. One more week.",
    ],
    /* the one button, which is the only choice she has here */
    go: "STAY",
  },
  gave: "he had left it where you would have to trip over it",
  /* he answers a bad night rather than letting the game score it */
  caught: {
    first: "That was my fault. I built the thing that did that. Go again — the tape will keep.",
    later: "Again. I am still here at the end of it.",
  },
  /* and the last night knows whether she kept the terms */
  kept: {
    clean: "Six nights and nothing laid a hand on you. I asked for that because I wanted you to hear it from me, and you have earned every word of it.",
    hurt:  "Six nights. Some of them got to you and I am not going to pretend they did not. You came back anyway, which is the part I would have bet on.",
  },
  /* What tonight is FOR. The card told her which night it was and what
     new thing would go wrong; it never told her what she was there to
     do about it, which is the difference between a level and a scene.
     One line, present tense, always something she can actually finish. */
  why: {
    1: "Learn the shop. Nothing has happened here yet.",
    2: "Find out what the four in the back are, and why he kept them.",
    3: "Four hundred and eleven went out of this door. Find out where.",
    4: "He is about to tell you what they were for. Stay alive to hear it.",
    5: "Keep all four of them wound. He asked you once, and he meant it.",
    6: "Get to six o'clock. Then decide what to do with the key.",
  },
  /* =====================================================
     THE TAPES — the story, told while she is playing it

     The whole chapter's story used to live in the gaps: a film before
     it, a card between nights, a page she might not find. Which leaves
     the thing she actually spends her time doing — five and a half
     minutes alone in an office — with nothing in it but survival. For
     somebody who plays games that is a genre. For somebody who does
     not, it is a long wait between the interesting parts, and she will
     put it down.

     So he talks to her. He left the tapes in the shop the way he left
     the note and the shift card, and the terminal plays them back an
     hour at a time. It is his voice, not the building's — that is what
     the voice was rebuilt for — and it lands in the quiet, never over
     a scare and never over the annunciator.

     Six nights, and each one is a different man talking:

       one    an ordinary husband being practical about a kettle
       two    proud of what he made, and starting to explain it
       three  the first thing he does not want to say out loud
       four   what they were actually for
       five   frightened, and not for himself
       six    sorry, and asking her for something

     Nothing here is a hint and nothing here is a rule. The game already
     teaches itself. These are for the minutes in between, which is
     where a story either has her or does not. */
  tapes: {
    1: [
      { h: 0, t: "One of six. You said yes, so here is the first thing." },
      { h: 0, t: "The kettle is behind the till. It takes a while. Everything in here does." },
      { h: 1, t: "The four in the back are not stock. I never sold those, and tonight that is all you need to know about them." },
      { h: 2, t: "They walk. It is not a fault, I built them to, and by Thursday you will be glad of it." },
      { h: 3, t: "Nothing in this shop wants to hurt you. I want to say that on the first night, while it is still true." },
      { h: 4, t: "Shut the door if one gets close. It costs you a little. It costs you less than the other thing." },
      { h: 5, t: "One down. Go home. Sleep. Come back tonight." },
    ],
    2: [
      { h: 0, t: "You came back. I did not know if you would, and I have been sitting here all day not knowing." },
      { h: 1, t: "The soldier keeps time. He has never once been late, which is a thing I admired in somebody else first." },
      { h: 2, t: "The owl goes through the ceiling because that is how a roof works. It is not being clever." },
      { h: 3, t: "The ballerina stops when she is looked at. Everybody does." },
      { h: 4, t: "And the box. The box does not leave a room while there is anybody in it." },
      { h: 5, t: "I made four toys, Ouissy. I only ever had one idea, and it was you." },
    ],
    3: [
      { h: 0, t: "Halfway. This is the night I have been dreading, so I am going to get it over with." },
      { h: 0, t: "There is a book under the till. I would rather you did not, but you will, and you should." },
      { h: 1, t: "Four hundred and eleven of them went out of here. Every one to a real address." },
      { h: 2, t: "They were bought as presents. That part is true." },
      { h: 3, t: "The tag on each one has this shop on it. So they know the way back." },
      { h: 4, t: "If a parcel arrives that nobody sent, it is not a delivery. Do not open the door for it." },
      { h: 5, t: "I am telling you this badly. I have started this tape four times. Three more nights." },
    ],
    4: [
      { h: 0, t: "All right. The thing I have been walking around." },
      { h: 1, t: "A toy in a house sees the house. Everything in it. Every night, for years." },
      { h: 2, t: "And a toy that goes back to the shop it came from brings all of that with it." },
      { h: 3, t: "That is what I did. Money came into our house and you never asked, and I let you not ask." },
      { h: 4, t: "You are standing in the middle of it now. I am sorry. That is not enough and I know it." },
      { h: 5, t: "The four in the back are the only ones I made for nothing." },
    ],
    5: [
      { h: 0, t: "Five. Tonight is the one I actually needed you to reach." },
      { h: 1, t: "They have started coming back on their own. I did not call them. Nobody called them." },
      { h: 2, t: "Keep the four of them wound tonight. All four. Do not ask me why yet, just do it." },
      { h: 3, t: "And if one of them gets to the door before you do — let it. Do not shut it. Let it." },
      { h: 4, t: "They were never for the shop, Ouissy. They were for you, in case I was not there." },
      { h: 5, t: "I built the whole four of them out of you and I never once said so out loud." },
    ],
    6: [
      { h: 0, t: "Six. Last one. I made this tape in the morning, which I never do." },
      { h: 1, t: "You will have worked out by now what I was. I would like to say I was more than that." },
      { h: 2, t: "I was not. But I was also a man who made four things that will stand at a door for you." },
      { h: 3, t: "The shutters go up at six on their own. Every morning. They always have." },
      { h: 4, t: "When it is light you can lock this place and never come back. That is a real choice and I want you to have it." },
      { h: 5, t: "But if you wind her one more time, she will dance for you. And I would like somebody to see it." },
    ],
  },
  /* and the ones that wait for her to do something rather than for a
     clock, so the shop answers her instead of talking at her */
  tapeWhen: {
    firstDoor:   "That is the sound I built into it. You should be able to hear it from the desk.",
    firstCam:    "The tube takes a moment. It always did.",
    firstWind:   "There. That is all it is. A key and about a second.",
    firstParcel: "That is not one of mine coming down the hall. Shut the door.",
    firstHeld:   "I told you. Let them.",
    lowPower:    "If the meter goes, sit still. Six o'clock has beaten the dark before now.",
  },
  hooks: {
    1: "In the workshop bin there are four hundred tags that read SOLD, and four that do not.",
    2: "One of the addresses in the delivery book has been crossed out very hard.",
    3: "Something tried the front door at half past three. It did not knock.",
    4: "He stopped taking orders in the spring. Nobody told the ones already out.",
    5: "The four of them go back to their places at six. Every morning. On their own.",
  },

  /* the line she gets for a night she cleared without finding the thing
     hidden in it — enough to make her want to go back in */
  missed: "There was something in the shop tonight she did not find.",

  /* Dawn on the last night, and the one thing she gets to decide. */
  ending: {
    ask: "On the counter there is a winding key, and four things standing very still in a shop that is hers now.",
    wind: {
      label: "WIND THEM",
      lines: [
        "She goes out onto the floor in the dark and winds all four of them, the way the note said, for the first time all week.",
        "Nothing happens. Nothing was ever going to happen — they are toys, and it is six in the morning, and the man who made them has been dead for eleven days.",
        "The soldier keeps better time than she does. The owl is up where she would be. The ballerina will not move while she is watching, and the jester in the box has never once left a door.",
        "She stands in the middle of her husband's shop and understands, all at once and far too late, that she has been looking at a portrait of herself for six nights and calling it a haunting.",
        "Then she opens the shutters, because it is morning, and there is a shop to run.",
      ],
    },
    leave: {
      label: "LEAVE THEM",
      lines: [
        "She puts the key down on the counter and leaves it there.",
        "He was a man who could not say a thing out loud in fifteen years, and his answer was to build it out of brass and leave her to work it out on her own, in the dark, at four in the morning, with the doors shut.",
        "That is not nothing. It is also not enough, and she is allowed to know both of those at the same time.",
        "So she lets them wind down, and she takes the last page, and she opens the shutters — and by the time the light gets to the back room the soldier has stopped where he stands, facing the office, the way he has faced it every night this week.",
        "She will wind them tomorrow. She already knows she will. But not because he told her to.",
      ],
    },
  },

  /* Six o'clock on the last night. Dawn, a still shop, and the one
     object that finishes it. */
  finale: {
    title: "6:00 AM",
    lines: [
      "The shutters go up on their own at six. They always have.",
      "Out on the shop floor the four of them are walking back to their places. Not hurrying. The soldier to his plinth, the owl up into the rafters, the ballerina under her glass, the jester folding himself back into his box — and then, one after another, they stop, the way a thing stops when it is finished rather than interrupted.",
      "They have done that every morning this week. She has watched it on a monitor five times without once understanding what she was looking at.",
      "They were never coming for her. They were coming to her, and she has spent six nights getting very good at keeping them out.",
    ],
  },

  /* Six lines, and each one is the whole rule. She should be able to
     skim this once and start, and never need it again. */
  howTo: [
    ["THE JOB", "Midnight to six. About six minutes. Do not leave the chair."],
    ["THE DOORS", "A&nbsp;/&nbsp;D shut the two doors. W shuts the ceiling hatch."],
    ["THE CAMERAS", "SPACE puts the monitor up. 1&ndash;8 pick a room."],
    ["THE POWER", "One charge. Doors and cameras spend it. At zero, the doors stop working."],
    ["THE TRICK", "Shut a door only while something is actually there. Open it again straight after."],
    ["LISTEN", "Which ear a sound comes from is which side it is on. Headphones help."],
  ],

  /* Everything the security system is allowed to say. It reports and it
     stops. It never reassures, never explains, never uses her name and
     never mentions the performers by anything but a sensor reading. The
     line between a system and a guide character is exactly here. */
  sys: {
    boot:      "SYSTEM ONLINE. NIGHT MODE.",
    hour:      "HOUR $1.",
    pwr25:     "RESERVE AT TWENTY FIVE PERCENT.",
    pwr10:     "RESERVE AT TEN PERCENT.",
    pwrOut:    "RESERVE DEPLETED. DOOR CONTROL OFFLINE.",
    doorShut:  "DOOR $1: CLOSED.",
    doorOpen:  "DOOR $1: OPEN.",
    hatchShut: "VENT HATCH: SEALED.",
    hatchOpen: "VENT HATCH: OPEN.",
    motion:    "MOTION: $1.",
    camLost:   "CAMERA $1: SIGNAL LOST.",
    camBack:   "CAMERA $1: RESTORED.",
    surge:     "LOAD SPIKE ON THE MAIN BUS.",
    lampFail:  "OFFICE LIGHTING: FAULT.",
    doorFault: "DOOR TWO: ACTUATOR DEGRADED.",
    monFault:  "MONITOR FEED: INTERRUPTED.",
    unknown:    "UNREGISTERED UNIT AT $1.",
    held:       "$1: HELD.",
    wound:      "$1: WOUND.",
    slack:      "$1: RUN DOWN.",
    six:       "SIX HUNDRED HOURS. SHIFT ENDS.",
    cozy:      "SAFETY LIMITS ENGAGED.",
  },

  ratings: [
    { key:"flawless", name:"FLAWLESS NIGHT", note:"never once out of hand" },
    { key:"steady",   name:"STEADY",         note:"you had it the whole way" },
    { key:"rattled",  name:"RATTLED",        note:"it got close, twice" },
    { key:"skin",     name:"BY THE SKIN OF IT", note:"do not do that again" },
  ],

  badges: [
    { id:"first",   name:"FIRST LIGHT",      note:"finish a night" },
    { id:"story",   name:"CLOSING TIME",     note:"finish every night" },
    { id:"onepc",   name:"ON THE FUMES",     note:"reach six with one percent left" },
    { id:"nodoor",  name:"HANDS OFF",        note:"clear a night without shutting a door" },
    { id:"nocam",   name:"EYES SHUT",        note:"clear a night with under twenty seconds of camera" },
    { id:"arcade",  name:"OUT OF ORDER",     note:"find whatever is still running in the arcade" },
    { id:"kept",    name:"ALL FOUR",         note:"reach six with every one of them still wound" },
    { id:"held",    name:"NOT ALONE",        note:"have one of his get to the door before you did" },
  ],
};
/* =========================================================
   2. TUNING — how the night feels

   Almost every complaint about a game like this is one of these
   numbers. They are all here, in one block, on purpose.
   ========================================================= */
const TUNE = {
  hourSeconds:  56,     // real seconds per in-game hour (6 hours ≈ 5:36)

  /* These are a budget, and the budget is the game.

     A night is 6 x hourSeconds = 336 seconds. Sitting there doing
     absolutely nothing spends idle x 336 = about 23% of the meter, so
     three quarters of it is yours to spend on knowing things and on
     being safe. The budget is set against night six, not night one: an
     attentive shift on the last night — four of them awake, a door shut
     only while something is actually at it — lands around 91% used, so
     it comes down to the last ten percent and it is meant to. The same
     care on night one leaves nearly a third of the meter in hand. A
     wasteful shift is dark by four on any of them. Jax is the one that
     breaks a careless budget: every knock is charged, and he does not
     knock politely. */
  power: {
    start:      100,
    idle:       0.064,  // %/s just sitting there            -> ~21%/night
    camera:     0.185,  // %/s extra while the monitor is up
    door:       0.145,  // %/s extra per closed door
    hatch:      0.15,   // %/s extra while the hatch is latched
    jaxDoor:    0.26,   // Jax leaning on a shut door costs this much more
    knock:      0.50,   // and each of his knocks takes this off outright
    surge:      2.2,    // a load spike off the meter, from night four
    warn:       25,     // the meter starts complaining here
    critical:   10,
  },

  /* the blackout. Not a game over — a held breath. The less power you
     wasted, the shorter it is, because the shift is nearly done. */
  blackout: {
    graceMin:   14,     // seconds of dark before anything can reach you
    graceMax:   26,
    approach:   9,      // seconds from the music starting to the end of it
  },

  cast: {
    /* seconds between movement rolls, and the chance each roll lands.
       Both are scaled per night and per hour by NIGHTS below.

       `doorGrace` is the reaction window once it is at your door, and it
       is read by name — the owl's used to be called `hatchGrace`, which
       meant its timer was undefined, which meant NaN, which meant it
       could neither reach you nor ever go away again.

       `back` is how far down its own route being shut out sends it, and
       `retreat` is how long it sulks there. Both used to be small, and
       the effect was that everything was back at your door inside half a
       minute — which is not tension, it is a metronome, and it spent the
       whole meter before four o'clock however well you played. */
    cogsworth: { step: 5.0, chance: 0.30, doorGrace: 4.2, retreat: 6.0, back: 3 },
    chime:     { step: 6.5, chance: 0.26, doorGrace: 5.0, retreat: 7.0, back: 3 },
    marabelle: { step: 4.4, chance: 0.34, doorGrace: 4.6, retreat: 5.0, back: 3 },
    /* Jax goes further back and stays away longer than the rest. He
       has to: he is the only one who costs power while you are doing
       the right thing, so how often he comes back is the size of that
       tax, and on the last night it should be about a fifth of the
       meter — enough to hurt, not enough to decide the night on its
       own. */
    jax:       { step: 3.8, chance: 0.34, doorGrace: 3.4, retreat: 10.0, back: 4 },
  },

  /* how loud a cue is at each distance from the office, in rooms */
  cueGain: [0.9, 0.55, 0.3, 0.16],

  /* Which way a sound comes from. Cogsworth is always the hall side,
     Marabelle and Jax the party side, the owl is overhead — so the pan
     is a property of the door it attacks from, and it holds all the way
     down the route. On headphones this is most of the information. */
  pan: { left: -0.72, right: 0.72, hatch: 0 },

  /* --- the things that are not a threat -----------------------------
     A shut building makes noises. Some of them are nothing, and knowing
     that does not help, because you still have to look. False alarms
     are what keeps the quiet from becoming safe — but they are never
     one of the four voices, so a player who listens properly is never
     punished for reading them right.

     These used to start up to a minute and a half in, and night one's
     opening hour measured fifty-six seconds with nothing in it at all
     — no arrival, no alarm, nothing moved. The first minute of the
     first thing she plays cannot be an empty room. */
  alarm: {
    firstAt:  [12, 26],   // seconds into the night before the first one
    every:    [26, 58],   // and the gap after that
    perHour:  0.14,       // ...shortening as the night goes on
  },

  /* --- the shop not staying still -----------------------------------
     A toy that is not where it was. Never on a camera she is currently
     looking at — it has to happen behind her back or it is a magic
     trick rather than a fright. */
  shift: {
    firstAt: [18, 38],
    every:   [40, 85],
  },

  /* --- the building getting worse ------------------------------------
     Fog closes in, the ambient drops and the bulb goes more often as
     the clock runs. By five it is a different room. */
  decay: {
    fogNear:  -0.34,      // fraction of the room's near plane, per hour
    fogFar:   -0.07,
    ambient:  -0.055,
    flicker:   0.10,      // added chance the office bulb drops out
    static:    0.055,     // added camera noise
  },

  /* Cozy mode. The same shop and the same story with the edges taken
     off: they move slower, they wait longer at the door, the meter is
     kinder and a jumpscare is a short soft thing rather than a hard one.
     It is not easy mode for people who are bad at it — it is for a night
     she wants the place without the fright. */
  cozy: {
    aggression: 0.62,
    doorGrace:  1.65,
    power:      0.68,
    alarms:     0.35,
    decay:      0.4,
    scare:      0.42,
  },
};

/* =========================================================
   3. THE NIGHTS

   Six of them, and every one changes a rule rather than a number. A
   night that is only the last night played faster is how this genre
   goes stale, so none of these is that: one takes a camera away for
   good, one puts the hall lights out so the soldier has to be tracked
   by ear, one starts pulling spikes off the meter, one lets the office
   bulb fail on its own, one lets a door actuator go, and the last one
   drops the monitor feed in the middle of a look.

   `ramp` is the aggression multiplier for each of the six hours.
   Adding a seventh night is adding an entry; nothing counts them.
   ========================================================= */
const HAZARDS = {
  deadWorkshop: "Camera eight has been dead since last night.",
  signalLoss:   "The feeds drop out, one at a time, and come back on their own.",
  hallDark:     "The hall lights are gone. He is still in there.",
  surges:       "The main bus spikes. It takes what it takes.",
  officeDark:   "The office bulb has started going out by itself.",
  stickyDoor:   "The right-hand actuator is going. That door is slow now, and expensive.",
  monitorDrop:  "The monitor cuts out mid-look. It comes back.",
};

const NIGHTS = [
  {
    n: 1,
    name: "NIGHT ONE",
    blurb: "Nothing has ever happened here.",
    power: 100,
    /* who is awake, and from which hour (0 = midnight) */
    active: { cogsworth: 0, marabelle: 2, jax: 4 },
    ramp: [0.80, 0.92, 1.02, 1.12, 1.22, 1.34],
    hazards: [],
  },
  {
    n: 2,
    name: "NIGHT TWO",
    blurb: "Something in the ducts has started keeping time with you.",
    power: 100,
    active: { cogsworth: 0, chime: 0, marabelle: 1, jax: 2 },
    ramp: [0.90, 1.00, 1.10, 1.22, 1.36, 1.50],
    hazards: ["deadWorkshop"],
  },
  {
    n: 3,
    name: "NIGHT THREE",
    blurb: "The hall light has been going since ten. Nobody is coming to fix it.",
    power: 100,
    active: { cogsworth: 0, chime: 0, marabelle: 0, jax: 0 },
    ramp: [0.9, 1.0, 1.1, 1.25, 1.4, 1.55],
    hazards: ["deadWorkshop", "signalLoss", "hallDark"],
  },
  {
    n: 4,
    name: "NIGHT FOUR",
    blurb: "The meter has started losing chunks of itself to nothing at all.",
    power: 100,
    active: { cogsworth: 0, chime: 0, marabelle: 0, jax: 0 },
    ramp: [1.0, 1.1, 1.2, 1.35, 1.5, 1.62],
    hazards: ["deadWorkshop", "signalLoss", "hallDark", "surges", "officeDark"],
  },
  {
    n: 5,
    name: "NIGHT FIVE",
    blurb: "The right-hand door takes its time now. So does everything else.",
    power: 100,
    active: { cogsworth: 0, chime: 0, marabelle: 0, jax: 0 },
    ramp: [1.05, 1.2, 1.3, 1.45, 1.55, 1.7],
    hazards: ["deadWorkshop", "signalLoss", "hallDark", "surges", "officeDark", "stickyDoor"],
  },
  {
    n: 6,
    name: "NIGHT SIX",
    blurb: "Last one. The shop knows it too.",
    power: 100,
    active: { cogsworth: 0, chime: 0, marabelle: 0, jax: 0 },
    ramp: [1.1, 1.25, 1.35, 1.5, 1.62, 1.75],
    hazards: ["deadWorkshop", "signalLoss", "hallDark", "surges", "officeDark", "stickyDoor", "monitorDrop"],
  },
];

/* =========================================================
   4. THE SHOP — rooms, and how they join up

   `id` is the key everywhere. `cam` is the number on the monitor;
   the office has none because it is where you are sitting. `to` is
   the floor graph the walkers use; `duct` is the separate network
   above the ceiling that only the owl can use.
   ========================================================= */
const ROOMS = [
  { id:"office",   cam:0, name:"SECURITY OFFICE", to:["hall","party"], duct:["ducts"] },
  { id:"hall",     cam:1, name:"MAIN HALL",       to:["foyer","stage","arcade","office"], duct:[] },
  { id:"stage",    cam:2, name:"SHOW STAGE",      to:["hall","workshop"], duct:["ducts"] },
  { id:"arcade",   cam:3, name:"ARCADE ROW",      to:["hall","party"], duct:[] },
  { id:"party",    cam:4, name:"PARTY ROOM",      to:["arcade","closet","office"], duct:["ducts"] },
  { id:"foyer",    cam:5, name:"FRONT FOYER",     to:["hall"], duct:[] },
  { id:"closet",   cam:6, name:"SUPPLY CLOSET",   to:["party"], duct:["ducts"] },
  { id:"ducts",    cam:7, name:"DUCT JUNCTION",   to:[], duct:["stage","closet","party","office"] },
  { id:"workshop", cam:8, name:"REPAIR WORKSHOP", to:["stage"], duct:["ducts"] },
];
const ROOM = {};
ROOMS.forEach((r) => { ROOM[r.id] = r; });

/* the order the monitor lays them out in, as a little floor plan */
const MAP_PLAN = [
  { id:"workshop", x: 8,  y: 8,  w:22, h:20 },
  { id:"stage",    x:34,  y: 6,  w:30, h:24 },
  { id:"foyer",    x:68,  y: 8,  w:24, h:22 },
  { id:"hall",     x:20,  y:36,  w:60, h:14 },
  { id:"arcade",   x:12,  y:56,  w:26, h:22 },
  { id:"party",    x:42,  y:56,  w:26, h:22 },
  { id:"closet",   x:72,  y:56,  w:18, h:16 },
  { id:"ducts",    x:72,  y:76,  w:18, h:16 },
];

/* =========================================================
   5. THE CAST

   `route` is the floor path each one walks toward the office, as
   [room, mark] pairs. The last entry is the doorway it attacks from:
   "left" is the hall side, "right" is the party side, "hatch" is the
   ceiling.
   ========================================================= */
const CAST = [
  {
    id:"cogsworth", name:"COGSWORTH",
    what:"clockwork tin soldier",
    threat:"Walks to your left door. Shut it, wait, he goes.",
    tell:"You hear him marching. When the marching stops, he is there.",
    colour:"#c8564a",
    home:"stage",
    route:[["stage","s0"], ["stage","s1"], ["hall","far"], ["hall","mid"], ["hall","near"], ["office","leftDoor"]],
    door:"left",
  },
  {
    id:"chime", name:"CHIME",
    what:"clockwork owl",
    threat:"Comes through the ceiling. Doors do nothing. Latch the hatch.",
    tell:"Wings, above you. Check the ducts on camera 07.",
    colour:"#8ea9c6",
    home:"workshop",
    route:[["workshop","s0"], ["workshop","s1"], ["ducts","s0"], ["ducts","s1"], ["ducts","s2"], ["office","hatch"]],
    door:"hatch",
    usesDuct:true,
  },
  {
    id:"marabelle", name:"MARABELLE",
    what:"porcelain music-box ballerina",
    threat:"Frozen while she is on camera. Moves the moment you look away.",
    tell:"A music box, getting louder. Put a camera on her.",
    colour:"#e6b7cd",
    home:"party",
    route:[["party","s0"], ["party","s1"], ["party","s2"], ["office","rightDoor"]],
    door:"right",
  },
  {
    id:"jax", name:"JAX",
    what:"jack-in-the-box jester",
    threat:"A shut door does not send him away. He knocks, and knocks cost power.",
    tell:"Laughing, and little bells. Hold the door and eat the cost.",
    colour:"#b46fd0",
    home:"closet",
    route:[["closet","s0"], ["closet","s1"], ["arcade","s0"], ["party","s1"], ["party","s2"], ["office","rightDoor"]],
    door:"right",
  },
];
const BY_ID = {};
CAST.forEach((c) => { BY_ID[c.id] = c; });

/* =========================================================
   6. SMALL MATHS

   One seeded generator drives every texture and every scatter of
   props, so the shop is identical every time it is built — which
   matters, because "the crate moved" should only ever be true of a
   thing that is supposed to move.
   ========================================================= */
const T = window.THREE;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rngFor(name) { return mulberry(seedOf(name)); }

const clamp  = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp   = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
function pick(rnd, arr) { return arr[(rnd() * arr.length) | 0]; }
function range(rnd, a, b) { return a + rnd() * (b - a); }

/* colour, in the two forms the file needs: css strings for the canvas
   textures, and THREE.Color for the materials */
function shadeHex(hex, f) {
  const v = parseInt(hex.slice(1), 16);
  let r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
function rgba(hex, a) {
  const v = parseInt(hex.slice(1), 16);
  return "rgba(" + ((v >> 16) & 255) + "," + ((v >> 8) & 255) + "," + (v & 255) + "," + a + ")";
}

/* =========================================================
   7. THE TEXTURE LIBRARY

   Every surface in the shop is painted here, at boot, into a canvas.
   There is not one flat single-colour material in the game — this is
   what stops a wall reading as a coloured rectangle, and it is cheap:
   nine 256px canvases, drawn once, uploaded once.

   Each painter takes a seeded rng so two walls of "the same" plaster
   are never actually the same wall.
   ========================================================= */
const TX = {};                       // name -> THREE.Texture
const texCache = {};

function canvas(size) {
  const c = document.createElement("canvas");
  c.width = c.height = size || 256;
  return c;
}

/* the grain pass every painter finishes with: fine speckle plus a few
   broad blotches, so a surface never reads as uniform even in the dark */
function grain(g, w, h, rnd, amount, blotch) {
  const n = (w * h) / 26;
  g.save();
  for (let i = 0; i < n; i++) {
    const v = rnd();
    g.fillStyle = v > 0.5 ? "rgba(255,255,255," + (amount * rnd()) + ")"
                          : "rgba(0,0,0," + (amount * 1.3 * rnd()) + ")";
    g.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 1 + ((rnd() * 1.6) | 0), 1);
  }
  if (blotch !== 0) {
    for (let i = 0; i < 14; i++) {
      const x = rnd() * w, y = rnd() * h, r = range(rnd, w * 0.06, w * 0.24);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const dark = rnd() > 0.45;
      gr.addColorStop(0, dark ? "rgba(0,0,0,.09)" : "rgba(255,255,255,.055)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  }
  g.restore();
}

/* --- planks, with grain that follows the board and knots in it --- */
function paintWood(g, S, rnd, base, opts) {
  opts = opts || {};
  const boards = opts.boards || 6;
  const bh = S / boards;
  for (let i = 0; i < boards; i++) {
    const tint = shadeHex(base, range(rnd, -0.13, 0.11));
    g.fillStyle = tint;
    g.fillRect(0, i * bh, S, bh);
    /* grain: long shallow arcs down the length of the board */
    for (let k = 0; k < 26; k++) {
      const y = i * bh + range(rnd, 1, bh - 1);
      g.strokeStyle = rgba(rnd() > 0.5 ? "#000000" : "#ffffff", range(rnd, 0.03, 0.10));
      g.lineWidth = range(rnd, 0.5, 1.5);
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= S; x += S / 8) g.lineTo(x, y + Math.sin((x / S) * 6 + k) * range(rnd, 0.4, 2.2));
      g.stroke();
    }
    /* a knot or two */
    if (rnd() > 0.55) {
      const kx = rnd() * S, ky = i * bh + bh * 0.5;
      for (let r = bh * 0.34; r > 0.6; r -= 1.4) {
        g.strokeStyle = rgba("#2a1a10", range(rnd, 0.08, 0.2));
        g.lineWidth = 1;
        g.beginPath(); g.ellipse(kx, ky, r, r * 0.55, range(rnd, -0.4, 0.4), 0, TAU); g.stroke();
      }
    }
    /* the shadowed seam between boards, and the lit edge under it */
    g.fillStyle = "rgba(0,0,0,.34)"; g.fillRect(0, i * bh, S, 1.4);
    g.fillStyle = "rgba(255,255,255,.07)"; g.fillRect(0, i * bh + 1.6, S, 1);
  }
  grain(g, S, S, rnd, 0.05);
}

/* --- lino tile: a grid, worn through at the corners --- */
function paintTile(g, S, rnd, a, b) {
  const n = 4, t = S / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const base = (x + y) % 2 ? a : b;
    g.fillStyle = shadeHex(base, range(rnd, -0.09, 0.07));
    g.fillRect(x * t, y * t, t, t);
    /* the speckled fleck lino actually has */
    for (let i = 0; i < 90; i++) {
      g.fillStyle = rgba(rnd() > 0.5 ? "#ffffff" : "#000000", range(rnd, 0.03, 0.13));
      g.fillRect(x * t + rnd() * t, y * t + rnd() * t, 1 + ((rnd() * 2) | 0), 1);
    }
    /* worn patch, off centre */
    if (rnd() > 0.5) {
      const cx = x * t + range(rnd, t * 0.2, t * 0.8), cy = y * t + range(rnd, t * 0.2, t * 0.8);
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, t * 0.45);
      gr.addColorStop(0, "rgba(255,255,255,.10)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, t * 0.45, 0, TAU); g.fill();
    }
  }
  /* grout */
  g.strokeStyle = "rgba(0,0,0,.42)"; g.lineWidth = 1.6;
  for (let i = 0; i <= n; i++) {
    g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, S); g.stroke();
    g.beginPath(); g.moveTo(0, i * t); g.lineTo(S, i * t); g.stroke();
  }
  /* scuff marks — long, shallow, going one way */
  for (let i = 0; i < 22; i++) {
    g.strokeStyle = rgba("#1a1410", range(rnd, 0.04, 0.14));
    g.lineWidth = range(rnd, 1, 3.5);
    const x = rnd() * S, y = rnd() * S, l = range(rnd, 8, 40), an = range(rnd, -0.5, 0.5);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); g.stroke();
  }
  grain(g, S, S, rnd, 0.04);
}

/* --- painted plaster, with a dado rail's worth of wear --- */
function paintPlaster(g, S, rnd, base) {
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  /* trowel sweep — kept faint and small, because at any size the eye
     reads a big soft ellipse on a wall as wood grain, not as plaster */
  for (let i = 0; i < 130; i++) {
    const x = rnd() * S, y = rnd() * S, r = range(rnd, 3, 11);
    g.fillStyle = rgba(rnd() > 0.5 ? "#ffffff" : "#000000", range(rnd, 0.008, 0.022));
    g.beginPath(); g.ellipse(x, y, r, r * range(rnd, 0.4, 0.9), range(rnd, 0, Math.PI), 0, TAU); g.fill();
  }
  /* the fine orange-peel stipple a roller leaves */
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,.035)" : "rgba(0,0,0,.045)";
    g.fillRect((rnd() * S) | 0, (rnd() * S) | 0, 1, 1);
  }
  /* chips where the paint has gone, showing something older underneath */
  for (let i = 0; i < 16; i++) {
    const x = rnd() * S, y = rnd() * S, r = range(rnd, 1.5, 5);
    g.fillStyle = rgba("#6b5744", range(rnd, 0.25, 0.6));
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      const an = (k / 6) * TAU;
      g.lineTo(x + Math.cos(an) * r * range(rnd, 0.5, 1.4), y + Math.sin(an) * r * range(rnd, 0.5, 1.4));
    }
    g.closePath(); g.fill();
  }
  /* hairline cracks */
  for (let i = 0; i < 3; i++) {
    g.strokeStyle = "rgba(0,0,0,.22)"; g.lineWidth = 0.8;
    let x = rnd() * S, y = rnd() * S;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 9; k++) { x += range(rnd, -14, 14); y += range(rnd, 4, 16); g.lineTo(x, y); }
    g.stroke();
  }
  grain(g, S, S, rnd, 0.045, 0);
}

/* --- the party room's paper: faded stripes and a small repeat motif --- */
function paintPaper(g, S, rnd, a, b, dot) {
  g.fillStyle = a; g.fillRect(0, 0, S, S);
  const w = S / 8;
  for (let i = 0; i < 8; i += 2) {
    g.fillStyle = shadeHex(b, range(rnd, -0.06, 0.06));
    g.fillRect(i * w, 0, w, S);
  }
  /* the motif: a little wind-up key, drawn not stamped */
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const cx = x * (S / 4) + S / 8 + range(rnd, -2, 2);
    const cy = y * (S / 4) + S / 8 + range(rnd, -2, 2);
    g.save(); g.translate(cx, cy); g.rotate(range(rnd, -0.3, 0.3));
    g.strokeStyle = rgba(dot, 0.5); g.lineWidth = 2;
    g.beginPath(); g.arc(-3, 0, 3.4, 0.6, TAU - 0.6); g.stroke();
    g.beginPath(); g.arc(3, 0, 3.4, Math.PI + 0.6, Math.PI - 0.6); g.stroke();
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 9); g.stroke();
    g.restore();
  }
  /* damp, coming up from one edge */
  const gr = g.createLinearGradient(0, S, 0, S * 0.55);
  gr.addColorStop(0, "rgba(120,96,64,.30)"); gr.addColorStop(1, "rgba(120,96,64,0)");
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  /* a seam where two drops of paper meet */
  g.fillStyle = "rgba(0,0,0,.14)"; g.fillRect(S - 2, 0, 2, S);
  grain(g, S, S, rnd, 0.04);
}

/* --- brick, English bond, mortar sunk between --- */
function paintBrick(g, S, rnd, base) {
  g.fillStyle = "#4a4038"; g.fillRect(0, 0, S, S);
  const rows = 8, bh = S / rows, bw = S / 4;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw / 2);
    for (let c = -1; c < 5; c++) {
      const x = c * bw + off + 2, y = r * bh + 2, w = bw - 4, h = bh - 4;
      g.fillStyle = shadeHex(base, range(rnd, -0.2, 0.14));
      g.fillRect(x, y, w, h);
      g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(x, y, w, 1.4);
      g.fillStyle = "rgba(0,0,0,.20)"; g.fillRect(x, y + h - 1.6, w, 1.6);
      for (let i = 0; i < 24; i++) {
        g.fillStyle = rgba(rnd() > 0.5 ? "#ffffff" : "#000000", range(rnd, 0.02, 0.09));
        g.fillRect(x + rnd() * w, y + rnd() * h, 1, 1);
      }
    }
  }
  grain(g, S, S, rnd, 0.05);
}

/* --- galvanised duct panel: ribs, rivets, and old dust --- */
function paintMetal(g, S, rnd, base) {
  const gr = g.createLinearGradient(0, 0, S, S);
  gr.addColorStop(0, shadeHex(base, 0.10));
  gr.addColorStop(0.5, base);
  gr.addColorStop(1, shadeHex(base, -0.16));
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  /* the spangle galvanised steel has */
  for (let i = 0; i < 60; i++) {
    const x = rnd() * S, y = rnd() * S, r = range(rnd, 5, 20);
    g.fillStyle = rgba(rnd() > 0.5 ? "#ffffff" : "#404850", range(rnd, 0.02, 0.07));
    g.beginPath();
    g.moveTo(x, y - r);
    for (let k = 1; k < 6; k++) g.lineTo(x + Math.cos(k * 1.25) * r * range(rnd, 0.5, 1), y + Math.sin(k * 1.25) * r * range(rnd, 0.5, 1));
    g.closePath(); g.fill();
  }
  /* stiffening ribs */
  for (let i = 0; i < 4; i++) {
    const x = i * (S / 4) + S / 8;
    g.fillStyle = "rgba(0,0,0,.24)"; g.fillRect(x - 3, 0, 6, S);
    g.fillStyle = "rgba(255,255,255,.13)"; g.fillRect(x - 1, 0, 2, S);
  }
  /* rivets down the seams */
  for (let y = 6; y < S; y += 18) {
    for (const x of [4, S - 6]) {
      g.fillStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fill();
      g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.arc(x + 0.6, y + 0.8, 1.6, 0, TAU); g.fill();
    }
  }
  grain(g, S, S, rnd, 0.05);
}

/* --- carpet: loop pile, a border, and the tracks people wear in it --- */
function paintCarpet(g, S, rnd, base, fleck) {
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 5200; i++) {
    const c = rnd();
    g.fillStyle = c > 0.86 ? rgba(fleck, range(rnd, 0.3, 0.7))
               : c > 0.5  ? "rgba(255,255,255,.045)" : "rgba(0,0,0,.06)";
    g.fillRect((rnd() * S) | 0, (rnd() * S) | 0, 1, 1 + ((rnd() * 1.5) | 0));
  }
  grain(g, S, S, rnd, 0.03);
}

/* --- velvet: vertical folds, deep in the trough, bright on the ridge --- */
function paintVelvet(g, S, rnd, base) {
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  const folds = 7;
  for (let i = 0; i < folds; i++) {
    const x = (i / folds) * S + range(rnd, -4, 4), w = S / folds;
    const gr = g.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, "rgba(0,0,0,.45)");
    gr.addColorStop(0.42, "rgba(255,255,255,.14)");
    gr.addColorStop(0.6, "rgba(255,255,255,.05)");
    gr.addColorStop(1, "rgba(0,0,0,.4)");
    g.fillStyle = gr; g.fillRect(x, 0, w, S);
  }
  for (let i = 0; i < 2400; i++) {
    g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.05)";
    g.fillRect((rnd() * S) | 0, (rnd() * S) | 0, 1, 1);
  }
  grain(g, S, S, rnd, 0.03, 0);
}

/* --- painted metal for cabinets and lockers: flat coat, chipped --- */
function paintEnamel(g, S, rnd, base) {
  const gr = g.createLinearGradient(0, 0, 0, S);
  gr.addColorStop(0, shadeHex(base, 0.13));
  gr.addColorStop(0.55, base);
  gr.addColorStop(1, shadeHex(base, -0.18));
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 30; i++) {
    const x = rnd() * S, y = rnd() * S, r = range(rnd, 1, 4);
    g.fillStyle = rgba("#7d6a55", range(rnd, 0.3, 0.7));
    g.beginPath(); g.ellipse(x, y, r, r * range(rnd, 0.4, 1), rnd() * Math.PI, 0, TAU); g.fill();
    g.fillStyle = "rgba(255,255,255,.16)";
    g.beginPath(); g.ellipse(x - 0.6, y - 0.6, r * 0.5, r * 0.3, 0, 0, TAU); g.fill();
  }
  for (let i = 0; i < 10; i++) {
    g.strokeStyle = rgba("#ffffff", range(rnd, 0.03, 0.09));
    g.lineWidth = range(rnd, 0.6, 1.6);
    const y = rnd() * S; g.beginPath(); g.moveTo(0, y); g.lineTo(S, y + range(rnd, -3, 3)); g.stroke();
  }
  grain(g, S, S, rnd, 0.04);
}

/* --- concrete: poured, stained, trowel-swept --- */
function paintConcrete(g, S, rnd, base) {
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 150; i++) {
    const x = rnd() * S, y = rnd() * S, r = range(rnd, 8, 40);
    g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.04)";
    g.beginPath(); g.ellipse(x, y, r, r * range(rnd, 0.2, 0.6), range(rnd, 0, Math.PI), 0, TAU); g.fill();
  }
  for (let i = 0; i < 400; i++) {
    g.fillStyle = rgba("#8b8378", range(rnd, 0.1, 0.4));
    g.beginPath(); g.arc(rnd() * S, rnd() * S, range(rnd, 0.5, 1.8), 0, TAU); g.fill();
  }
  /* expansion joint */
  g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(0, S * 0.5 - 1, S, 2);
  grain(g, S, S, rnd, 0.05);
}

/* --- what is outside the office window ----------------------------
   Painted rather than modelled: the alley behind the shop, a wall
   opposite with two windows still on in it, and a moon that is mostly
   cloud. It is the only cold light in the room and it wants to read as
   somewhere else, not as a blue rectangle. */
function paintNight(g, S, rnd) {
  const sky = g.createLinearGradient(0, 0, 0, S);
  sky.addColorStop(0, "#2c405f");
  sky.addColorStop(0.45, "#38507a");
  sky.addColorStop(1, "#1a2740");
  g.fillStyle = sky; g.fillRect(0, 0, S, S);
  /* the moon, behind cloud */
  const mx = S * 0.68, my = S * 0.22;
  const mg = g.createRadialGradient(mx, my, 0, mx, my, S * 0.3);
  mg.addColorStop(0, "rgba(206,220,246,.75)");
  mg.addColorStop(0.16, "rgba(150,170,206,.28)");
  mg.addColorStop(1, "rgba(120,140,180,0)");
  g.fillStyle = mg; g.fillRect(0, 0, S, S);
  g.fillStyle = "rgba(238,244,255,.94)";
  g.beginPath(); g.arc(mx, my, S * 0.06, 0, TAU); g.fill();
  for (let i = 0; i < 5; i++) {
    g.fillStyle = "rgba(22,32,52,.5)";
    g.beginPath();
    g.ellipse(range(rnd, 0, S), range(rnd, S * 0.05, S * 0.4), range(rnd, S * 0.15, S * 0.4), range(rnd, S * 0.03, S * 0.07), 0, 0, TAU);
    g.fill();
  }
  /* the wall opposite, with a gutter and two windows still lit */
  g.fillStyle = "#131c2a";
  g.fillRect(0, S * 0.52, S, S * 0.48);
  g.fillStyle = "#182234";
  g.fillRect(0, S * 0.5, S, S * 0.04);
  for (const w of [[0.14, 0.6, "#c8a45c"], [0.62, 0.66, "#5e7a9a"]]) {
    g.fillStyle = w[2];
    g.globalAlpha = 0.55;
    g.fillRect(S * w[0], S * w[1], S * 0.11, S * 0.14);
    g.globalAlpha = 1;
    g.fillStyle = "rgba(10,14,20,.9)";
    g.fillRect(S * w[0] + S * 0.052, S * w[1], S * 0.006, S * 0.14);
    g.fillRect(S * w[0], S * w[1] + S * 0.066, S * 0.11, S * 0.006);
  }
  const dp = new Array(6).fill(0).map(() => range(rnd, 0.05, 0.95));
  dp.forEach((x) => { g.fillStyle = "rgba(6,9,14,.8)"; g.fillRect(S * x, S * 0.52, S * 0.02, S * 0.48); });
  /* rain on the glass */
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = "rgba(190,206,232," + range(rnd, 0.04, 0.13) + ")";
    g.lineWidth = range(rnd, 0.6, 1.4);
    const x = rnd() * S, y = rnd() * S, l = range(rnd, 4, 18);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + l * 0.18, y + l); g.stroke();
  }
  grain(g, S, S, rnd, 0.03, 0);
}

/* --- what the desk monitor is showing when it is not showing a room --
   Painted, not a flat fill: a phosphor wash, the shop's own mark, the
   scan lines and the roll bar you get out of a set this old. */
function paintCRT(g, S, rnd) {
  const bg = g.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.72);
  bg.addColorStop(0, "#1d4a55");
  bg.addColorStop(0.6, "#12333d");
  bg.addColorStop(1, "#081b22");
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  g.textAlign = "center";
  /* the terminal boots into the name of the shift it is watching */
  g.fillStyle = "#4fc3ae";
  g.font = (S * 0.07) + "px ui-monospace, monospace";
  g.fillText("O U I S S Y ’ S", S / 2, S * 0.33);
  g.fillStyle = "#7fe4d0";
  g.font = "bold " + (S * 0.115) + "px ui-monospace, monospace";
  g.fillText("NIGHT SHIFT", S / 2, S * 0.46);
  g.font = (S * 0.05) + "px ui-monospace, monospace";
  g.fillStyle = "#3f9e8d";
  g.fillText("WICK & COGS TOY EMPORIUM", S / 2, S * 0.57);
  g.fillStyle = "#4fc3ae";
  g.font = (S * 0.058) + "px ui-monospace, monospace";
  g.fillText("— STANDBY —", S / 2, S * 0.68);
  /* a frame drawn in the phosphor, corners only */
  g.strokeStyle = "rgba(127,228,208,.5)"; g.lineWidth = S * 0.012;
  const m = S * 0.1, c = S * 0.09;
  [[m, m, 1, 1], [S - m, m, -1, 1], [m, S - m, 1, -1], [S - m, S - m, -1, -1]].forEach(([x, y, dx, dy]) => {
    g.beginPath(); g.moveTo(x + dx * c, y); g.lineTo(x, y); g.lineTo(x, y + dy * c); g.stroke();
  });
  /* scan lines and the roll bar */
  for (let y = 0; y < S; y += 3) {
    g.fillStyle = "rgba(0,0,0,.26)";
    g.fillRect(0, y, S, 1.4);
  }
  const rb = g.createLinearGradient(0, S * 0.7, 0, S * 0.86);
  rb.addColorStop(0, "rgba(255,255,255,0)");
  rb.addColorStop(0.5, "rgba(190,255,240,.08)");
  rb.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rb; g.fillRect(0, S * 0.7, S, S * 0.16);
  grain(g, S, S, rnd, 0.05, 0);
}

/* --- three surfaces that only the performers wear ------------------ */

/* brass, gone slightly green in the joints */
function paintBrass(g, S, rnd, base) {
  const gr = g.createLinearGradient(0, 0, S * 0.6, S);
  gr.addColorStop(0, shadeHex(base, 0.22));
  gr.addColorStop(0.42, base);
  gr.addColorStop(0.75, shadeHex(base, -0.22));
  gr.addColorStop(1, shadeHex(base, 0.05));
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  /* the verdigris that collects wherever two parts meet */
  for (let i = 0; i < 26; i++) {
    const x = rnd() * S, y = rnd() * S, r = range(rnd, 4, 22);
    const vg = g.createRadialGradient(x, y, 0, x, y, r);
    vg.addColorStop(0, "rgba(96,142,120,.4)");
    vg.addColorStop(1, "rgba(96,142,120,0)");
    g.fillStyle = vg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  /* turned-metal swirl, and the polish marks over it */
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = rgba(rnd() > 0.5 ? "#ffffff" : "#000000", range(rnd, 0.02, 0.09));
    g.lineWidth = range(rnd, 0.5, 2);
    const y = rnd() * S;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= S; x += S / 6) g.lineTo(x, y + Math.sin(x / 22 + i) * 2.5);
    g.stroke();
  }
  grain(g, S, S, rnd, 0.05, 0);
}

/* glazed porcelain: a warm white, hairline crazing, a blush of colour */
function paintPorcelain(g, S, rnd, base, blush) {
  const gr = g.createLinearGradient(0, 0, S * 0.3, S);
  gr.addColorStop(0, shadeHex(base, 0.1));
  gr.addColorStop(0.6, base);
  gr.addColorStop(1, shadeHex(base, -0.12));
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  if (blush) {
    for (let i = 0; i < 5; i++) {
      const x = rnd() * S, y = rnd() * S, r = range(rnd, S * 0.1, S * 0.28);
      const bg = g.createRadialGradient(x, y, 0, x, y, r);
      bg.addColorStop(0, rgba(blush, 0.3)); bg.addColorStop(1, rgba(blush, 0));
      g.fillStyle = bg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  }
  /* crazing: short forked lines, the way old glaze actually goes */
  for (let i = 0; i < 22; i++) {
    let x = rnd() * S, y = rnd() * S;
    g.strokeStyle = "rgba(120,104,88,.3)"; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += range(rnd, -12, 12); y += range(rnd, -12, 12); g.lineTo(x, y); }
    g.stroke();
  }
  grain(g, S, S, rnd, 0.025, 0);
}

/* the jester's diamonds, off-register and rubbed thin at the points */
function paintHarlequin(g, S, rnd, a, b) {
  g.fillStyle = a; g.fillRect(0, 0, S, S);
  const n = 4, w = S / n, h = S / n;
  for (let y = -1; y < n + 1; y++) for (let x = -1; x < n + 1; x++) {
    if ((x + y) % 2) continue;
    const cx = x * w + w / 2 + range(rnd, -1.5, 1.5);
    const cy = y * h + h / 2 + range(rnd, -1.5, 1.5);
    g.fillStyle = shadeHex(b, range(rnd, -0.1, 0.08));
    g.beginPath();
    g.moveTo(cx, cy - h / 2); g.lineTo(cx + w / 2, cy);
    g.lineTo(cx, cy + h / 2); g.lineTo(cx - w / 2, cy);
    g.closePath(); g.fill();
  }
  /* the gold outline, broken where the paint has worn */
  g.strokeStyle = "rgba(226,190,110,.35)"; g.lineWidth = 1.4;
  for (let y = -1; y < n + 1; y++) for (let x = -1; x < n + 1; x++) {
    if ((x + y) % 2) continue;
    const cx = x * w + w / 2, cy = y * h + h / 2;
    g.beginPath();
    g.moveTo(cx, cy - h / 2); g.lineTo(cx + w / 2, cy);
    g.lineTo(cx, cy + h / 2); g.lineTo(cx - w / 2, cy);
    g.closePath(); g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = "rgba(0,0,0," + range(rnd, 0.04, 0.14) + ")";
    g.beginPath(); g.ellipse(rnd() * S, rnd() * S, range(rnd, 2, 9), range(rnd, 1, 5), rnd() * Math.PI, 0, TAU); g.fill();
  }
  grain(g, S, S, rnd, 0.04, 0);
}

/* --- OUISSY ---------------------------------------------------------
   Her colours come straight off the racer's character sheet so she is
   the same person in both games: warm skin, mid-brown hair worn long
   and centre-parted, a cream varsity jacket with coral sleeves, and the
   goggles pushed up on her forehead.

   (The platformer draws her blonde. The racer is the reference this was
   asked to match, so brown it is — worth knowing that the two existing
   games already disagree with each other about her hair.) */
const OUI = {
  ink:    "#3d2340",
  skin:   "#f6dcc2", skinSh: "#e0bc9c", skinHi: "#fdeedd",
  hair:   "#8a6440", hairMid: "#a67c52", hairHi: "#c49a6c",
  jacket: "#fff1e0", jacketSh: "#e6d5c2",
  sleeve: "#ff7f8a", sleeveSh: "#e0656f",
  accent: "#ff5f95",
  goggle: "#4a3a3a", lens: "#ffd28a",
  jeans:  "#4a5a72", boot: "#6b4a3a",
  blush:  "#ff8fae",
  /* what her hands and sleeves are painted in when they are the nearest
     thing to the desk lamp */
  handSkin: "#b78256", handSkinLo: "#93613c", handNail: "#d29d84", handSleeve: "#b8434e",
};

/* her face, painted — for the photograph on the board and the plate on
   the desk. Drawn rather than modelled because at photograph size a
   drawing reads and a model does not. */
function paintOuissyPhoto(g, S, rnd) {
  const bg = g.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, "#c8a882"); bg.addColorStop(1, "#8a6a52");
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  /* the white border of a photobooth strip */
  g.fillStyle = "#f4ece0"; g.fillRect(0, 0, S, S);
  g.fillStyle = "#a8845e"; g.fillRect(S * 0.06, S * 0.06, S * 0.88, S * 0.8);
  const cx = S * 0.5, cy = S * 0.56, r = S * 0.2;
  /* shoulders and jacket */
  g.fillStyle = OUI.jacket;
  g.beginPath(); g.ellipse(cx, cy + r * 2.0, r * 1.85, r * 1.1, 0, 0, TAU); g.fill();
  g.fillStyle = OUI.sleeve;
  g.beginPath(); g.ellipse(cx - r * 1.5, cy + r * 2.2, r * 0.6, r * 0.85, 0.2, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(cx + r * 1.5, cy + r * 2.2, r * 0.6, r * 0.85, -0.2, 0, TAU); g.fill();
  g.fillStyle = OUI.accent;
  g.fillRect(cx - r * 0.5, cy + r * 1.2, r, r * 0.28);
  /* hair behind */
  g.fillStyle = OUI.hair;
  g.beginPath(); g.ellipse(cx, cy + r * 0.5, r * 1.45, r * 1.85, 0, 0, TAU); g.fill();
  /* face */
  g.fillStyle = OUI.skin;
  g.beginPath(); g.ellipse(cx, cy, r * 0.98, r * 1.14, 0, 0, TAU); g.fill();
  g.fillStyle = OUI.skinHi;
  g.beginPath(); g.ellipse(cx - r * 0.3, cy - r * 0.3, r * 0.4, r * 0.45, 0, 0, TAU); g.fill();
  /* the centre parting and the two front curtains */
  g.fillStyle = OUI.hairMid;
  g.beginPath(); g.ellipse(cx, cy - r * 0.72, r * 1.08, r * 0.55, 0, 0, TAU); g.fill();
  g.fillStyle = OUI.hair;
  g.beginPath(); g.ellipse(cx - r * 0.86, cy - r * 0.1, r * 0.34, r * 0.95, 0.1, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(cx + r * 0.86, cy - r * 0.1, r * 0.34, r * 0.95, -0.1, 0, TAU); g.fill();
  g.strokeStyle = OUI.hairHi; g.lineWidth = S * 0.008;
  g.beginPath(); g.moveTo(cx, cy - r * 1.2); g.lineTo(cx, cy - r * 0.5); g.stroke();
  /* the goggles, pushed up */
  g.fillStyle = OUI.goggle;
  g.fillRect(cx - r * 1.05, cy - r * 1.02, r * 2.1, r * 0.3);
  g.fillStyle = OUI.lens;
  g.beginPath(); g.ellipse(cx - r * 0.5, cy - r * 0.88, r * 0.34, r * 0.24, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(cx + r * 0.5, cy - r * 0.88, r * 0.34, r * 0.24, 0, 0, TAU); g.fill();
  /* eyes, a nose and a small closed smile */
  g.fillStyle = OUI.ink;
  g.beginPath(); g.ellipse(cx - r * 0.34, cy - r * 0.05, r * 0.1, r * 0.13, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(cx + r * 0.34, cy - r * 0.05, r * 0.1, r * 0.13, 0, 0, TAU); g.fill();
  g.fillStyle = "#ffffff";
  g.beginPath(); g.arc(cx - r * 0.3, cy - r * 0.1, r * 0.04, 0, TAU); g.fill();
  g.beginPath(); g.arc(cx + r * 0.38, cy - r * 0.1, r * 0.04, 0, TAU); g.fill();
  g.fillStyle = OUI.blush; g.globalAlpha = 0.5;
  g.beginPath(); g.ellipse(cx - r * 0.6, cy + r * 0.3, r * 0.22, r * 0.14, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(cx + r * 0.6, cy + r * 0.3, r * 0.22, r * 0.14, 0, 0, TAU); g.fill();
  g.globalAlpha = 1;
  g.strokeStyle = OUI.skinSh; g.lineWidth = S * 0.01;
  g.beginPath(); g.moveTo(cx, cy + r * 0.1); g.lineTo(cx - r * 0.06, cy + r * 0.32); g.stroke();
  g.strokeStyle = "#b0576a"; g.lineWidth = S * 0.014;
  g.beginPath(); g.arc(cx, cy + r * 0.4, r * 0.28, 0.25, Math.PI - 0.25); g.stroke();
  /* the caption strip along the bottom */
  g.fillStyle = "#f4ece0"; g.fillRect(0, S * 0.86, S, S * 0.14);
  g.fillStyle = "#6a5240";
  g.font = "bold " + (S * 0.075) + "px ui-monospace, monospace";
  g.textAlign = "center";
  g.fillText("OUISSY", S / 2, S * 0.965);
  grain(g, S, S, rnd, 0.05, 0);
}

/* the two of them, and this one never appears during a shift — it hangs
   in the daylight gallery only, where nothing is going to move it or
   use it for a fright */
function paintUsPhoto(g, S, rnd) {
  const sky = g.createLinearGradient(0, 0, 0, S);
  sky.addColorStop(0, "#f6d7b0"); sky.addColorStop(0.62, "#f3bfa0"); sky.addColorStop(1, "#c98f76");
  g.fillStyle = sky; g.fillRect(0, 0, S, S);
  g.fillStyle = "rgba(255,236,200,.75)";
  g.beginPath(); g.arc(S * 0.76, S * 0.24, S * 0.09, 0, TAU); g.fill();
  /* a low skyline and a rooftop parapet, warm and out of focus */
  g.fillStyle = "#a87a68";
  for (let i = 0; i < 9; i++) {
    const w = S * range(rnd, 0.06, 0.14), x = S * (i / 9) + range(rnd, -6, 6);
    g.fillRect(x, S * range(rnd, 0.5, 0.62), w, S);
  }
  g.fillStyle = "#8a5e50"; g.fillRect(0, S * 0.72, S, S * 0.28);
  /* two figures, shoulder to shoulder, backs to the light */
  const draw = (cx, hair, jacket, sleeve, tall) => {
    const base = S * 0.78, h = S * (tall ? 0.4 : 0.36);
    g.fillStyle = jacket;
    g.beginPath(); g.ellipse(cx, base - h * 0.28, h * 0.3, h * 0.36, 0, 0, TAU); g.fill();
    g.fillStyle = sleeve;
    g.beginPath(); g.ellipse(cx - h * 0.28, base - h * 0.24, h * 0.11, h * 0.24, 0.2, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(cx + h * 0.28, base - h * 0.24, h * 0.11, h * 0.24, -0.2, 0, TAU); g.fill();
    g.fillStyle = hair;
    g.beginPath(); g.ellipse(cx, base - h * 0.68, h * 0.22, h * 0.26, 0, 0, TAU); g.fill();
    g.fillStyle = "rgba(60,34,24,.35)";
    g.beginPath(); g.ellipse(cx, base - h * 0.62, h * 0.2, h * 0.2, 0, 0, TAU); g.fill();
  };
  draw(S * 0.4, OUI.hair, OUI.jacket, OUI.sleeve, false);
  draw(S * 0.6, "#2b1c12", "#5ab8a6", "#3f8f80", true);
  /* the white border and a corner of tape */
  g.strokeStyle = "#f6efe2"; g.lineWidth = S * 0.07;
  g.strokeRect(0, 0, S, S);
  grain(g, S, S, rnd, 0.05, 0);
}

/* the same window, six hours later. Only ever shown once. */
function paintDawn(g, S, rnd) {
  const sky = g.createLinearGradient(0, 0, 0, S);
  sky.addColorStop(0, "#8fb0d0");
  sky.addColorStop(0.34, "#e6c49a");
  sky.addColorStop(0.52, "#f0a882");
  sky.addColorStop(1, "#c8896e");
  g.fillStyle = sky; g.fillRect(0, 0, S, S);
  const mx = S * 0.3, my = S * 0.46;
  const mg = g.createRadialGradient(mx, my, 0, mx, my, S * 0.42);
  mg.addColorStop(0, "rgba(255,244,214,.95)");
  mg.addColorStop(0.2, "rgba(255,220,160,.5)");
  mg.addColorStop(1, "rgba(255,200,150,0)");
  g.fillStyle = mg; g.fillRect(0, 0, S, S);
  g.fillStyle = "#5e5048";
  g.fillRect(0, S * 0.56, S, S * 0.44);
  g.fillStyle = "#6a5a50"; g.fillRect(0, S * 0.54, S, S * 0.03);
  for (const w of [[0.14, 0.62], [0.62, 0.68]]) {
    g.fillStyle = "rgba(255,232,190,.5)";
    g.fillRect(S * w[0], S * w[1], S * 0.11, S * 0.13);
  }
  for (let i = 0; i < 5; i++) {
    g.fillStyle = "rgba(48,40,36,.7)";
    g.fillRect(S * range(rnd, 0.05, 0.95), S * 0.56, S * 0.02, S * 0.44);
  }
  /* the rain has stopped */
  grain(g, S, S, rnd, 0.03, 0);
}

/* the contact shadow every prop stands on. One texture, shared. */
function paintBlob(g, S) {
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0,    "rgba(0,0,0,.95)");
  gr.addColorStop(0.42, "rgba(0,0,0,.62)");
  gr.addColorStop(0.72, "rgba(0,0,0,.22)");
  gr.addColorStop(1,    "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
}

/* build one, cache it */
function tex(name, painter, size, repeat) {
  if (texCache[name]) return texCache[name];
  const S = size || 256;
  const c = canvas(S);
  const g = c.getContext("2d");
  painter(g, S, rngFor(name));
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = 4;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  texCache[name] = t;
  return t;
}

function buildTextures() {
  TX.floorWood   = tex("floorWood",   (g,S,r) => paintWood(g,S,r,"#6b4a30",{boards:5}));
  TX.floorStage  = tex("floorStage",  (g,S,r) => paintWood(g,S,r,"#4e3524",{boards:7}));
  TX.floorTile   = tex("floorTile",   (g,S,r) => paintTile(g,S,r,"#8f8577","#6d6458"));
  TX.floorCheck  = tex("floorCheck",  (g,S,r) => paintTile(g,S,r,"#b8a48c","#4a3f39"));
  TX.floorCarpet = tex("floorCarpet", (g,S,r) => paintCarpet(g,S,r,"#3a2b3d","#c4657f"));
  TX.floorOffice = tex("floorOffice", (g,S,r) => paintCarpet(g,S,r,"#33302c","#7d6a4a"));
  TX.floorCon    = tex("floorCon",    (g,S,r) => paintConcrete(g,S,r,"#5a564e"));

  TX.wallCream   = tex("wallCream",   (g,S,r) => paintPlaster(g,S,r,"#8a7f6c"));
  TX.wallGreen   = tex("wallGreen",   (g,S,r) => paintPlaster(g,S,r,"#5b6a5c"));
  TX.wallBlue    = tex("wallBlue",    (g,S,r) => paintPlaster(g,S,r,"#4f5b6b"));
  TX.wallOffice  = tex("wallOffice",  (g,S,r) => paintPlaster(g,S,r,"#6d6152"));
  TX.wallPaper   = tex("wallPaper",   (g,S,r) => paintPaper(g,S,r,"#7d5f52","#8f6f5c","#e0c08a"));
  TX.brick       = tex("brick",       (g,S,r) => paintBrick(g,S,r,"#7a4c3c"));
  TX.brickPale   = tex("brickPale",   (g,S,r) => paintBrick(g,S,r,"#8a8274"));
  TX.metal       = tex("metal",       (g,S,r) => paintMetal(g,S,r,"#6f7780"));
  TX.velvet      = tex("velvet",      (g,S,r) => paintVelvet(g,S,r,"#5e1f2c"));
  TX.enamelRed   = tex("enamelRed",   (g,S,r) => paintEnamel(g,S,r,"#8c3f3a"));
  TX.enamelBlue  = tex("enamelBlue",  (g,S,r) => paintEnamel(g,S,r,"#33506b"));
  TX.enamelGreen = tex("enamelGreen", (g,S,r) => paintEnamel(g,S,r,"#3d6355"));
  TX.enamelCream = tex("enamelCream", (g,S,r) => paintEnamel(g,S,r,"#a89876"));
  TX.woodShelf   = tex("woodShelf",   (g,S,r) => paintWood(g,S,r,"#7d5b3c",{boards:3}));
  TX.woodDark    = tex("woodDark",    (g,S,r) => paintWood(g,S,r,"#4a3524",{boards:4}));
  TX.oui         = tex("oui", paintOuissyPhoto, 256);
  TX.oui.wrapS = TX.oui.wrapT = T.ClampToEdgeWrapping;
  TX.us          = tex("us", paintUsPhoto, 256);
  TX.us.wrapS = TX.us.wrapT = T.ClampToEdgeWrapping;
  TX.brass       = tex("brass",     (g,S,r) => paintBrass(g,S,r,"#b08c46"));
  TX.brassDark   = tex("brassDark", (g,S,r) => paintBrass(g,S,r,"#7a6236"));
  TX.pewter      = tex("pewter",    (g,S,r) => paintBrass(g,S,r,"#8a8f96"));
  TX.porcelain   = tex("porcelain", (g,S,r) => paintPorcelain(g,S,r,"#e8e0d4","#d08a96"));
  TX.harlequin   = tex("harlequin", (g,S,r) => paintHarlequin(g,S,r,"#5b3f7a","#c9a03c"));
  TX.crt         = tex("crt", paintCRT, 256);
  TX.crt.wrapS = TX.crt.wrapT = T.ClampToEdgeWrapping;
  TX.dawn        = tex("dawn", paintDawn, 256);
  TX.dawn.wrapS = TX.dawn.wrapT = T.ClampToEdgeWrapping;
  TX.night       = tex("night", paintNight, 256);
  TX.night.wrapS = TX.night.wrapT = T.ClampToEdgeWrapping;
  TX.blob        = tex("blob", paintBlob, 128);
  TX.blob.wrapS = TX.blob.wrapT = T.ClampToEdgeWrapping;
}

/* =========================================================
   8. MATERIALS

   MeshLambertMaterial throughout. It is per-fragment in r180, so a
   six-triangle box still takes a soft gradient across its face under a
   point light, which is the whole look — and it costs a fraction of
   what a standard material would on a phone.

   Repeats differ per surface, so the texture is cloned (the image is
   shared, only the wrap settings are not) and the result cached, so a
   room with forty props still issues a handful of material states.
   ========================================================= */
const matCache = {};

function mat(texName, rx, ry, tint, opts) {
  opts = opts || {};
  const key = texName + "|" + rx + "|" + ry + "|" + (tint || "") + "|" + JSON.stringify(opts);
  if (matCache[key]) return matCache[key];
  const src = TX[texName];
  let map = null;
  if (src) {
    map = src.clone();
    map.needsUpdate = true;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.set(rx || 1, ry || 1);
    if (opts.offset) map.offset.set(opts.offset[0], opts.offset[1]);
    if (opts.rot) { map.center.set(0.5, 0.5); map.rotation = opts.rot; }
  }
  const m = new T.MeshLambertMaterial({
    map: map,
    color: new T.Color(tint || "#ffffff"),
    side: opts.side || T.FrontSide,
    transparent: !!opts.transparent,
    opacity: opts.opacity === undefined ? 1 : opts.opacity,
    emissive: new T.Color(opts.emissive || "#000000"),
    emissiveIntensity: opts.emissiveIntensity === undefined ? 1 : opts.emissiveIntensity,
  });
  matCache[key] = m;
  return m;
}

/* plain colour, still lit — for the small painted parts of a toy where
   a 256px texture would be invisible anyway */
function flat(hex, opts) {
  opts = opts || {};
  const key = "flat|" + hex + "|" + JSON.stringify(opts);
  if (matCache[key]) return matCache[key];
  const m = new T.MeshLambertMaterial({
    color: new T.Color(hex),
    emissive: new T.Color(opts.emissive || "#000000"),
    emissiveIntensity: opts.emissiveIntensity === undefined ? 1 : opts.emissiveIntensity,
    transparent: !!opts.transparent,
    opacity: opts.opacity === undefined ? 1 : opts.opacity,
    side: opts.side || T.FrontSide,
  });
  matCache[key] = m;
  return m;
}

/* a light source's own body — unlit, so a bulb reads as a bulb even
   when nothing else in the room is lit */
function glow(hex, opacity) {
  const key = "glow|" + hex + "|" + opacity;
  if (matCache[key]) return matCache[key];
  const m = new T.MeshBasicMaterial({
    color: new T.Color(hex),
    transparent: opacity !== undefined,
    opacity: opacity === undefined ? 1 : opacity,
    fog: true,
  });
  matCache[key] = m;
  return m;
}

/* =========================================================
   9. SOLIDS, AND THE RULE ABOUT THEM

   `slab` is the only box builder in the file. It exists so that the
   answer to "is this thing flat?" is always no: a slab has six faces
   and a minimum thickness, and asking for one thinner than 1.2cm gets
   you 1.2cm. Cutouts cannot be built by accident.
   ========================================================= */
const MIN_T = 0.012;

function slab(w, h, d, material, opts) {
  opts = opts || {};
  const g = new T.BoxGeometry(
    Math.max(w, MIN_T), Math.max(h, MIN_T), Math.max(d, MIN_T),
    opts.sw || 1, opts.sh || 1, opts.sd || 1
  );
  const m = new T.Mesh(g, material);
  m.matrixAutoUpdate = false;      // static geometry: never re-derived
  return m;
}

/* set a local transform once and bake it. Everything in a room goes
   through here or through `place`, and after boot nothing writes to a
   prop's matrix again. */
function at(mesh, x, y, z, rx, ry, rz, sx, sy, sz) {
  mesh.position.set(x || 0, y || 0, z || 0);
  mesh.rotation.set(rx || 0, ry || 0, rz || 0);
  if (sx !== undefined) mesh.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
  mesh.updateMatrix();
  return mesh;
}

/* a group of parts, assembled in its own local space */
function part(x, y, z, ry) {
  const g = new T.Group();
  g.position.set(x || 0, y || 0, z || 0);
  if (ry) g.rotation.y = ry;
  return g;
}

/* --- the contact shadow -------------------------------------------
   Rule 2. A prop enters a room through `place`, and `place` lays a
   soft pool under it sized to its own footprint. Objects that touch
   the floor get a tight dark pool; objects on a shelf or a wall get a
   smaller, fainter one on whatever they sit on. Nothing floats.
   ------------------------------------------------------------------ */
const _box = new T.Box3();
const _sz  = new T.Vector3();
const _ctr = new T.Vector3();

function contactShadow(obj, opts) {
  opts = opts || {};
  _box.setFromObject(obj);
  if (!isFinite(_box.min.x)) return null;
  _box.getSize(_sz); _box.getCenter(_ctr);
  const foot = Math.max(_sz.x, _sz.z);
  const w = (_sz.x + foot * 0.28) * (opts.spread || 1);
  const d = (_sz.z + foot * 0.28) * (opts.spread || 1);
  /* the taller a thing is above its own base, the softer and weaker its
     contact pool — the same reason a chair leg is darker than a lampshade */
  const lift = clamp(1 - (_sz.y / (foot * 5 + 0.4)) * 0.5, 0.34, 1);
  const m = new T.Mesh(
    new T.PlaneGeometry(w, d),                 // a plane on purpose: it is a shadow
    new T.MeshBasicMaterial({
      map: TX.blob, transparent: true, depthWrite: false,
      opacity: (opts.opacity === undefined ? 0.62 : opts.opacity) * lift,
      color: new T.Color(opts.tint || "#000000"),
      blending: T.NormalBlending, fog: false,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(_ctr.x, (opts.y === undefined ? _box.min.y : opts.y) + 0.006, _ctr.z);
  m.renderOrder = -1;
  m.updateMatrix();
  m.matrixAutoUpdate = false;
  return m;
}

/* --- the only way a prop gets into a room -------------------------
   Rule 3 lives here too: the transform is written once, `updateMatrix`
   is called once, and `matrixAutoUpdate` goes off. The frame loop has
   no handle on any of it.
   ------------------------------------------------------------------ */
function place(room, obj, x, y, z, opts) {
  opts = opts || {};
  /* a caller may hand us an already-frozen subtree — re-arm it, or the
     transform we are about to write would never reach its matrix. This
     cost an hour: every prop in the office stacked up at the origin,
     one of them across the camera lens. */
  obj.matrixAutoUpdate = true;
  obj.matrixWorldAutoUpdate = true;
  obj.position.set(x, y || 0, z);
  if (opts.ry !== undefined) obj.rotation.y = opts.ry;
  if (opts.rx !== undefined) obj.rotation.x = opts.rx;
  if (opts.rz !== undefined) obj.rotation.z = opts.rz;
  if (opts.s !== undefined) obj.scale.setScalar(opts.s);
  obj.updateMatrixWorld(true);
  if (opts.shadow !== false) {
    const s = contactShadow(obj, {
      y: opts.shadowY !== undefined ? opts.shadowY : (y || 0),
      opacity: opts.shadowOpacity,
      spread: opts.shadowSpread,
    });
    if (s) { room.add(s); freeze(s); }
  }
  room.add(obj);
  freeze(obj);        // rule 3: composed once, then nothing may touch it
  return obj;
}

/* box + transform in one call, since almost every part wants both */
function sb(w, h, d, material, x, y, z, ry, rx, rz) {
  return at(slab(w, h, d, material), x, y, z, rx, ry, rz);
}

/* freeze a finished static subtree: every matrix composed once, then
   both auto-update flags off, so the frame loop skips the entire branch
   rather than walking it. This is rule 3 with teeth — a static prop
   cannot drift because nothing recomputes it, ever. */
function freeze(obj) {
  /* re-arm first: an object may already have been frozen once (built,
     then placed), and updateMatrixWorld will silently skip a node whose
     matrixWorldAutoUpdate is already off. Freezing before parenting and
     then never re-deriving is exactly how the racer's props ended up in
     the wrong room. */
  obj.traverse((o) => { o.matrixWorldAutoUpdate = true; });
  obj.updateMatrixWorld(true);
  obj.traverse((o) => { o.matrixAutoUpdate = false; o.matrixWorldAutoUpdate = false; });
  return obj;
}

/* =========================================================
   10. THE PROP KIT

   Rule 4: nothing in here returns the same object twice. Every builder
   takes a variant index and a seeded rng, and the callers vary both.
   Every builder returns a solid — uprights, boards, edges, feet — with
   faces the light can separate.
   ========================================================= */
const KIT = {};

/* --- shelving, four builds ---------------------------------------- */
KIT.shelf = function (v, rnd, opts) {
  opts = opts || {};
  const g = new T.Group();
  const woods = ["woodShelf", "woodDark", "woodShelf", "enamelGreen"];
  const wm = mat(woods[v % 4], 1.2, 0.5, ["#c9a678", "#9a8060", "#b39068", "#c8d0c4"][v % 4]);
  const W = opts.w || [1.5, 1.15, 1.9, 1.35][v % 4];
  const H = opts.h || [1.9, 2.2, 1.55, 2.0][v % 4];
  const D = opts.d || [0.42, 0.34, 0.5, 0.38][v % 4];
  const boards = [4, 5, 3, 4][v % 4];
  const post = 0.07;

  /* uprights — four, so it reads as a frame from any angle */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(sb(post, H, post, wm, sx * (W / 2 - post / 2), H / 2, sz * (D / 2 - post / 2)));
  }
  /* boards, each with a lipped front edge so the shelf has a profile */
  for (let i = 0; i < boards; i++) {
    const y = 0.09 + (i / (boards - 1)) * (H - 0.24);
    g.add(sb(W - 0.03, 0.045, D - 0.02, wm, 0, y, 0));
    g.add(sb(W - 0.03, 0.075, 0.028, wm, 0, y - 0.03, D / 2 - 0.014));
  }
  /* a back — slatted on two of the four builds, panelled on the others */
  if (v % 2 === 0) {
    for (let i = 0; i < 5; i++) {
      g.add(sb(W - 0.14, H / 6.5, 0.02, wm, 0, 0.2 + i * (H / 5.3), -D / 2 + 0.02));
    }
  } else {
    g.add(sb(W - 0.06, H - 0.2, 0.022, wm, 0, H / 2, -D / 2 + 0.02));
  }
  /* kick plate and feet */
  g.add(sb(W - 0.04, 0.09, 0.03, wm, 0, 0.045, D / 2 - 0.05));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(sb(post * 1.3, 0.03, post * 1.3, flat("#2e241c"), sx * (W / 2 - post / 2), 0.015, sz * (D / 2 - post / 2)));
  }
  /* what is on it */
  if (opts.stock !== false) {
    for (let i = 0; i < boards - 1; i++) {
      const y = 0.115 + (i / (boards - 1)) * (H - 0.24);
      const n = 2 + ((rnd() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const t = KIT.toy((rnd() * 6) | 0, rnd);
        const x = -W / 2 + 0.16 + (k + range(rnd, -0.18, 0.18)) * ((W - 0.32) / Math.max(1, n - 1 || 1));
        at(t, clamp(x, -W / 2 + 0.14, W / 2 - 0.14), y, range(rnd, -0.05, 0.05), 0, range(rnd, -0.6, 0.6), 0);
        /* the little pool a toy casts on the board it stands on */
        const s = contactShadow(t, { y: y, opacity: 0.4, spread: 0.8 });
        if (s) g.add(s);
        g.add(t);
      }
    }
  }
  return g;
};

/* --- arcade cabinets, four builds ---------------------------------- */
KIT.cabinet = function (v, rnd) {
  const g = new T.Group();
  const skins = ["enamelRed", "enamelBlue", "enamelGreen", "enamelCream"];
  const tints = ["#c98a72", "#7e9ec4", "#84b39c", "#cbb98c"];
  const bm = mat(skins[v % 4], 0.8, 1.4, tints[v % 4]);
  const W = [0.72, 0.66, 0.8, 0.62][v % 4];
  const H = [1.78, 1.9, 1.66, 1.84][v % 4];
  const D = 0.78;

  /* body: two side panels and a back, so the cabinet is hollow the way
     a real one is, and the light gets in between them */
  for (const sx of [-1, 1]) g.add(sb(0.06, H, D, bm, sx * (W / 2 - 0.03), H / 2, 0));
  g.add(sb(W - 0.12, H, 0.06, bm, 0, H / 2, -D / 2 + 0.03));
  g.add(sb(W - 0.12, 0.72, 0.06, bm, 0, 0.36, D / 2 - 0.03));       // coin door front
  g.add(sb(W - 0.12, 0.06, D - 0.12, bm, 0, H - 0.03, 0));           // top
  /* the control deck, sloped */
  const deck = sb(W - 0.1, 0.07, 0.34, mat("enamelCream", 1, 1, "#8e8068"), 0, 1.02, D / 2 - 0.15, 0, -0.30);
  g.add(deck);
  g.add(sb(W - 0.1, 0.26, 0.06, bm, 0, 0.9, D / 2 - 0.02));          // deck front lip
  /* joystick and two buttons — small, but they are what makes it a cabinet */
  const stick = part(-W * 0.22, 1.09, D / 2 - 0.18);
  stick.add(sb(0.055, 0.13, 0.055, flat("#2b2b30"), 0, 0.06, 0));
  const ball = new T.Mesh(new T.SphereGeometry(0.042, 10, 8), flat(["#d0435c", "#e0b13c", "#3f8fd0"][v % 3]));
  g.add(at(ball, -W * 0.22, 1.2, D / 2 - 0.18));
  g.add(stick);
  for (let i = 0; i < 2; i++) {
    const b = new T.Mesh(new T.CylinderGeometry(0.032, 0.032, 0.022, 10), flat(["#d0435c", "#e0b13c"][i]));
    g.add(at(b, W * 0.1 + i * 0.11, 1.075, D / 2 - 0.2, -0.30));
  }
  /* the screen: recessed behind a bezel, and it is the thing that lights
     the room, so it is a glow not a lit surface */
  g.add(sb(W - 0.16, 0.62, 0.03, flat("#15161c"), 0, 1.42, D / 2 - 0.16));
  const scr = sb(W - 0.26, 0.5, 0.012, glow(["#2b4a6e", "#3d2b52", "#1f4a44", "#4a3520"][v % 4]), 0, 1.42, D / 2 - 0.145);
  scr.userData.screen = true;
  g.add(scr);
  g.add(sb(W - 0.12, 0.1, 0.09, bm, 0, 1.76, D / 2 - 0.14));         // bezel hood
  /* marquee, lit from behind */
  g.add(sb(W - 0.1, 0.26, 0.07, glow(["#e8a04a", "#c85c8a", "#6ec0a0", "#e0c060"][v % 4], 0.85), 0, H - 0.2, D / 2 - 0.06));
  g.add(sb(W - 0.06, 0.05, 0.1, bm, 0, H - 0.05, D / 2 - 0.06));
  /* feet, so it stands on something */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(sb(0.07, 0.045, 0.07, flat("#1e1e22"), sx * (W / 2 - 0.06), 0.022, sz * (D / 2 - 0.08)));
  }
  return g;
};

/* --- seating, three builds ----------------------------------------- */
KIT.chair = function (v, rnd) {
  const g = new T.Group();
  if (v % 3 === 0) {
    /* a party chair: moulded seat, tube legs */
    const seatM = flat(pick(rnd, ["#c96a70", "#5f9ec4", "#78b08a", "#d2a24c"]));
    g.add(sb(0.4, 0.05, 0.38, seatM, 0, 0.44, 0));
    g.add(sb(0.4, 0.42, 0.05, seatM, 0, 0.66, -0.17, 0, -0.12));
    const legM = flat("#8a8f96");
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(sb(0.026, 0.44, 0.026, legM, sx * 0.16, 0.22, sz * 0.15, 0, 0, sx * 0.04));
    }
    g.add(sb(0.34, 0.02, 0.02, legM, 0, 0.14, 0.15));
  } else if (v % 3 === 1) {
    /* a workshop stool */
    const wm = mat("woodDark", 1, 1, "#9a7a58");
    const top = new T.Mesh(new T.CylinderGeometry(0.19, 0.2, 0.055, 14), wm);
    g.add(at(top, 0, 0.62, 0));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.4;
      const leg = new T.Mesh(new T.CylinderGeometry(0.018, 0.026, 0.63, 8), wm);
      g.add(at(leg, Math.cos(a) * 0.13, 0.315, Math.sin(a) * 0.13, 0, 0, -Math.cos(a) * 0.12));
      const ring = new T.Mesh(new T.TorusGeometry(0.15, 0.012, 6, 16), wm);
      if (i === 0) g.add(at(ring, 0, 0.22, 0, Math.PI / 2));
    }
  } else {
    /* the guard's own chair: castors, a worn cushion, a bent back */
    const cm = mat("enamelBlue", 1, 1, "#5a6a7c");
    g.add(sb(0.46, 0.09, 0.44, cm, 0, 0.47, 0));
    g.add(sb(0.42, 0.5, 0.08, cm, 0, 0.76, -0.2, 0, -0.16));
    const col = new T.Mesh(new T.CylinderGeometry(0.035, 0.045, 0.42, 10), flat("#3a3d42"));
    g.add(at(col, 0, 0.22, 0));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      g.add(sb(0.05, 0.03, 0.24, flat("#33363b"), Math.cos(a) * 0.11, 0.06, Math.sin(a) * 0.11, -a));
      const w = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.022, 8), flat("#22242a"));
      g.add(at(w, Math.cos(a) * 0.22, 0.035, Math.sin(a) * 0.22, 0, 0, Math.PI / 2));
    }
  }
  return g;
};

/* --- crates and boxes, three builds -------------------------------- */
KIT.crate = function (v, rnd) {
  const g = new T.Group();
  if (v % 3 === 2) {
    /* a cardboard carton, flaps open */
    const cm = mat("woodShelf", 1, 1, "#b09274");
    const W = range(rnd, 0.34, 0.48), H = range(rnd, 0.26, 0.4), D = range(rnd, 0.3, 0.42);
    for (const sx of [-1, 1]) g.add(sb(0.014, H, D, cm, sx * W / 2, H / 2, 0));
    for (const sz of [-1, 1]) g.add(sb(W, H, 0.014, cm, 0, H / 2, sz * D / 2));
    g.add(sb(W, 0.014, D, cm, 0, 0.007, 0));
    g.add(sb(W, 0.012, D * 0.44, cm, 0, H + 0.05, -D * 0.28, 0, -0.5));
    g.add(sb(W, 0.012, D * 0.44, cm, 0, H + 0.05, D * 0.28, 0, 0.5));
    return g;
  }
  /* a slatted wooden crate with corner posts */
  const wm = mat(v % 3 === 0 ? "woodShelf" : "woodDark", 1, 1, v % 3 === 0 ? "#c0a078" : "#8a6a4a");
  const W = range(rnd, 0.42, 0.6), H = range(rnd, 0.3, 0.46), D = range(rnd, 0.4, 0.54);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(sb(0.05, H, 0.05, wm, sx * (W / 2 - 0.025), H / 2, sz * (D / 2 - 0.025)));
  }
  const slats = 3;
  for (let i = 0; i < slats; i++) {
    const y = 0.05 + i * ((H - 0.1) / (slats - 1));
    for (const sz of [-1, 1]) g.add(sb(W - 0.02, 0.07, 0.018, wm, 0, y, sz * (D / 2 - 0.01)));
    for (const sx of [-1, 1]) g.add(sb(0.018, 0.07, D - 0.02, wm, sx * (W / 2 - 0.01), y, 0));
  }
  g.add(sb(W - 0.04, 0.02, D - 0.04, wm, 0, H, 0));
  g.add(sb(W - 0.04, 0.02, D - 0.04, wm, 0, 0.01, 0));
  return g;
};

/* --- the small things on shelves, six builds ----------------------- */
KIT.toy = function (v, rnd) {
  const g = new T.Group();
  const s = range(rnd, 0.88, 1.15);
  if (v === 0) {                                  /* a stacking-ring tower */
    const cols = ["#c8534e", "#e0a83c", "#4d90c0", "#6fb07a"];
    const base = new T.Mesh(new T.CylinderGeometry(0.075, 0.085, 0.016, 12), flat("#8a6a4a"));
    g.add(at(base, 0, 0.008, 0));
    for (let i = 0; i < 4; i++) {
      const r = 0.07 - i * 0.013;
      const ring = new T.Mesh(new T.TorusGeometry(r, 0.019, 6, 14), flat(cols[i]));
      g.add(at(ring, 0, 0.032 + i * 0.036, 0, Math.PI / 2));
    }
    const pin = new T.Mesh(new T.CylinderGeometry(0.008, 0.01, 0.19, 8), flat("#c4a27a"));
    g.add(at(pin, 0, 0.095, 0));
  } else if (v === 1) {                           /* a tin drum */
    const body = new T.Mesh(new T.CylinderGeometry(0.075, 0.075, 0.085, 14), mat("enamelRed", 1, 1, "#c46a5c"));
    g.add(at(body, 0, 0.045, 0));
    for (const y of [0.005, 0.086]) {
      const skin = new T.Mesh(new T.CylinderGeometry(0.078, 0.078, 0.006, 14), flat("#e6dcc4"));
      g.add(at(skin, 0, y + 0.002, 0));
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      g.add(sb(0.008, 0.09, 0.008, flat("#d8c070"), Math.cos(a) * 0.076, 0.045, Math.sin(a) * 0.076, 0, 0, 0.28 * (i % 2 ? 1 : -1)));
    }
  } else if (v === 2) {                           /* a blocky bear */
    const fur = flat(pick(rnd, ["#a8794e", "#8a6440", "#c0a074"]));
    g.add(sb(0.09, 0.1, 0.07, fur, 0, 0.06, 0));
    g.add(sb(0.075, 0.07, 0.065, fur, 0, 0.145, 0.005));
    for (const sx of [-1, 1]) {
      const e = new T.Mesh(new T.SphereGeometry(0.021, 8, 6), fur);
      g.add(at(e, sx * 0.033, 0.185, 0));
      g.add(sb(0.028, 0.075, 0.028, fur, sx * 0.06, 0.075, 0, 0, 0, sx * 0.3));
      g.add(sb(0.032, 0.032, 0.05, fur, sx * 0.025, 0.016, 0.01));
    }
    const sn = new T.Mesh(new T.SphereGeometry(0.018, 8, 6), flat("#e0cfb4"));
    g.add(at(sn, 0, 0.135, 0.04));
    for (const sx of [-1, 1]) {
      const ey = new T.Mesh(new T.SphereGeometry(0.007, 6, 5), flat("#171310"));
      g.add(at(ey, sx * 0.021, 0.158, 0.031));
    }
  } else if (v === 3) {                           /* a spinning top */
    const top = new T.Mesh(new T.ConeGeometry(0.07, 0.1, 12), mat("enamelBlue", 1, 1, "#7aa0c8"));
    g.add(at(top, 0, 0.058, 0, Math.PI));
    const cap = new T.Mesh(new T.CylinderGeometry(0.03, 0.055, 0.03, 12), flat("#d8b45c"));
    g.add(at(cap, 0, 0.12, 0));
    const knob = new T.Mesh(new T.CylinderGeometry(0.009, 0.009, 0.05, 8), flat("#a08050"));
    g.add(at(knob, 0, 0.155, 0));
  } else if (v === 4) {                           /* a wind-up car */
    const bm = flat(pick(rnd, ["#c8534e", "#3f7fb0", "#5fa070", "#d2a03c"]));
    g.add(sb(0.16, 0.05, 0.085, bm, 0, 0.045, 0));
    g.add(sb(0.085, 0.045, 0.075, bm, -0.012, 0.09, 0));
    g.add(sb(0.07, 0.03, 0.078, glow("#2e3a48", 0.9), -0.012, 0.096, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = new T.Mesh(new T.CylinderGeometry(0.026, 0.026, 0.014, 10), flat("#26262c"));
      g.add(at(w, sx * 0.055, 0.026, sz * 0.048, 0, 0, Math.PI / 2));
    }
    const key = new T.Mesh(new T.TorusGeometry(0.018, 0.005, 5, 10), flat("#d8c070"));
    g.add(at(key, 0.085, 0.055, 0, 0, Math.PI / 2));
  } else {                                        /* a ball, on a little ring */
    const c = pick(rnd, ["#d05a72", "#4f92c4", "#e0b03c", "#6fb07a"]);
    const b = new T.Mesh(new T.SphereGeometry(0.06, 12, 9), flat(c));
    g.add(at(b, 0, 0.062, 0));
    const band = new T.Mesh(new T.TorusGeometry(0.06, 0.011, 5, 14), flat("#efe4cc"));
    g.add(at(band, 0, 0.062, 0, 0, 0, 0.4));
    const ring = new T.Mesh(new T.TorusGeometry(0.035, 0.008, 5, 12), flat("#8a6a4a"));
    g.add(at(ring, 0, 0.008, 0, Math.PI / 2));
  }
  g.scale.setScalar(s);
  return g;
};

/* --- wall grates, four builds -------------------------------------- */
KIT.grate = function (v, rnd, w, h) {
  const g = new T.Group();
  const W = w || [0.6, 0.46, 0.75, 0.52][v % 4];
  const H = h || [0.4, 0.46, 0.34, 0.4][v % 4];
  const fm = mat("metal", 1, 1, "#7c848c");
  /* frame — four solid members, mitred by overlap, plus a recessed back */
  g.add(sb(W, 0.05, 0.05, fm, 0,  H / 2, 0));
  g.add(sb(W, 0.05, 0.05, fm, 0, -H / 2, 0));
  g.add(sb(0.05, H, 0.05, fm, -W / 2, 0, 0));
  g.add(sb(0.05, H, 0.05, fm,  W / 2, 0, 0));
  g.add(sb(W - 0.06, H - 0.06, 0.02, flat("#0a0b0d"), 0, 0, -0.045));
  /* louvres, angled, each one a solid with a lit top edge and a dark under */
  const n = v % 4 === 1 ? 7 : 5;
  for (let i = 0; i < n; i++) {
    const y = -H / 2 + 0.06 + i * ((H - 0.12) / (n - 1));
    g.add(sb(W - 0.08, 0.035, 0.045, fm, 0, y, -0.005, 0, -0.55));
  }
  /* four screws, because it is bolted to a wall */
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const s = new T.Mesh(new T.CylinderGeometry(0.011, 0.011, 0.018, 6), flat("#9aa2aa"));
    g.add(at(s, sx * (W / 2 - 0.022), sy * (H / 2 - 0.022), 0.03, Math.PI / 2));
  }
  return g;
};

/* --- what hangs on a wall, five builds ----------------------------- */
KIT.decor = function (v, rnd) {
  const g = new T.Group();
  const k = v % 5;
  if (k === 0) {                          /* a framed shop notice */
    const W = range(rnd, 0.4, 0.6), H = range(rnd, 0.3, 0.46);
    const fm = mat("woodDark", 1, 1, "#a07c50");
    g.add(sb(W, 0.045, 0.045, fm, 0, H / 2, 0));
    g.add(sb(W, 0.045, 0.045, fm, 0, -H / 2, 0));
    g.add(sb(0.045, H, 0.045, fm, -W / 2, 0, 0));
    g.add(sb(0.045, H, 0.045, fm, W / 2, 0, 0));
    g.add(sb(W - 0.05, H - 0.05, 0.014, flat("#c8b892"), 0, 0, -0.012));
    /* three bands of "print", raised, so it is not a painted rectangle */
    for (let i = 0; i < 3; i++) {
      g.add(sb((W - 0.16) * range(rnd, 0.5, 1), 0.022, 0.006, flat("#4a3f34"), 0, H / 4 - i * (H / 4), 0));
    }
  } else if (k === 1) {                   /* a wall clock, hands and all */
    const r = range(rnd, 0.15, 0.2);
    const case_ = new T.Mesh(new T.CylinderGeometry(r, r * 0.96, 0.07, 20), mat("woodDark", 1, 1, "#8a6a48"));
    g.add(at(case_, 0, 0, 0, Math.PI / 2));
    const face = new T.Mesh(new T.CylinderGeometry(r * 0.86, r * 0.86, 0.012, 20), flat("#ddd2b4"));
    g.add(at(face, 0, 0, 0.04, Math.PI / 2));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      g.add(sb(0.012, 0.03, 0.008, flat("#2e2620"), Math.sin(a) * r * 0.7, Math.cos(a) * r * 0.7, 0.048, 0, 0, -a));
    }
    g.add(sb(0.014, r * 0.5, 0.01, flat("#241e18"), 0, r * 0.2, 0.056, 0, 0, 0.5));
    g.add(sb(0.011, r * 0.68, 0.01, flat("#241e18"), -r * 0.2, -r * 0.16, 0.058, 0, 0, 2.2));
    const hub = new T.Mesh(new T.SphereGeometry(0.018, 8, 6), flat("#c8a860"));
    g.add(at(hub, 0, 0, 0.06));
  } else if (k === 2) {                   /* a corner bracket shelf with one thing on it */
    const wm = mat("woodShelf", 1, 1, "#b08c60");
    g.add(sb(0.5, 0.035, 0.2, wm, 0, 0, 0.09));
    for (const sx of [-1, 1]) {
      g.add(sb(0.022, 0.13, 0.16, wm, sx * 0.19, -0.08, 0.07, 0, 0, 0));
      g.add(sb(0.022, 0.2, 0.022, wm, sx * 0.19, -0.075, 0.155, 0, -0.7));
    }
    const t = KIT.toy((rnd() * 6) | 0, rnd);
    at(t, range(rnd, -0.1, 0.1), 0.018, 0.09, 0, range(rnd, 0, TAU), 0);
    const s = contactShadow(t, { y: 0.018, opacity: 0.35, spread: 0.8 });
    if (s) g.add(s);
    g.add(t);
  } else if (k === 3) {                   /* a fire point: extinguisher on a bracket */
    const br = mat("metal", 1, 1, "#6a727a");
    g.add(sb(0.14, 0.03, 0.09, br, 0, 0.12, 0.05));
    g.add(sb(0.14, 0.03, 0.09, br, 0, -0.14, 0.05));
    const body = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.34, 12), flat("#a83c34"));
    g.add(at(body, 0, -0.02, 0.075));
    const dome = new T.Mesh(new T.SphereGeometry(0.055, 12, 6, 0, TAU, 0, Math.PI / 2), flat("#a83c34"));
    g.add(at(dome, 0, 0.15, 0.075));
    const nk = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.06, 8), flat("#4a4a50"));
    g.add(at(nk, 0, 0.19, 0.075));
    g.add(sb(0.09, 0.02, 0.02, flat("#c8b038"), 0.04, 0.21, 0.075, 0, 0, 0.2));
  } else {                                /* bunting, as real triangles on a real string */
    const n = 7;
    const cord = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 1.5, 5), flat("#8a7a5a"));
    g.add(at(cord, 0, 0, 0, 0, 0, Math.PI / 2));
    const cols = ["#d05a6c", "#e0b44c", "#5f9ec4", "#78b08a", "#c98ac0"];
    for (let i = 0; i < n; i++) {
      const x = -0.66 + i * (1.32 / (n - 1));
      const sag = Math.sin((i / (n - 1)) * Math.PI) * 0.06;
      const f = new T.Mesh(new T.ConeGeometry(0.07, 0.15, 3), flat(cols[i % 5]));
      g.add(at(f, x, -0.09 - sag, 0.012, Math.PI, 0, range(rnd, -0.2, 0.2)));
    }
  }
  return g;
};

/* --- light fittings ------------------------------------------------ */
KIT.bulb = function (kind, tint) {
  const g = new T.Group();
  if (kind === "pendant") {
    const flex = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.5, 5), flat("#2a2620"));
    g.add(at(flex, 0, 0.25, 0));
    const rose = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 0.035, 10), flat("#3a332a"));
    g.add(at(rose, 0, 0.5, 0));
    const shade = new T.Mesh(new T.ConeGeometry(0.19, 0.16, 14, 1, true), flat(tint || "#7a6a52", { side: T.DoubleSide }));
    g.add(at(shade, 0, 0.04, 0));
    const b = new T.Mesh(new T.SphereGeometry(0.045, 10, 8), glow("#ffe7bd"));
    b.userData.lamp = true;
    g.add(at(b, 0, -0.03, 0));
  } else if (kind === "strip") {
    const body = sb(1.25, 0.09, 0.16, mat("metal", 1, 1, "#7a828a"), 0, 0.045, 0);
    g.add(body);
    const t = sb(1.12, 0.03, 0.1, glow("#e8f0ff"), 0, -0.01, 0);
    t.userData.lamp = true;
    g.add(t);
    for (const sx of [-1, 1]) g.add(sb(0.05, 0.14, 0.18, mat("metal", 1, 1, "#6a7078"), sx * 0.61, 0.03, 0));
    for (const sx of [-1, 1]) {
      const ch = new T.Mesh(new T.CylinderGeometry(0.005, 0.005, 0.22, 4), flat("#4a4e54"));
      g.add(at(ch, sx * 0.45, 0.2, 0));
    }
  } else if (kind === "sconce") {
    g.add(sb(0.1, 0.16, 0.05, mat("metal", 1, 1, "#6a6258"), 0, 0, 0.025));
    const cup = new T.Mesh(new T.CylinderGeometry(0.11, 0.05, 0.13, 12, 1, true), flat(tint || "#8a7452", { side: T.DoubleSide }));
    g.add(at(cup, 0, 0.09, 0.11, 0.4));
    const b = new T.Mesh(new T.SphereGeometry(0.038, 8, 6), glow("#ffdcae"));
    b.userData.lamp = true;
    g.add(at(b, 0, 0.09, 0.11));
  } else {                                 /* a desk lamp with an arm */
    const gm = mat("enamelGreen", 1, 1, "#43604f");
    const base = new T.Mesh(new T.CylinderGeometry(0.1, 0.125, 0.035, 16), gm);
    g.add(at(base, 0, 0.018, 0));
    g.add(at(new T.Mesh(new T.CylinderGeometry(0.055, 0.09, 0.03, 16), gm), 0, 0.05, 0));
    const arm = new T.Mesh(new T.CylinderGeometry(0.015, 0.018, 0.44, 8), flat("#48524e"));
    g.add(at(arm, 0.05, 0.27, 0, 0, 0, -0.22));
    const joint = new T.Mesh(new T.SphereGeometry(0.028, 10, 8), flat("#5a6460"));
    g.add(at(joint, -0.005, 0.47, 0));
    /* a shade with a real rim and a lit inside, tipped down over the desk */
    const shade = part(-0.14, 0.44, 0);
    shade.rotation.z = 0.42;
    shade.add(at(new T.Mesh(new T.ConeGeometry(0.135, 0.17, 16, 1, true), mat("enamelGreen", 1, 1, "#3e5a4e", { side: T.DoubleSide })), 0, 0, 0));
    shade.add(at(new T.Mesh(new T.ConeGeometry(0.126, 0.155, 16, 1, true), glow("#ffe2b4", 0.9)), 0, 0.006, 0));
    shade.add(at(new T.Mesh(new T.TorusGeometry(0.132, 0.011, 6, 18), gm), 0, -0.085, 0, Math.PI / 2));
    g.add(shade);
    const b = new T.Mesh(new T.SphereGeometry(0.038, 10, 8), glow("#ffdba6"));
    b.userData.lamp = true;
    g.add(at(b, -0.16, 0.38, 0));
  }
  return g;
};

/* --- a length of wall, with holes in it where the doorways are ------
   Doorways are built as gaps between solid segments with real jambs and
   a lintel over the top, so you can see the wall's thickness through
   the opening. That thickness is what stops a room reading as a set of
   painted flats.
   ------------------------------------------------------------------ */
function wallRun(len, height, thick, material, openings, opts) {
  opts = opts || {};
  const g = new T.Group();
  const cuts = (openings || []).slice().sort((a, b) => a.x - b.x);
  let x = -len / 2;
  const segs = [];
  cuts.forEach((o) => {
    const a = o.x - o.w / 2, b = o.x + o.w / 2;
    if (a > x) segs.push([x, a]);
    /* lintel over the opening */
    if (o.h < height) g.add(sb(o.w, height - o.h, thick, material, o.x, o.h + (height - o.h) / 2, 0));
    /* and, for a window, the wall under the sill */
    if (o.y0) {
      g.add(sb(o.w, o.y0, thick, material, o.x, o.y0 / 2, 0));
      g.add(sb(o.w, 0.05, thick + 0.02, opts.jamb || material, o.x, o.y0 + 0.025, 0));
    }
    /* jambs — the visible edge of the wall, in a lighter dressing */
    const jm = opts.jamb || material;
    const y0 = o.y0 || 0;
    for (const s of [-1, 1]) {
      g.add(sb(0.04, o.h - y0, thick + 0.02, jm, o.x + s * (o.w / 2 - 0.02), y0 + (o.h - y0) / 2, 0));
    }
    g.add(sb(o.w, 0.05, thick + 0.02, jm, o.x, o.h - 0.025, 0));
    x = b;
  });
  if (x < len / 2) segs.push([x, len / 2]);
  segs.forEach(([a, b]) => {
    if (b - a < 0.002) return;
    g.add(sb(b - a, height, thick, material, (a + b) / 2, height / 2, 0));
  });
  /* skirting along the bottom and a picture rail near the top: two more
     solids, and the shadow they throw is what gives a wall its scale */
  if (opts.skirt !== false) {
    const sm = opts.skirtMat || mat("woodDark", 2, 0.3, "#5a4632");
    const skirtSegs = segs.concat(cuts.filter((o) => o.y0 > 0.2).map((o) => [o.x - o.w / 2, o.x + o.w / 2]));
    skirtSegs.forEach(([a, b]) => {
      if (b - a < 0.06) return;
      g.add(sb(b - a, 0.13, thick + 0.03, sm, (a + b) / 2, 0.065, 0));
      g.add(sb(b - a, 0.02, thick + 0.045, sm, (a + b) / 2, 0.13, 0));
    });
  }
  if (opts.rail) {
    const rm = opts.railMat || mat("woodShelf", 2, 0.2, "#9a7f5c");
    segs.forEach(([a, b]) => {
      if (b - a < 0.06) return;
      g.add(sb(b - a, 0.05, thick + 0.045, rm, (a + b) / 2, opts.rail, 0));
      g.add(sb(b - a, 0.022, thick + 0.03, rm, (a + b) / 2, opts.rail + 0.036, 0));
    });
  }
  return g;
}

/* --- ambient occlusion, painted rather than computed ---------------
   A gradient laid along the foot of every wall and up from it. It is
   two triangles and no maths per frame, and it does the job the racer's
   props never had done for them: it welds the geometry to the floor.
   ------------------------------------------------------------------ */
function aoGradient() {
  if (texCache.aoGrad) return texCache.aoGrad;
  const c = canvas(64);
  const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 64, 0, 0);
  gr.addColorStop(0, "rgba(0,0,0,.85)");
  gr.addColorStop(0.35, "rgba(0,0,0,.34)");
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = T.RepeatWrapping; t.wrapT = T.ClampToEdgeWrapping;
  texCache.aoGrad = t;
  return t;
}
function aoMat(strength) {
  const key = "ao|" + strength;
  if (matCache[key]) return matCache[key];
  const m = new T.MeshBasicMaterial({
    map: aoGradient(), transparent: true, depthWrite: false,
    opacity: strength, fog: false,
  });
  matCache[key] = m;
  return m;
}
/* one skirt of shade: `len` along X, reaching `depth` out from the wall
   at z = 0, lying on the floor at y */
function aoSkirt(len, depth, y, strength) {
  const m = new T.Mesh(new T.PlaneGeometry(len, depth), aoMat(strength === undefined ? 0.5 : strength));
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, (y || 0) + 0.004, depth / 2);
  m.renderOrder = -1;
  m.updateMatrix(); m.matrixAutoUpdate = false;
  return m;
}
/* and the matching one climbing the wall itself */
function aoRise(len, height, strength) {
  const m = new T.Mesh(new T.PlaneGeometry(len, height), aoMat(strength === undefined ? 0.42 : strength));
  m.position.set(0, height / 2, 0.01);
  m.updateMatrix(); m.matrixAutoUpdate = false;
  return m;
}

/* =========================================================
   11. THE SHELL

   Every room is a box of solids: a floor with thickness, a ceiling with
   thickness, four walls with thickness, skirting, and shade in the
   corners. `openings` cuts real doorways with visible jambs.
   ========================================================= */
function shell(opts) {
  const g = new T.Group();
  const W = opts.w, D = opts.d, H = opts.h || 3.0;
  const t = 0.16;

  /* floor — a slab, not a plane, so its edge shows in a doorway */
  g.add(sb(W + t * 2, t, D + t * 2, opts.floor, 0, -t / 2, 0));
  /* ceiling, and the joists under it where a room would have them */
  if (opts.ceiling !== false) {
    g.add(sb(W + t * 2, t, D + t * 2, opts.ceil || opts.wall, 0, H + t / 2, 0));
    if (opts.joists) {
      const jm = mat("woodDark", 1, 0.4, "#4a3a28");
      const n = Math.max(2, Math.round(D / 0.9));
      for (let i = 0; i < n; i++) {
        g.add(sb(W, 0.11, 0.07, jm, 0, H - 0.055, -D / 2 + (i + 0.5) * (D / n)));
      }
    }
  }

  const sides = [
    { k: "n", len: W, x: 0, z: -D / 2, ry: 0 },
    { k: "s", len: W, x: 0, z:  D / 2, ry: Math.PI },
    { k: "w", len: D, x: -W / 2, z: 0, ry: Math.PI / 2 },
    { k: "e", len: D, x:  W / 2, z: 0, ry: -Math.PI / 2 },
  ];
  sides.forEach((s) => {
    const run = wallRun(s.len, H, t, opts.wall, opts.openings && opts.openings[s.k], {
      rail: opts.rail, jamb: opts.jamb || opts.wall, skirtMat: opts.skirtMat,
    });
    run.position.set(s.x, 0, s.z);
    run.rotation.y = s.ry;
    g.add(run);
    /* the shade where that wall meets the floor */
    const ao = new T.Group();
    ao.position.set(s.x, 0, s.z);
    ao.rotation.y = s.ry;
    ao.add(aoSkirt(s.len, 0.55, 0, opts.aoFloor === undefined ? 0.5 : opts.aoFloor));
    ao.add(aoRise(s.len, 0.7, opts.aoWall === undefined ? 0.34 : opts.aoWall));
    g.add(ao);
  });
  return g;
}

/* =========================================================
   12. THE WORLD

   One scene. Every room is built once, in its own local space, and
   parked at its own address sixty metres from its neighbours, so no
   room's light can reach another and nothing has to be torn down and
   rebuilt when the view changes. Switching camera is: move one camera,
   re-point six lights, change the fog colour. Nothing else moves.
   ========================================================= */
const SPACING = 60;

/* three.js has been on physical light units since r155: a point light's
   intensity is candela, so the numbers a room asks for below are written
   in a readable 0-3 range and multiplied through here. One number to
   brighten or darken the whole shop, which is exactly what you want at
   two in the morning with a headache. */
const LUX = 11;

let renderer = null, scene = null, view = null;   // view = the one camera
const rooms = {};                                 // id -> room record
let rigAmbient = null;
const rig = [];                                   // the fixed pool of point lights
const RIG_N = 8;

function makeRoomRecord(id, index) {
  const g = new T.Group();
  g.position.set(index * SPACING, 0, 0);
  g.updateMatrix();
  g.matrixAutoUpdate = false;     // the address never changes
  const rec = {
    id, index, group: g,
    lights: [],          // {x,y,z,color,intensity,distance,decay,tag}
    cams:   {},          // name -> {pos:[], look:[], fov}
    anchors:{},          // name -> {x,y,z,ry}  — where the cast can stand
    fog:    { color: "#05060a", near: 2, far: 22 },
    ambient:{ color: "#20242e", intensity: 0.5 },
    live:   new T.Group(),   // the only branch of a room that may animate
  };
  rec.live.position.set(0, 0, 0);
  g.add(rec.live);
  rooms[id] = rec;
  return rec;
}

/* the little API a room builder is handed */
function roomAPI(rec) {
  return {
    id: rec.id,
    /* static: goes into the frozen branch */
    add(obj)      { rec.group.add(obj); freeze(obj); return obj; },
    place(obj, x, y, z, o) { return place(rec.group, obj, x, y, z, o); },
    /* animated: goes into the live branch, which keeps its auto-update */
    live(obj)     { rec.live.add(obj); return obj; },
    light(o)      { rec.lights.push(o); return o; },
    cam(name, pos, look, fov, o) {
      rec.cams[name] = Object.assign({ pos, look, fov: fov || 60 }, o || {});
    },
    anchor(name, x, y, z, ry) { rec.anchors[name] = { x, y, z, ry: ry || 0 }; },
    mood(o)       { if (o.fog) rec.fog = o.fog; if (o.ambient) rec.ambient = o.ambient; },
    rnd: rngFor("room:" + rec.id),
  };
}

/* world position of a room-local point */
function worldOf(rec, x, y, z, out) {
  out = out || new T.Vector3();
  return out.set(x + rec.index * SPACING, y, z);
}

/* --- pointing the one camera and the one light rig at a room ------- */
const _lookAt = new T.Vector3();

function useView(roomId, camName, opts) {
  opts = opts || {};
  const rec = rooms[roomId];
  if (!rec) return;
  const c = rec.cams[camName] || rec.cams.main;
  if (!c) return;
  const ox = rec.index * SPACING;
  view.fov = c.fov;
  view.position.set(c.pos[0] + ox, c.pos[1], c.pos[2]);
  _lookAt.set(c.look[0] + ox, c.look[1], c.look[2]);
  view.lookAt(_lookAt);
  view.updateProjectionMatrix();
  view.userData.base = { pos: view.position.clone(), quat: view.quaternion.clone() };

  /* the light rig follows. Six slots, always present, so the shader is
     compiled once and switching rooms never stalls on a recompile. */
  const L = rec.lights;
  for (let i = 0; i < RIG_N; i++) {
    const l = rig[i];
    const src = L[i];
    if (src) {
      l.position.set(src.x + ox, src.y, src.z);
      l.color.set(src.color);
      /* kept so the gallery and the dawn can warm a light up and hand it
         back exactly as it was, without a room change to reset it */
      l.userData.baseColor = src.color;
      l.userData.base = src.intensity * LUX;
      l.userData.tag = src.tag || "";
      l.intensity = l.userData.base;
      l.distance = src.distance || 9;
      l.decay = src.decay === undefined ? 1.6 : src.decay;
    } else {
      l.position.set(ox, -50, 0);
      l.userData.base = 0;
      l.userData.tag = "";
      l.intensity = 0;
    }
  }
  rigAmbient.color.set(rec.ambient.color);
  rigAmbient.userData.baseColor = rec.ambient.color;
  rigAmbient.intensity = rec.ambient.intensity;
  rigAmbient.userData.base = rec.ambient.intensity;
  scene.fog.color.set(rec.fog.color);
  scene.fog.near = rec.fog.near;
  scene.fog.far = rec.fog.far;
  if (renderer) renderer.setClearColor(new T.Color(rec.fog.color), 1);
  return rec;
}

/* =========================================================
   13. THE SECURITY OFFICE

   The room the whole game is played from, so it gets the most work.
   Six metres by five, one desk, two doorways with the wall's thickness
   showing through them, a duct grate up under the ceiling, and enough
   of somebody's night in it — a mug, a radio, a fan, a wind-up toy
   they have clearly been fiddling with — that it reads as a place a
   person sits rather than a menu with a floor.
   ========================================================= */
const OFFICE = { W: 6.6, D: 5.0, H: 2.9, doorZ: -0.9, doorW: 1.15, doorH: 2.15 };

function buildOffice(R) {
  const { W, D, H, doorZ, doorW, doorH } = OFFICE;
  const rnd = R.rnd;

  const wallM  = mat("wallOffice", 2.2, 1.1, "#9c8f78");
  const jambM  = mat("woodDark", 0.6, 0.6, "#7a5f42");
  const floorM = mat("floorOffice", 5, 5, "#b2a693");
  const ceilM  = mat("wallOffice", 3, 3, "#6a6152");

  R.add(freeze(shell({
    w: W, d: D, h: H,
    floor: floorM, wall: wallM, ceil: ceilM, jamb: jambM,
    rail: 1.06,
    openings: {
      w: [{ x: -doorZ, w: doorW, h: doorH }],
      e: [{ x:  doorZ, w: doorW, h: doorH }],
      n: [{ x: -1.75, w: 1.62, h: 2.24, y0: 1.02 }],
    },
    aoFloor: 0.55, aoWall: 0.36,
  })));

  /* --- the corridor stubs beyond each doorway ---------------------
     Without them a doorway is a hole onto nothing and the room reads
     as a stage flat. Each stub is a real little box of walls and floor
     with its own light, so a shape standing in it is a silhouette. */
  [-1, 1].forEach((s) => {
    const stub = new T.Group();
    const sm = mat(s < 0 ? "wallCream" : "wallPaper", 1.4, 1, s < 0 ? "#7d7260" : "#7a7060");
    stub.add(sb(2.2, 0.14, 2.0, mat("floorTile", 3, 3, "#7f766a"), 0, -0.07, 0));
    stub.add(sb(2.2, 2.5, 0.14, sm, 0, 1.25, -1.0));
    stub.add(sb(2.2, 2.5, 0.14, sm, 0, 1.25,  1.0));
    stub.add(sb(0.14, 2.5, 2.0, sm, s * 1.1, 1.25, 0));
    stub.add(sb(2.2, 0.14, 2.0, ceilM, 0, 2.55, 0));
    /* skirting in the stub too — the eye reads the join */
    for (const z of [-1, 1]) stub.add(sb(2.2, 0.13, 0.05, mat("woodDark", 1, 0.3, "#54402c"), 0, 0.065, z * 0.92));
    R.place(freeze(stub), s * (W / 2 + 1.0), 0, doorZ, { shadow: false });
  });

  /* --- the desk --------------------------------------------------- */
  const deskZ = 1.18;
  const desk = new T.Group();
  const topM = mat("woodShelf", 1.6, 0.8, "#a8825a");
  const carM = mat("enamelCream", 1, 1, "#8f8674");
  desk.add(sb(2.35, 0.055, 0.8, topM, 0, 0.755, 0));            // top
  desk.add(sb(2.35, 0.03, 0.06, mat("woodDark", 1, 1, "#6a4f34"), 0, 0.715, 0.4));  // front lip
  desk.add(sb(2.2, 0.42, 0.03, carM, 0, 0.5, -0.36));            // modesty panel
  /* two pedestals, with drawer fronts that are proud of the carcass */
  [-1, 1].forEach((s) => {
    const p = part(s * 0.83, 0, 0);
    p.add(sb(0.52, 0.72, 0.74, carM, 0, 0.36, 0));
    for (let i = 0; i < 3; i++) {
      const y = 0.16 + i * 0.22;
      p.add(sb(0.5, 0.19, 0.03, mat("enamelCream", 1, 1, "#9a9280"), 0, y, 0.375));
      const h = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.16, 6), flat("#b8a878"));
      p.add(at(h, 0, y, 0.4, 0, 0, Math.PI / 2));
    }
    p.add(sb(0.54, 0.05, 0.76, carM, 0, 0.735, 0));
    desk.add(p);
  });
  /* the desk's own feet, so the carcass is not sitting in the carpet */
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
    desk.add(sb(0.06, 0.03, 0.06, flat("#2a2620"), sx * 1.05, 0.015, sz * 0.32));
  }));
  R.place(freeze(desk), 0, 0, deskZ, { shadowOpacity: 0.7 });

  /* --- the monitor, which is also half the light in the room ------ */
  const mon = new T.Group();
  mon.add(sb(0.62, 0.5, 0.52, mat("enamelCream", 1, 1, "#8a8070"), 0, 0.27, -0.06));
  mon.add(sb(0.56, 0.44, 0.05, flat("#2a2822"), 0, 0.3, 0.2));
  const face = sb(0.47, 0.35, 0.02, new T.MeshBasicMaterial({ map: TX.crt, fog: true }), 0, 0.3, 0.225);
  face.userData.screen = "office";
  mon.add(face);
  mon.add(sb(0.62, 0.06, 0.5, mat("enamelCream", 1, 1, "#7a7264"), 0, 0.03, -0.05));
  for (let i = 0; i < 3; i++) {
    const k = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 0.02, 8), flat("#4a463c"));
    mon.add(at(k, -0.18 + i * 0.09, 0.05, 0.21, Math.PI / 2));
  }
  R.place(freeze(mon), 1.04, 0.785, deskZ - 0.26, { ry: -0.55, s: 0.9, shadowOpacity: 0.5 });

  /* --- desk lamp, radio, fan, mug, paperwork ---------------------- */
  R.place(freeze(KIT.bulb("desk")), -1.02, 0.785, deskZ - 0.3, { ry: 1.9, shadowOpacity: 0.45 });

  const radio = new T.Group();
  radio.add(sb(0.36, 0.2, 0.15, mat("woodDark", 1, 1, "#8a6742"), 0, 0.1, 0));
  radio.add(sb(0.19, 0.13, 0.02, flat("#3b3229"), -0.07, 0.11, 0.076));
  for (let i = 0; i < 7; i++) radio.add(sb(0.17, 0.008, 0.012, flat("#5e5346"), -0.07, 0.055 + i * 0.016, 0.084));
  radio.add(sb(0.12, 0.05, 0.015, glow("#c8a24a", 0.9), 0.1, 0.14, 0.078));
  for (let i = 0; i < 2; i++) {
    const k = new T.Mesh(new T.CylinderGeometry(0.022, 0.024, 0.02, 10), flat("#c0a878"));
    radio.add(at(k, 0.06 + i * 0.08, 0.055, 0.08, Math.PI / 2));
  }
  radio.add(sb(0.01, 0.26, 0.01, flat("#b0b4b8"), 0.16, 0.32, -0.04, 0, 0, 0.22));
  R.place(freeze(radio), -1.0, 0.785, deskZ + 0.16, { ry: 0.6, shadowOpacity: 0.5 });

  /* the fan turns, so it is the one thing on the desk that lives in the
     animated branch. Everything else here is frozen. */
  const fanBase = new T.Group();
  fanBase.add(sb(0.2, 0.03, 0.16, mat("enamelBlue", 1, 1, "#5a6e84"), 0, 0.015, 0));
  const stem = new T.Mesh(new T.CylinderGeometry(0.018, 0.022, 0.2, 8), flat("#4e6076"));
  fanBase.add(at(stem, 0, 0.12, 0));
  const hub = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.06, 12), mat("enamelBlue", 1, 1, "#5a6e84"));
  fanBase.add(at(hub, 0, 0.25, 0.02, Math.PI / 2));
  for (let i = 0; i < 4; i++) {
    const r = new T.Mesh(new T.TorusGeometry(0.045 + i * 0.024, 0.0035, 4, 18), flat("#8a9098"));
    fanBase.add(at(r, 0, 0.25, 0.06));
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    fanBase.add(sb(0.006, 0.19, 0.006, flat("#8a9098"), Math.sin(a) * 0.0, 0.25, 0.06, 0, 0, a));
  }
  R.place(freeze(fanBase), 1.44, 0.785, deskZ + 0.1, { ry: -0.5, shadowOpacity: 0.45 });
  const blades = new T.Group();
  for (let i = 0; i < 4; i++) {
    const holder = new T.Group();
    holder.rotation.z = (i / 4) * TAU;
    /* each blade is pitched, so the fan reads as a fan and not a cross */
    holder.add(at(sb(0.15, 0.06, 0.014, flat("#c0c6cc"), 0, 0, 0), 0.085, 0, 0, 0.5));
    blades.add(holder);
  }
  blades.add(at(new T.Mesh(new T.SphereGeometry(0.026, 8, 6), flat("#8a9098")), 0, 0, 0));
  blades.position.set(1.44, 1.035, deskZ + 0.16);
  blades.userData.spin = true;
  R.live(blades);

  /* mug, pen pot, clipboard, and the wind-up toy somebody left out */
  const mug = new T.Group();
  const cup = new T.Mesh(new T.CylinderGeometry(0.043, 0.037, 0.095, 14), flat("#c8d0c4"));
  mug.add(at(cup, 0, 0.048, 0));
  const tea = new T.Mesh(new T.CylinderGeometry(0.038, 0.038, 0.005, 14), flat("#5a4028"));
  mug.add(at(tea, 0, 0.082, 0));
  const hnd = new T.Mesh(new T.TorusGeometry(0.03, 0.008, 5, 12), flat("#c8d0c4"));
  mug.add(at(hnd, 0.05, 0.05, 0, 0, Math.PI / 2));
  R.place(freeze(mug), 0.06, 0.785, deskZ + 0.16, { shadowOpacity: 0.55 });

  const pot = new T.Group();
  const pc = new T.Mesh(new T.CylinderGeometry(0.042, 0.036, 0.1, 10), mat("enamelGreen", 1, 1, "#6a8878"));
  pot.add(at(pc, 0, 0.05, 0));
  for (let i = 0; i < 4; i++) {
    const p = new T.Mesh(new T.CylinderGeometry(0.005, 0.005, 0.16, 5), flat(["#d05a5a", "#3f6fa0", "#e0b040", "#2e2e34"][i]));
    pot.add(at(p, range(rnd, -0.02, 0.02), 0.12, range(rnd, -0.02, 0.02), range(rnd, -0.16, 0.16), 0, range(rnd, -0.2, 0.2)));
  }
  R.place(freeze(pot), 0.92, 0.785, deskZ + 0.12, { shadowOpacity: 0.5 });

  const clip = new T.Group();
  clip.add(sb(0.22, 0.012, 0.3, flat("#8a6a44"), 0, 0.006, 0));
  clip.add(sb(0.2, 0.008, 0.27, flat("#d8cfb4"), 0, 0.016, 0.005));
  clip.add(sb(0.09, 0.02, 0.035, flat("#9aa0a6"), 0, 0.026, -0.13));
  for (let i = 0; i < 5; i++) clip.add(sb(0.13, 0.002, 0.006, flat("#6a6152"), -0.01, 0.021, -0.06 + i * 0.045));
  R.place(freeze(clip), -0.28, 0.785, deskZ + 0.22, { ry: -0.22, shadowOpacity: 0.45 });

  const toy = KIT.toy(4, rnd);
  R.place(freeze(toy), 0.36, 0.785, deskZ + 0.18, { ry: -0.9, s: 1.1, shadowOpacity: 0.5 });

  /* --- the meter and the three lamps: the office's own instruments --
     Deliberately physical. The overlay HUD says the number; this says
     it the way a 1931 shop fitting would, with a needle that wobbles. */
  const gauge = new T.Group();
  gauge.add(sb(0.44, 0.3, 0.14, mat("enamelGreen", 1, 1, "#5e7468"), 0, 0.15, 0));
  gauge.add(sb(0.38, 0.24, 0.02, flat("#e4dcc0"), 0, 0.16, 0.072));
  gauge.add(sb(0.42, 0.03, 0.03, flat("#c0a860"), 0, 0.295, 0.06));
  for (let i = 0; i <= 8; i++) {
    const a = -1.05 + (i / 8) * 2.1;
    gauge.add(sb(i % 4 === 0 ? 0.012 : 0.007, i % 4 === 0 ? 0.035 : 0.022, 0.006,
      flat(i < 2 ? "#a83c34" : "#3a352c"),
      Math.sin(a) * 0.115, 0.14 + Math.cos(a) * 0.115, 0.082, 0, 0, -a));
  }
  R.place(freeze(gauge), -0.52, 0.785, deskZ - 0.32, { ry: 0.2, shadowOpacity: 0.55 });
  const needle = new T.Group();
  needle.add(at(sb(0.008, 0.12, 0.005, flat("#b03c30"), 0, 0.06, 0)));
  const nhub = new T.Mesh(new T.SphereGeometry(0.016, 8, 6), flat("#c8b070"));
  needle.add(at(nhub, 0, 0, 0.004));
  const needleHolder = new T.Group();
  needleHolder.position.set(-0.52, 0.925, deskZ - 0.32);
  needleHolder.rotation.y = 0.2;
  needle.position.set(0, 0, 0.086);
  needleHolder.add(needle);
  needleHolder.userData.needle = needle;
  R.live(needleHolder);

  /* the three status lamps, in a brass strip */
  const lampStrip = new T.Group();
  lampStrip.add(sb(0.54, 0.075, 0.14, mat("metal", 1, 1, "#a2905e"), 0, 0.038, 0));
  lampStrip.add(sb(0.5, 0.03, 0.1, flat("#2f2a22"), 0, 0.09, -0.012, 0, -0.5));
  const lampMeshes = [];
  ["left", "right", "hatch"].forEach((k, i) => {
    lampStrip.add(sb(0.09, 0.02, 0.09, flat("#6a5c40"), -0.17 + i * 0.17, 0.08, 0.012));
    const cap = new T.Mesh(new T.SphereGeometry(0.04, 12, 9, 0, TAU, 0, Math.PI / 2), glow("#3a2a26"));
    at(cap, -0.17 + i * 0.17, 0.088, 0.012);
    cap.userData.statusLamp = k;
    lampMeshes.push(cap);
    lampStrip.add(cap);
  });
  lampStrip.position.set(0.16, 0.785, deskZ - 0.32);
  lampStrip.rotation.y = -0.08;
  R.live(lampStrip);

  /* --- whose desk this is -----------------------------------------
     A brass plate with her name on it, screwed to the front edge where
     anyone coming through the door would read it. */
  const plate = new T.Group();
  plate.add(sb(0.42, 0.1, 0.02, mat("brass", 1, 1, "#c8a260"), 0, 0, 0));
  plate.add(sb(0.38, 0.062, 0.008, flat("#3a2f22"), 0, 0, 0.014));
  for (let i = 0; i < 6; i++) {
    plate.add(sb(0.028, 0.03, 0.006, mat("brass", 1, 1, "#e0c078"), -0.13 + i * 0.052, 0, 0.02));
  }
  for (const sx of [-1, 1]) {
    plate.add(at(new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.016, 6), mat("brass", 1, 1, "#b8945a")), sx * 0.185, 0, 0.02, Math.PI / 2));
  }
  R.place(freeze(plate), 0, 0.7, deskZ + 0.4, { shadow: false });

  /* and her own photograph, taped to the corkboard where the last one
     put theirs */
  const photo = new T.Group();
  photo.add(sb(0.2, 0.24, 0.012, flat("#f2ead8"), 0, 0, 0));
  photo.add(at(new T.Mesh(new T.PlaneGeometry(0.17, 0.19), new T.MeshBasicMaterial({ map: TX.oui, fog: true })), 0, 0.012, 0.008));
  photo.add(sb(0.06, 0.03, 0.006, flat("#d8c9a4"), 0.03, 0.13, 0.01, 0, 0, 0.5));
  R.place(freeze(photo), 1.44, 1.48, -D / 2 + 0.16, { ry: -0.06, shadow: false });

  /* --- the north wall: window, corkboard, filing cabinet, duct ----- */
  const win = new T.Group();
  const fm = mat("woodDark", 1, 1, "#6e5236");
  win.add(sb(1.7, 0.1, 0.16, fm, 0, 0.6, 0));
  win.add(sb(1.7, 0.1, 0.16, fm, 0, -0.6, 0));
  win.add(sb(0.1, 1.3, 0.16, fm, -0.85, 0, 0));
  win.add(sb(0.1, 1.3, 0.16, fm, 0.85, 0, 0));
  win.add(sb(0.07, 1.2, 0.12, fm, 0, 0, 0));
  win.add(sb(1.6, 0.06, 0.12, fm, 0, 0, 0));
  win.add(sb(1.8, 0.09, 0.24, fm, 0, -0.66, 0.05));                 // sill, proud of the wall
  /* the glass: the one plane besides shadows, and it is glass */
  const glass = new T.Mesh(new T.PlaneGeometry(1.72, 1.3), new T.MeshBasicMaterial({
    map: TX.night, fog: true,
  }));
  win.add(at(glass, 0, 0, -0.15));
  /* bars outside it, because the shop has a window onto an alley */
  for (let i = 0; i < 5; i++) win.add(sb(0.026, 1.24, 0.026, flat("#2e3238"), -0.6 + i * 0.3, 0, -0.09));
  R.place(freeze(win), -1.75, 1.62, -D / 2 + 0.09, { shadow: false });

  const cork = new T.Group();
  cork.add(sb(1.0, 0.66, 0.05, mat("woodShelf", 1, 1, "#8a6a44"), 0, 0, 0));
  cork.add(sb(0.92, 0.58, 0.02, flat("#a08050"), 0, 0, 0.03));
  const notes = ["#e8e0c4", "#d8c8a8", "#e4d8b8", "#cfc4a0", "#e8dcc0"];
  for (let i = 0; i < 6; i++) {
    const nx = range(rnd, -0.36, 0.36), ny = range(rnd, -0.2, 0.2);
    cork.add(sb(range(rnd, 0.14, 0.2), range(rnd, 0.12, 0.18), 0.006, flat(notes[i % 5]), nx, ny, 0.043, 0, 0, range(rnd, -0.14, 0.14)));
    const pin = new T.Mesh(new T.SphereGeometry(0.012, 6, 5), flat(["#c8443c", "#3f7fb0", "#e0b040"][i % 3]));
    cork.add(at(pin, nx, ny + 0.06, 0.052));
  }
  R.place(freeze(cork), 1.25, 1.62, -D / 2 + 0.06, { shadow: false });

  const cab = new T.Group();
  const cm = mat("enamelGreen", 0.8, 1.4, "#6a7a68");
  cab.add(sb(0.5, 1.3, 0.62, cm, 0, 0.65, 0));
  for (let i = 0; i < 3; i++) {
    cab.add(sb(0.46, 0.38, 0.04, mat("enamelGreen", 1, 1, "#78886e"), 0, 0.24 + i * 0.42, 0.32));
    cab.add(sb(0.14, 0.035, 0.05, flat("#b8ac84"), 0, 0.24 + i * 0.42, 0.35));
    cab.add(sb(0.08, 0.05, 0.012, flat("#d8cfb0"), -0.13, 0.35 + i * 0.42, 0.345));
  }
  cab.add(sb(0.54, 0.045, 0.66, cm, 0, 1.32, 0));
  cab.add(sb(0.46, 0.06, 0.58, flat("#2a2b28"), 0, 0.03, 0));
  const cbox = KIT.crate(2, rnd);
  at(cbox, 0, 1.34, 0, 0, 0.3, 0);
  cab.add(cbox);
  const cs = contactShadow(cbox, { y: 1.343, opacity: 0.45 });
  if (cs) cab.add(cs);
  R.place(freeze(cab), -2.85, 0, -D / 2 + 0.5, { ry: 0.06, shadowOpacity: 0.72 });

  /* the duct, and the grate the owl comes to */
  const duct = new T.Group();
  const dm = mat("metal", 1.5, 0.6, "#7a828a");
  duct.add(sb(2.6, 0.42, 0.44, dm, 0, 0, 0));
  for (let i = 0; i < 4; i++) duct.add(sb(0.05, 0.48, 0.5, dm, -1.0 + i * 0.66, 0, 0));
  for (const sx of [-1, 1]) {
    const st = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.22, 5), flat("#5a6068"));
    duct.add(at(st, sx * 0.9, 0.3, 0));
  }
  R.place(freeze(duct), 1.9, 2.66, -D / 2 + 1.35, { ry: Math.PI / 2, shadow: false });
  /* the elbow that drops the run onto the grate */
  const elbow = new T.Group();
  elbow.add(sb(0.5, 0.5, 0.48, dm, 0, 0, 0));
  elbow.add(sb(0.56, 0.06, 0.54, mat("metal", 1, 1, "#5e666e"), 0, 0.25, 0));
  R.place(freeze(elbow), 1.9, 2.5, -D / 2 + 0.32, { shadow: false });

  const grate = KIT.grate(2, rnd, 0.86, 0.56);
  R.place(freeze(grate), 1.9, 2.16, -D / 2 + 0.06, { shadow: false });
  R.anchor("hatch", 1.9, 1.86, -D / 2 - 0.36, 0);

  /* the dark behind the grate, so something can be seen moving in it */
  const ductVoid = sb(0.96, 0.66, 0.5, flat("#07080b"), 1.9, 2.16, -D / 2 - 0.28);
  R.add(freeze(ductVoid));

  /* --- side walls, corners, floor clutter -------------------------- */
  R.place(freeze(KIT.decor(1, rnd)), -W / 2 + 0.1, 1.85, 1.5, { ry: Math.PI / 2, shadow: false });
  R.place(freeze(KIT.decor(3, rnd)),  W / 2 - 0.1, 1.5, 1.4, { ry: -Math.PI / 2, shadow: false });
  R.place(freeze(KIT.decor(0, rnd)),  W / 2 - 0.1, 1.72, -1.9, { ry: -Math.PI / 2, shadow: false });
  R.place(freeze(KIT.decor(2, rnd)), -W / 2 + 0.1, 1.5, -1.9, { ry: Math.PI / 2, shadow: false });

  const bin = new T.Group();
  const bb = new T.Mesh(new T.CylinderGeometry(0.15, 0.12, 0.34, 12, 1, true), mat("metal", 1, 1, "#6a7078", { side: T.DoubleSide }));
  bin.add(at(bb, 0, 0.17, 0));
  bin.add(sb(0.22, 0.02, 0.22, flat("#2e3238"), 0, 0.01, 0));
  for (let i = 0; i < 3; i++) {
    const p = new T.Mesh(new T.SphereGeometry(range(rnd, 0.04, 0.06), 6, 5), flat("#d8cfb0"));
    bin.add(at(p, range(rnd, -0.07, 0.07), 0.3 + i * 0.03, range(rnd, -0.07, 0.07)));
  }
  R.place(freeze(bin), -2.55, 0, 1.55, { shadowOpacity: 0.68 });

  const stack = new T.Group();
  for (let i = 0; i < 3; i++) {
    const c = KIT.crate(i % 3, rnd);
    at(c, range(rnd, -0.05, 0.05), i * 0.36, range(rnd, -0.05, 0.05), 0, range(rnd, -0.4, 0.4), 0);
    stack.add(c);
    if (i > 0) { const s2 = contactShadow(c, { y: i * 0.36, opacity: 0.4 }); if (s2) stack.add(s2); }
  }
  R.place(freeze(stack), 2.72, 0, 1.7, { ry: -0.3, shadowOpacity: 0.75 });

  R.place(freeze(KIT.chair(1, rnd)), 2.5, 0, -1.9, { ry: 0.7, shadowOpacity: 0.7 });

  /* a cable from the desk to the wall, in three real segments */
  const cable = new T.Group();
  const cm2 = flat("#22242a");
  cable.add(at(new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 1.1, 5), cm2), 0.5, 0.012, 0.3, 0, 0, Math.PI / 2));
  cable.add(at(new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.9, 5), cm2), -0.05, 0.012, -0.15, Math.PI / 2, 0, 0));
  cable.add(at(new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.4, 5), cm2), -0.05, 0.2, -0.6, 0, 0, 0));
  R.place(freeze(cable), -0.4, 0, 0.7, { shadow: false });

  /* --- the shelf that fills up -------------------------------------
     Ten small things on a bracket shelf by the right-hand door, one for
     each night cleared and each badge earned, and every one of them
     built at boot and simply not shown yet. Progress you can see from
     the chair beats progress on a statistics screen. */
  const trophyShelf = new T.Group();
  const tsm = mat("woodShelf", 1.2, 0.5, "#b08c60");
  trophyShelf.add(sb(1.2, 0.04, 0.2, tsm, 0, 0, 0.09));
  trophyShelf.add(sb(1.2, 0.05, 0.025, tsm, 0, -0.02, 0.18));
  for (const sx of [-1, 1]) {
    trophyShelf.add(sb(0.022, 0.14, 0.18, tsm, sx * 0.55, -0.08, 0.07));
    trophyShelf.add(sb(0.022, 0.18, 0.022, tsm, sx * 0.55, -0.07, 0.15, 0, -0.72));
  }
  R.place(freeze(trophyShelf), 0.1, 1.36, -D / 2 + 0.1, { shadow: false });

  const trophies = [];
  /* Counted, not guessed at: adding two badges quietly made this shelf
     two short of what the game can award, and the two nobody would
     ever see are the last two earned. */
  const SLOTS = NIGHTS.length + NS.badges.length;
  const gap = Math.min(0.088, 1.04 / SLOTS);
  for (let i = 0; i < SLOTS; i++) {
    const t = KIT.toy(i % 6, rngFor("trophy" + i));
    at(t, 0.1 - gap * (SLOTS - 1) / 2 + i * gap, 1.4,
       -D / 2 + 0.19 + (i % 2) * 0.015, 0, (i * 1.7) % TAU, 0, 0.8);
    t.visible = false;
    freeze(t);
    /* the pool each one will cast once it is standing there */
    const sh = contactShadow(t, { y: 1.4, opacity: 0.4, spread: 0.9 });
    if (sh) { sh.visible = false; R.live(sh); }
    t.matrixWorldAutoUpdate = false;
    R.live(t);
    trophies.push({ mesh: t, shadow: sh });
  }

  /* --- the picture that only hangs in daylight ----------------------
     The two of them, on the wall behind the desk. It is off during a
     shift and on in the gallery: nothing in this game is allowed to
     move it, shift it, or use it for a fright. */
  const usFrame = new T.Group();
  const fm2 = mat("woodDark", 1, 1, "#8a6a44");
  usFrame.add(sb(0.42, 0.05, 0.05, fm2, 0, 0.19, 0));
  usFrame.add(sb(0.42, 0.05, 0.05, fm2, 0, -0.19, 0));
  usFrame.add(sb(0.05, 0.43, 0.05, fm2, -0.19, 0, 0));
  usFrame.add(sb(0.05, 0.43, 0.05, fm2, 0.19, 0, 0));
  usFrame.add(at(new T.Mesh(new T.PlaneGeometry(0.34, 0.34), new T.MeshBasicMaterial({ map: TX.us, fog: true })), 0, 0, 0.01));
  usFrame.position.set(-2.4, 1.62, -D / 2 + 0.1);
  usFrame.rotation.y = 0.04;
  usFrame.visible = false;
  freeze(usFrame);
  usFrame.matrixWorldAutoUpdate = false;
  R.live(usFrame);

  /* --- the overhead bulb, which is on its way out ----------------- */
  const pend = KIT.bulb("pendant", "#6a5a44");
  pend.position.set(-0.35, 2.38, -0.45);
  pend.userData.pendant = true;
  R.live(pend);

  /* --- lighting ---------------------------------------------------
     Four pools and two spills. Nothing uniform: the desk is warm, the
     monitor is cold, the ceiling bulb is failing, and each doorway has
     just enough light beyond it to make a silhouette out of anything
     standing there. */
  R.light({ x: -0.9, y: 1.08, z: deskZ - 0.3, color: "#ffb765", intensity: 1.5, distance: 5.8, decay: 1.3, tag: "desk" });
  R.light({ x: 0.86, y: 1.22, z: deskZ - 0.06, color: "#79b6e2", intensity: 0.62, distance: 1.9, decay: 1.7, tag: "monitor" });
  R.light({ x: -0.35, y: 2.3, z: -0.45, color: "#ffd0a0", intensity: 1.5, distance: 7.4, decay: 1.35, tag: "pendant" });
  R.light({ x: -1.75, y: 1.5, z: -D / 2 + 0.75, color: "#7f9ad6", intensity: 0.8, distance: 4.8, decay: 1.6, tag: "window" });
  R.light({ x: -W / 2 - 0.7, y: 1.75, z: doorZ, color: "#ffc98a", intensity: 1.5, distance: 3.6, decay: 1.5, tag: "doorL" });
  R.light({ x:  W / 2 + 0.75, y: 1.8, z: doorZ, color: "#d9b9a4", intensity: 1.5, distance: 3.8, decay: 1.5, tag: "doorR" });

  R.mood({
    fog: { color: "#080a10", near: 3.5, far: 17 },
    ambient: { color: "#2b2c34", intensity: 0.5 },
  });

  /* --- the seat ---------------------------------------------------- */
  /* The seat. Back far enough, and high enough, that her own forearms
     are inside the bottom of the frame — a first-person guard whose
     hands are off screen is a floating camera, not a person. */
  R.cam("main", [0, 1.66, 2.36], [0, 1.0, -2.7], 74);

  /* where the cast stands when it gets here */
  R.anchor("s0",        -W / 2 - 0.62, 0, doorZ,  Math.PI / 2);
  R.anchor("s1",         W / 2 + 0.62, 0, doorZ, -Math.PI / 2);
  R.anchor("s2",         1.9, 1.86, -D / 2 - 0.36, 0);
  R.anchor("leftDoor",  -W / 2 - 0.62, 0, doorZ,  Math.PI / 2);
  R.anchor("rightDoor",  W / 2 + 0.62, 0, doorZ, -Math.PI / 2);
  R.anchor("leftHall",  -W / 2 - 1.5, 0, doorZ,  Math.PI / 2);
  R.anchor("rightHall",  W / 2 + 1.5, 0, doorZ, -Math.PI / 2);

  return { lampMeshes, needleHolder, blades, pend, face, trophies, usFrame, glass };
}

/* =========================================================
   14. THE DOORS AND THE HATCH

   Roller shutters, because a hinged door would have to swing through
   the doorway the thing is standing in. Each is a stack of real slats
   with a lip on every one, so the corrugation catches the doorway
   light as it comes down, and a bottom rail that lands with a bang.

   The shutter is the only geometry in the office that moves, and it
   moves in Y only. Its housing, guides and jambs are frozen.
   ========================================================= */
function buildOfficeDoors(R) {
  const { W, H, doorZ, doorW, doorH } = OFFICE;
  const out = {};

  ["left", "right"].forEach((side) => {
    const s = side === "left" ? -1 : 1;
    const x = s * (W / 2);

    /* housing and guides — static */
    const fixed = new T.Group();
    const hm = mat("metal", 1.2, 0.5, "#79818a");
    fixed.add(sb(0.3, 0.34, doorW + 0.34, hm, 0, doorH + 0.17, 0));
    fixed.add(sb(0.34, 0.06, doorW + 0.4, mat("metal", 1, 1, "#5e666e"), 0, doorH + 0.35, 0));
    for (const sz of [-1, 1]) {
      fixed.add(sb(0.16, doorH + 0.1, 0.08, hm, 0, (doorH + 0.1) / 2, sz * (doorW / 2 + 0.05)));
    }
    /* a warning stripe on the floor under it, painted on the threshold */
    const thr = sb(0.3, 0.02, doorW + 0.1, mat("enamelCream", 2, 1, "#b8a45c"), 0, 0.012, 0);
    fixed.add(thr);
    R.place(freeze(fixed), x, 0, doorZ, { shadow: false });

    /* the shutter — live */
    const sh = new T.Group();
    const slatM = mat("metal", 1.6, 0.35, "#8a929a");
    const N = 13;
    for (let i = 0; i < N; i++) {
      const y = 0.1 + i * ((doorH - 0.2) / (N - 1));
      sh.add(sb(0.075, 0.135, doorW + 0.02, slatM, 0, y, 0));
      sh.add(sb(0.11, 0.03, doorW + 0.02, mat("metal", 1, 1, "#a2aab2"), 0, y + 0.052, 0));
      sh.add(sb(0.09, 0.02, doorW + 0.02, flat("#3e444a"), 0, y - 0.062, 0));
    }
    sh.add(sb(0.12, 0.1, doorW + 0.06, mat("metal", 1, 1, "#6a727a"), 0, 0.05, 0));   // bottom rail
    sh.add(sb(0.14, 0.03, 0.2, flat("#b8a45c"), 0, 0.05, 0));                          // its grab handle
    sh.position.set(x, doorH + 0.12, doorZ);
    sh.userData.shutter = side;
    R.live(sh);
    out[side] = { mesh: sh, openY: doorH + 0.12, closedY: 0, y: doorH + 0.12 };
  });

  /* the hatch over the duct grate: a steel plate on a slide */
  const hx = 1.9, hy = 2.16, hz = -OFFICE.D / 2 + 0.15;
  const hFixed = new T.Group();
  const hm2 = mat("metal", 1, 1, "#6e767e");
  hFixed.add(sb(1.16, 0.09, 0.1, hm2, 0, 0.36, 0));
  hFixed.add(sb(1.16, 0.09, 0.1, hm2, 0, -0.36, 0));
  for (const sx of [-1, 1]) hFixed.add(sb(0.08, 0.8, 0.1, hm2, sx * 0.54, 0, 0));
  R.place(freeze(hFixed), hx, hy, hz, { shadow: false });

  const plate = new T.Group();
  plate.add(sb(0.98, 0.62, 0.05, mat("metal", 1, 1, "#98a0a8"), 0, 0, 0));
  for (let i = 0; i < 3; i++) plate.add(sb(0.9, 0.035, 0.02, mat("metal", 1, 1, "#767e86"), 0, -0.2 + i * 0.2, 0.034));
  plate.add(sb(0.16, 0.05, 0.06, flat("#b8a45c"), 0.36, 0, 0.05));
  plate.position.set(hx - 1.16, hy, hz);
  plate.userData.shutter = "hatch";
  R.live(plate);
  out.hatch = { mesh: plate, openX: hx - 1.16, closedX: hx, x: hx - 1.16 };

  return out;
}

/* =========================================================
   15. THE MAIN HALL

   Twelve metres of shop floor between the front of the building and
   the office door, and the route Cogsworth walks. It is built long and
   narrow on purpose: the camera sits above the office end, so anything
   coming reads first as a change in one of the pools of light and only
   afterwards as a shape.

   Nothing in here is reused from the office. Different floor, different
   wall, different ceiling, different fittings, different clutter.
   ========================================================= */
const HALL = { W: 5.0, D: 12.0, H: 3.25 };

function buildHall(R) {
  const { W, D, H } = HALL;
  const rnd = R.rnd;
  const wallM = mat("wallCream", 3.2, 1.2, "#9a8f76");
  const floorM = mat("floorCheck", 6, 16, "#9a9084");
  const ceilM = mat("wallCream", 4, 4, "#6e6656");

  R.add(freeze(shell({
    w: W, d: D, h: H,
    floor: floorM, wall: wallM, ceil: ceilM,
    jamb: mat("woodDark", 0.6, 0.6, "#71583c"),
    rail: 1.12,
    openings: {
      /* south end: the office. north end: the foyer arch.
         east wall: the stage and the arcade. */
      s: [{ x: 0.35, w: 1.15, h: 2.15 }],
      n: [{ x: 0, w: 2.4, h: 2.5 }],
      e: [{ x: -2.6, w: 1.5, h: 2.3 }, { x: 2.3, w: 1.4, h: 2.3 }],
    },
    aoFloor: 0.52, aoWall: 0.34,
  })));

  /* --- the runner: a real strip of carpet with a bound edge -------- */
  const runner = new T.Group();
  runner.add(sb(1.5, 0.022, D - 0.6, mat("floorCarpet", 2, 14, "#b07868"), 0, 0.011, 0));
  for (const sx of [-1, 1]) runner.add(sb(0.07, 0.03, D - 0.6, mat("woodDark", 0.4, 10, "#5e4436"), sx * 0.76, 0.015, 0));
  R.place(freeze(runner), -0.15, 0, 0.2, { shadow: false });

  /* --- display cases down the west wall, four different builds ----- */
  const caseZ = [-4.4, -1.9, 1.4, 4.0];
  caseZ.forEach((z, i) => {
    const c = new T.Group();
    const Wc = [1.6, 1.15, 1.9, 1.35][i], Hc = [1.35, 1.6, 1.2, 1.45][i], Dc = 0.55;
    const fm = mat(i % 2 ? "woodDark" : "woodShelf", 1, 1, i % 2 ? "#8a6a46" : "#b08a5c");
    /* plinth, frame, glass, top rail — a case, not a box */
    c.add(sb(Wc, 0.34, Dc, fm, 0, 0.17, 0));
    c.add(sb(Wc + 0.06, 0.05, Dc + 0.06, fm, 0, 0.36, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      c.add(sb(0.055, Hc - 0.4, 0.055, fm, sx * (Wc / 2 - 0.03), 0.38 + (Hc - 0.4) / 2, sz * (Dc / 2 - 0.03)));
    }
    c.add(sb(Wc + 0.05, 0.09, Dc + 0.05, fm, 0, Hc, 0));
    c.add(sb(Wc - 0.02, 0.03, Dc - 0.02, fm, 0, 0.7, 0));       // the middle shelf
    /* glass: two planes, called what they are */
    const gm = new T.MeshBasicMaterial({ color: new T.Color("#9fc4d8"), transparent: true, opacity: 0.13, side: T.DoubleSide, fog: true });
    c.add(at(new T.Mesh(new T.PlaneGeometry(Wc - 0.1, Hc - 0.45), gm), 0, 0.38 + (Hc - 0.4) / 2, Dc / 2 - 0.02));
    c.add(at(new T.Mesh(new T.PlaneGeometry(Dc - 0.1, Hc - 0.45), gm), Wc / 2 - 0.02, 0.38 + (Hc - 0.4) / 2, 0, 0, Math.PI / 2, 0));
    /* the toys inside, on both shelves, each grounded on the shelf */
    [0.39, 0.72].forEach((sy) => {
      const n = 2 + ((rnd() * 2) | 0);
      for (let k = 0; k < n; k++) {
        const t = KIT.toy((rnd() * 6) | 0, rnd);
        at(t, -Wc / 2 + 0.25 + k * ((Wc - 0.5) / Math.max(1, n - 1)), sy, range(rnd, -0.08, 0.08), 0, range(rnd, 0, TAU), 0);
        const s = contactShadow(t, { y: sy, opacity: 0.42, spread: 0.85 });
        if (s) c.add(s);
        c.add(t);
      }
    });
    /* feet */
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      c.add(sb(0.07, 0.03, 0.07, flat("#2c241c"), sx * (Wc / 2 - 0.06), 0.015, sz * (Dc / 2 - 0.06)));
    }
    R.place(freeze(c), -W / 2 + 0.36, 0, z, { ry: range(rnd, -0.03, 0.03), shadowOpacity: 0.72 });
  });

  /* --- a bench, a fern, a floor sign, a radiator ------------------- */
  const bench = new T.Group();
  const bm = mat("woodShelf", 1.4, 0.5, "#a07c50");
  for (let i = 0; i < 4; i++) bench.add(sb(1.5, 0.045, 0.1, bm, 0, 0.44, -0.18 + i * 0.12));
  for (let i = 0; i < 3; i++) bench.add(sb(1.4, 0.09, 0.035, bm, 0, 0.62 + i * 0.13, -0.24, 0, -0.2));
  for (const sx of [-1, 1]) {
    bench.add(sb(0.07, 0.44, 0.07, bm, sx * 0.66, 0.22, 0.16));
    bench.add(sb(0.07, 0.44, 0.07, bm, sx * 0.66, 0.22, -0.2));
    bench.add(sb(0.07, 0.06, 0.42, bm, sx * 0.66, 0.03, -0.02));
  }
  R.place(freeze(bench), W / 2 - 0.62, 0, 4.5, { ry: -Math.PI / 2 - 0.05, shadowOpacity: 0.72 });

  const fern = new T.Group();
  const potM = mat("enamelRed", 1, 1, "#9a6a56");
  const pot = new T.Mesh(new T.CylinderGeometry(0.2, 0.15, 0.3, 12), potM);
  fern.add(at(pot, 0, 0.15, 0));
  fern.add(at(new T.Mesh(new T.CylinderGeometry(0.215, 0.205, 0.05, 12), potM), 0, 0.29, 0));
  const soil = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 0.03, 12), flat("#3a2c20"));
  fern.add(at(soil, 0, 0.3, 0));
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU + rnd() * 0.4;
    const len = range(rnd, 0.3, 0.52);
    const frond = sb(0.055, len, 0.02, flat(i % 2 ? "#41603f" : "#4e7049"), 0, 0, 0);
    const holder = part(Math.cos(a) * 0.05, 0.32, Math.sin(a) * 0.05);
    holder.rotation.set(Math.cos(a) * 0.75, -a, Math.sin(a) * 0.75);
    at(frond, 0, len / 2, 0);
    holder.add(frond);
    fern.add(holder);
  }
  R.place(freeze(fern), W / 2 - 0.5, 0, -4.8, { shadowOpacity: 0.7 });

  const sign = new T.Group();
  const sm = mat("woodDark", 1, 1, "#7a5a3c");
  for (const s of [-1, 1]) {
    sign.add(sb(0.06, 1.0, 0.05, sm, s * 0.24, 0.5, s * 0.08, 0, 0, -s * 0.14));
    sign.add(sb(0.5, 0.62, 0.03, flat("#d4c49c"), s * 0.06, 0.72, s * 0.05, 0, 0, -s * 0.14));
  }
  sign.add(sb(0.52, 0.05, 0.16, sm, 0, 1.04, 0));
  for (let i = 0; i < 4; i++) sign.add(sb(range(rnd, 0.2, 0.36), 0.028, 0.008, flat("#4a3c2c"), -0.02, 0.88 - i * 0.11, 0.062));
  R.place(freeze(sign), -1.35, 0, 0.9, { ry: 0.65, shadowOpacity: 0.6 });

  const rad = new T.Group();
  const rm = mat("enamelCream", 1, 1, "#9a9280");
  for (let i = 0; i < 12; i++) rad.add(sb(0.055, 0.56, 0.11, rm, -0.36 + i * 0.066, 0.35, 0));
  rad.add(sb(0.82, 0.05, 0.13, rm, 0, 0.65, 0));
  rad.add(sb(0.82, 0.05, 0.13, rm, 0, 0.06, 0));
  for (const sx of [-1, 1]) rad.add(at(new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.14, 8), flat("#8a8070")), sx * 0.4, 0.12, 0));
  R.place(freeze(rad), W / 2 - 0.16, 0.12, 0.4, { ry: -Math.PI / 2, shadowOpacity: 0.5 });

  /* wall décor, four different ones, none of them at the same height */
  R.place(freeze(KIT.decor(1, rnd)), -W / 2 + 0.09, 2.1, 3.0, { ry: Math.PI / 2, shadow: false });
  R.place(freeze(KIT.decor(0, rnd)),  W / 2 - 0.09, 1.8, -1.0, { ry: -Math.PI / 2, shadow: false });
  R.place(freeze(KIT.decor(3, rnd)),  W / 2 - 0.09, 1.5, 2.2, { ry: -Math.PI / 2, shadow: false });
  R.place(freeze(KIT.decor(0, rnd)), -W / 2 + 0.09, 1.75, -5.2, { ry: Math.PI / 2, shadow: false });
  R.place(freeze(KIT.grate(0, rnd)),  W / 2 - 0.09, 2.6, -3.4, { ry: -Math.PI / 2, shadow: false });

  /* --- what is beyond each opening --------------------------------
     A doorway onto the clear colour is the flattest thing a room can
     do. Each one gets a real recess behind it with its own floor,
     walls and a little of the next room's light, so the hall has
     depth at all four of its exits. */
  function beyond(x, z, ry, tint, floorTex, fill) {
    /* the recess runs away from the doorway along its own -Z, deep
       enough that the back of it falls off into the dark, and it is
       given something to stand in it — a doorway wants a room behind
       it, not a painted panel */
    const b = new T.Group();
    /* the recess is hung so its mouth lands exactly on the outside face
       of the wall it is behind: local +0.6 in Z is the doorway plane. */
    const DEP = 3.8, WID = 3.4;
    const bm = mat("wallGreen", 1.2, 1, tint);
    b.add(sb(WID, 0.12, DEP, mat(floorTex, 4, 4, "#8a8074"), 0, -0.06, -DEP / 2 + 0.6));
    b.add(sb(WID, 2.8, 0.12, bm, 0, 1.4, -DEP + 0.6));
    for (const sx of [-1, 1]) b.add(sb(0.12, 2.8, DEP, bm, sx * WID / 2, 1.4, -DEP / 2 + 0.6));
    b.add(sb(WID, 0.12, DEP, mat("wallCream", 2, 2, "#4e4638"), 0, 2.82, -DEP / 2 + 0.6));
    for (const sx of [-1, 1]) {
      b.add(sb(0.12, 0.13, DEP, mat("woodDark", 1, 0.4, "#54402c"), sx * (WID / 2 - 0.06), 0.065, -DEP / 2 + 0.6));
    }
    if (fill) fill(b);
    R.place(freeze(b), x, 0, z, { ry: ry, shadow: false });
  }
  /* the foyer: the front doors, seen end-on and full of moonlight */
  beyond(0, -D / 2 - 0.68, 0, "#7d8a94", "floorTile", (b) => {
    b.add(sb(2.0, 2.3, 0.14, flat("#20303f"), 0, 1.15, -3.14));
    for (const sx of [-1, 1]) b.add(sb(0.09, 2.3, 0.2, mat("metal", 1, 1, "#5a6068"), sx * 0.98, 1.15, -3.06));
    b.add(sb(2.1, 0.12, 0.22, mat("metal", 1, 1, "#5a6068"), 0, 2.3, -3.06));
    const p = KIT.crate(0, rnd); at(p, -1.2, 0, -2.2, 0, 0.4, 0); b.add(p);
    const ps = contactShadow(p, { y: 0, opacity: 0.6 }); if (ps) b.add(ps);
  });
  /* the stage: the edge of a velvet curtain and a plinth */
  beyond(W / 2 + 0.68, -2.6, -Math.PI / 2, "#8a7a6a", "floorStage", (b) => {
    b.add(sb(0.55, 2.6, 0.34, mat("velvet", 0.5, 1.6, "#8a3040"), -1.15, 1.3, -1.5));
    b.add(sb(0.55, 2.6, 0.34, mat("velvet", 0.5, 1.6, "#7a2a38"), 1.15, 1.3, -1.5));
    b.add(sb(1.2, 0.46, 1.2, mat("woodDark", 1, 1, "#7a5a3c"), 0, 0.23, -1.7));
    b.add(sb(1.32, 0.06, 1.32, mat("woodShelf", 1, 1, "#a07c50"), 0, 0.49, -1.7));
  });
  /* the arcade: two cabinets, one of them still lit */
  beyond(W / 2 + 0.68, 2.3, -Math.PI / 2, "#6f7a86", "floorCarpet", (b) => {
    const c1 = KIT.cabinet(1, rnd); at(c1, -1.05, 0, -1.25, 0, 0.5, 0); b.add(c1);
    const s1 = contactShadow(c1, { y: 0, opacity: 0.6 }); if (s1) b.add(s1);
    const c2 = KIT.cabinet(3, rnd); at(c2, 0.98, 0, -1.7, 0, -0.7, 0); b.add(c2);
    const s2 = contactShadow(c2, { y: 0, opacity: 0.6 }); if (s2) b.add(s2);
    b.add(sb(0.9, 0.1, 0.9, mat("woodDark", 1, 1, "#6a4e34"), 0.1, 0.05, -2.7, 0, 0, 0));
  });
  /* the office: its own doorway light, from the other side */
  beyond(0, D / 2 + 0.68, Math.PI, "#8a8070", "floorOffice", (b) => {
    b.add(sb(2.6, 0.12, 0.6, mat("woodShelf", 2, 1, "#a8825a"), 0, 0.76, -2.6));
    b.add(sb(2.4, 0.72, 0.5, mat("enamelCream", 1, 1, "#8f8674"), 0, 0.36, -2.6));
  });

  /* --- the fittings: four strip lights down the ceiling ------------ */
  const stripZ = [-4.6, -1.6, 1.4, 4.4];
  stripZ.forEach((z, i) => {
    const s = KIT.bulb("strip");
    s.userData.stripIndex = i;
    R.place(freeze(s), -0.1, H - 0.16, z, { shadow: false });
  });

  /* --- lighting: pools, not a wash -------------------------------- */
  R.light({ x: -0.1, y: H - 0.35, z: -4.6, color: "#cfd8e6", intensity: 1.5, distance: 7.5, decay: 1.5, tag: "strip0" });
  R.light({ x: -0.1, y: H - 0.35, z: -1.6, color: "#cfd8e6", intensity: 1.3, distance: 7.0, decay: 1.5, tag: "strip1" });
  R.light({ x: -0.1, y: H - 0.35, z:  1.4, color: "#d8d0c0", intensity: 1.35, distance: 7.0, decay: 1.5, tag: "strip2" });
  R.light({ x: -0.1, y: H - 0.35, z:  4.4, color: "#ffcf9a", intensity: 1.5, distance: 7.0, decay: 1.5, tag: "strip3" });
  R.light({ x: 0, y: 1.9, z: -D / 2 - 1.2, color: "#5f7ec0", intensity: 1.7, distance: 7.5, decay: 1.6, tag: "foyerSpill" });
  R.light({ x: 0.35, y: 1.6, z: D / 2 + 0.6, color: "#ffbe7a", intensity: 1.0, distance: 4.0, decay: 1.6, tag: "officeSpill" });
  R.light({ x: W / 2 + 1.6, y: 1.95, z: -2.6, color: "#e0a05a", intensity: 1.3, distance: 5.4, decay: 1.6, tag: "stageSpill" });
  R.light({ x: W / 2 + 1.55, y: 1.55, z:  2.3, color: "#8ea8c0", intensity: 1.3, distance: 5.4, decay: 1.6, tag: "arcadeSpill" });

  R.mood({
    fog: { color: "#070910", near: 7, far: 32 },
    ambient: { color: "#1e2431", intensity: 0.36 },
  });

  /* the camera lives high in the office end corner, looking up the hall */
  /* The camera hangs on the office-end centre line rather than in a
     corner. A corner mount looked more like a real CCTV bracket, but it
     put the two side doorways at a glancing angle where all you could
     ever see through them was floor — and those doorways are where
     Cogsworth comes from. Down the middle, the hall reads as a hall and
     a shape in it reads as a shape. */
  R.cam("main", [0.05, 2.74, 5.5], [-0.05, 0.86, -5.2], 62);

  /* the stations along Cogsworth's march */
  R.anchor("far",  -0.4, 0, -4.6, 0);
  R.anchor("mid",  -0.1, 0, -0.9, 0);
  R.anchor("near",  0.3, 0,  3.1, 0);
  R.anchor("s0",   -0.6, 0, -3.4, 0.3);
  R.anchor("s1",    0.7, 0, -1.4, -0.4);
  R.anchor("s2",   -0.9, 0,  1.2, 0.6);
  /* four marks side by side, only ever used by the offline check that
     photographs the cast together */
  for (let i = 0; i < 4; i++) R.anchor("line" + i, -1.5 + i * 1.0, 0, -0.4, Math.PI);
  /* one mark in the clear middle of the hall, and a camera two metres
     off it, for photographing a performer on its own */
  R.anchor("studio", 0, 0, -0.6, 0);
  R.cam("studio", [0, 1.15, 1.5], [0, 0.95, -0.6], 52);
  R.cam("studioHigh", [0.9, 2.0, 1.3], [0, 1.0, -0.6], 52);
  R.anchor("stageDoor", W / 2 - 0.8, 0, -2.6, -Math.PI / 2);
  R.anchor("arcadeDoor", W / 2 - 0.8, 0, 2.3, -Math.PI / 2);
  R.anchor("foyerArch", 0, 0, -5.4, Math.PI);
}

/* =========================================================
   15d. THE REST OF THE SHOP

   Seven more rooms. None of them shares a builder with another, none
   shares a floor, a wall, a ceiling or a light rig, and the props in
   each are drawn from different corners of the kit. If two of these
   read as the same room with a filter over it, that is a bug.
   ========================================================= */

/* A doorway onto the clear colour is the flattest thing a room can do,
   so every opening in the shop gets something behind it: a short box of
   walls and floor with a little of the next room's tone in it. The hall
   gets full recesses with props in them because its doorways are big and
   straight on; everywhere else this is enough to give the hole depth. */
function recessBox(R, x, z, ry, o) {
  o = o || {};
  const W = o.w || 2.6, H = o.h || 2.7, DEP = o.dep || 2.0;
  const m = mat(o.wall || "wallGreen", 1.2, 1, o.tint || "#5a5f5c");
  const b = new T.Group();
  b.add(sb(W, 0.12, DEP, mat(o.floor || "floorTile", 3, 3, o.floorTint || "#6e6860"), 0, -0.06, -DEP / 2 + 0.1));
  b.add(sb(W, H, 0.12, m, 0, H / 2, -DEP + 0.1));
  for (const sx of [-1, 1]) b.add(sb(0.12, H, DEP, m, sx * W / 2, H / 2, -DEP / 2 + 0.1));
  b.add(sb(W, 0.12, DEP, mat("wallCream", 2, 2, "#3e3a32"), 0, H, -DEP / 2 + 0.1));
  for (const sx of [-1, 1]) b.add(sb(0.1, 0.13, DEP, mat("woodDark", 1, 0.4, "#4a3826"), sx * (W / 2 - 0.05), 0.065, -DEP / 2 + 0.1));
  if (o.fill) o.fill(b);
  R.place(freeze(b), x, o.y || 0, z, { ry: ry, shadow: false });
}

/* --- CAM 02 · THE SHOW STAGE ---------------------------------------
   A little proscenium at the back of the shop with three plinths on it.
   Two of them have somebody standing on them all day. The third is
   Cogsworth's, and on a night when he is awake it is empty, which is
   the point of pointing a camera at it. */
function buildStage(R) {
  const W = 9.0, D = 9.5, H = 4.2;
  const rnd = R.rnd;
  const wallM = mat("wallGreen", 3, 1.4, "#7e8c7e");
  const floorM = mat("floorStage", 5, 5, "#8a6a48");

  R.add(freeze(shell({
    w: W, d: D, h: H,
    floor: floorM, wall: wallM,
    ceil: mat("wallGreen", 3, 3, "#4e5a4e"),
    jamb: mat("woodDark", 0.6, 0.6, "#6a5038"),
    joists: true,
    openings: { s: [{ x: -2.6, w: 1.5, h: 2.3 }], w: [{ x: 1.0, w: 1.3, h: 2.2 }] },
    aoFloor: 0.5, aoWall: 0.3,
  })));

  /* the stage itself: a deck on a framed apron, with steps */
  const deck = new T.Group();
  const deckM = mat("floorStage", 3, 2, "#a07c50");
  deck.add(sb(7.2, 0.16, 3.6, deckM, 0, 0.72, 0));
  deck.add(sb(7.3, 0.1, 0.14, mat("woodDark", 2, 0.4, "#5e4430"), 0, 0.75, 1.8));
  deck.add(sb(7.2, 0.64, 0.12, mat("woodDark", 3, 1, "#4a3524"), 0, 0.32, 1.74));
  for (let i = 0; i < 8; i++) deck.add(sb(0.1, 0.64, 3.4, mat("woodDark", 1, 1, "#3f2c1e"), -3.2 + i * 0.92, 0.32, 0));
  for (let i = 0; i < 2; i++) {
    deck.add(sb(1.6, 0.12, 0.34, deckM, -2.2, 0.24 + i * 0.24, 1.98 + i * 0.3));
    deck.add(sb(1.6, 0.24, 0.06, mat("woodDark", 1, 1, "#4a3524"), -2.2, 0.12 + i * 0.24, 2.14 + i * 0.3));
  }
  R.place(freeze(deck), 0, 0, -2.2, { shadowOpacity: 0.7 });

  /* the proscenium: two piers, a header, and a pelmet */
  const arch = new T.Group();
  const gild = mat("brass", 2, 1, "#c8a260");
  const pier = mat("woodDark", 1, 2, "#6a4a30");
  for (const sx of [-1, 1]) {
    arch.add(sb(0.44, 3.5, 0.5, pier, sx * 3.55, 1.75, 0));
    arch.add(sb(0.54, 0.16, 0.6, gild, sx * 3.55, 3.5, 0));
    arch.add(sb(0.5, 0.12, 0.56, gild, sx * 3.55, 0.9, 0));
    for (let i = 0; i < 5; i++) arch.add(sb(0.48, 0.05, 0.52, gild, sx * 3.55, 1.2 + i * 0.5, 0));
  }
  arch.add(sb(7.7, 0.5, 0.5, pier, 0, 3.6, 0));
  arch.add(sb(7.9, 0.14, 0.6, gild, 0, 3.85, 0));
  /* the pelmet: a scalloped valance, real lobes */
  for (let i = 0; i < 11; i++) {
    arch.add(at(new T.Mesh(new T.SphereGeometry(0.34, 10, 8), mat("velvet", 0.6, 0.6, "#8a3040")),
      -3.3 + i * 0.66, 3.28, 0.05, 0, 0, 0, 1, 0.72, 0.6));
  }
  R.place(freeze(arch), 0, 0, -0.5, { shadow: false });

  /* the curtains, drawn back to the piers, each a column of folds */
  [-1, 1].forEach((sx) => {
    const c = new T.Group();
    for (let i = 0; i < 5; i++) {
      const w = 0.34 - i * 0.03;
      c.add(at(new T.Mesh(new T.CylinderGeometry(w, w * 1.25, 3.0, 10, 1, true),
        mat("velvet", 0.5, 1.4, i % 2 ? "#7e2b38" : "#93374a", { side: T.DoubleSide })),
        sx * i * 0.26, 1.55, -i * 0.1));
    }
    c.add(at(new T.Mesh(new T.TorusGeometry(0.42, 0.05, 6, 18), gild), sx * 0.3, 1.35, -0.2, 0.2, 0, sx * 0.5));
    R.place(freeze(c), sx * 3.0, 0.88, -1.1, { shadow: false, shadowOpacity: 0.5 });
  });

  /* three plinths. The middle one is bare. */
  const names = [0, 1, 2];
  names.forEach((i) => {
    const x = -2.0 + i * 2.0;
    const pl = new T.Group();
    pl.add(sb(0.9, 0.5, 0.9, mat("woodDark", 1, 1, "#6a4a30"), 0, 0.25, 0));
    pl.add(sb(1.02, 0.07, 1.02, gild, 0, 0.53, 0));
    pl.add(sb(0.98, 0.06, 0.98, mat("woodShelf", 1, 1, "#a07c50"), 0, 0.03, 0));
    pl.add(sb(0.44, 0.16, 0.03, mat("brass", 1, 1, "#d0aa64"), 0, 0.3, 0.46));
    R.place(freeze(pl), x, 0.88, -2.6, { ry: range(rnd, -0.06, 0.06), shadowOpacity: 0.68 });
  });
  /* two of them are occupied by things that are not part of the cast:
     a barrel organ and a hurdy-gurdy monkey, so the empty one reads */
  const organ = new T.Group();
  organ.add(sb(0.62, 0.8, 0.42, mat("woodShelf", 1, 1, "#a8804e"), 0, 0.4, 0));
  organ.add(sb(0.68, 0.07, 0.48, mat("brass", 1, 1, "#c8a260"), 0, 0.82, 0));
  for (let i = 0; i < 9; i++) {
    organ.add(at(new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 0.3 + (i % 3) * 0.14, 8), mat("brass", 1, 1, "#d4b06a")),
      -0.24 + i * 0.06, 1.0 + (i % 3) * 0.07, 0));
  }
  organ.add(at(new T.Mesh(new T.TorusGeometry(0.11, 0.016, 5, 16), mat("brass", 1, 1, "#c09a56")), 0.36, 0.5, 0, 0, Math.PI / 2));
  R.place(freeze(organ), -2.0, 1.44, -2.6, { ry: 0.12, shadowOpacity: 0.5 });

  const monkey = new T.Group();
  monkey.add(at(new T.Mesh(new T.SphereGeometry(0.17, 12, 9), flat("#7a5a3e")), 0, 0.34, 0));
  monkey.add(at(new T.Mesh(new T.SphereGeometry(0.13, 12, 9), flat("#7a5a3e")), 0, 0.6, 0.02));
  monkey.add(at(new T.Mesh(new T.SphereGeometry(0.085, 10, 8), flat("#c8a882")), 0, 0.57, 0.09));
  for (const sx of [-1, 1]) {
    monkey.add(at(new T.Mesh(new T.SphereGeometry(0.055, 8, 6), flat("#7a5a3e")), sx * 0.12, 0.68, 0));
    monkey.add(at(new T.Mesh(new T.SphereGeometry(0.017, 6, 5), flat("#120e0c")), sx * 0.038, 0.62, 0.15));
    monkey.add(at(new T.Mesh(new T.CylinderGeometry(0.035, 0.03, 0.3, 8), flat("#8a4a44")), sx * 0.17, 0.34, 0.02, 0, 0, sx * 0.5));
    monkey.add(at(new T.Mesh(new T.CylinderGeometry(0.04, 0.035, 0.22, 8), flat("#7a5a3e")), sx * 0.09, 0.1, 0.02));
  }
  monkey.add(at(new T.Mesh(new T.CylinderGeometry(0.14, 0.16, 0.14, 12), flat("#8a4a44")), 0, 0.76, 0));
  monkey.add(at(new T.Mesh(new T.SphereGeometry(0.03, 8, 6), mat("brass", 1, 1, "#d4b06a")), 0, 0.85, 0));
  /* the little cymbals */
  for (const sx of [-1, 1]) monkey.add(at(new T.Mesh(new T.CylinderGeometry(0.075, 0.075, 0.012, 12), mat("brass", 1, 1, "#d8b86e")), sx * 0.2, 0.4, 0.14, 0, 0, sx * 1.3));
  R.place(freeze(monkey), 2.0, 1.44, -2.6, { ry: -0.2, shadowOpacity: 0.5 });

  /* footlights along the front of the deck */
  for (let i = 0; i < 7; i++) {
    const f = new T.Group();
    f.add(at(new T.Mesh(new T.CylinderGeometry(0.09, 0.11, 0.1, 10, 1, true), mat("metal", 1, 1, "#6a7078", { side: T.DoubleSide })), 0, 0.06, 0, 0.5));
    f.add(at(new T.Mesh(new T.SphereGeometry(0.04, 8, 6), glow("#ffd9a0")), 0, 0.07, 0.02));
    f.add(sb(0.16, 0.03, 0.14, mat("metal", 1, 1, "#5a6068"), 0, 0.015, 0));
    R.place(freeze(f), -2.7 + i * 0.9, 0.88, -0.62, { shadow: false });
  }

  /* the seating: four rows of stacked chairs, none stacked the same */
  for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) {
    if ((r + i) % 4 === 0) continue;
    const c = KIT.chair(0, rnd);
    R.place(freeze(c), -2.4 + i * 1.2 + range(rnd, -0.12, 0.12), 0, 1.4 + r * 1.1,
      { ry: Math.PI + range(rnd, -0.22, 0.22), shadowOpacity: 0.66 });
  }
  R.place(freeze(KIT.crate(0, rnd)), -3.6, 0, 3.2, { ry: 0.4, shadowOpacity: 0.7 });
  R.place(freeze(KIT.crate(2, rnd)), 3.5, 0, 2.4, { ry: -0.3, shadowOpacity: 0.7 });
  R.place(freeze(KIT.decor(4, rnd)), 0, 3.0, D / 2 - 0.12, { ry: Math.PI, shadow: false });
  R.place(freeze(KIT.grate(1, rnd)), W / 2 - 0.09, 3.3, 2.0, { ry: -Math.PI / 2, shadow: false });

  R.light({ x: 0, y: 1.05, z: -0.7, color: "#ffb05a", intensity: 3.2, distance: 9.0, decay: 1.4, tag: "foot" });
  R.light({ x: -2.4, y: 3.3, z: -2.0, color: "#c86a7a", intensity: 2.3, distance: 8.0, decay: 1.5, tag: "wash1" });
  R.light({ x: 2.4, y: 3.3, z: -2.0, color: "#6a86c0", intensity: 2.3, distance: 8.0, decay: 1.5, tag: "wash2" });
  R.light({ x: 0, y: 3.6, z: 2.4, color: "#96a0ac", intensity: 2.0, distance: 11.0, decay: 1.5, tag: "house" });
  R.light({ x: -3.4, y: 1.9, z: 4.2, color: "#ffbe7a", intensity: 0.9, distance: 4.4, decay: 1.6, tag: "hallSpill" });
  R.light({ x: -W / 2 - 0.8, y: 1.8, z: 1.0, color: "#7f9ad6", intensity: 0.8, distance: 4.2, decay: 1.6, tag: "shopSpill" });

  recessBox(R, -2.6, D / 2 + 0.18, Math.PI, { tint: "#7d7260", floor: "floorCheck", w: 2.4 });
  recessBox(R, -W / 2 - 0.18, 1.0, Math.PI / 2, { tint: "#6a7280", floor: "floorTile", w: 2.2 });

  R.mood({ fog: { color: "#080b0c", near: 5, far: 26 }, ambient: { color: "#252e28", intensity: 0.5 } });
  R.cam("main", [0.2, 3.3, 4.4], [0, 1.35, -2.4], 62);
  R.anchor("s0", -2.0, 1.44, -2.6, Math.PI);
  R.anchor("s1", 1.1, 0.88, -1.4, Math.PI - 0.4);
  R.anchor("s2", -1.3, 0, 1.6, Math.PI + 0.3);
}

/* --- CAM 03 · ARCADE ROW -------------------------------------------
   Narrow, loud in the day, and the only room in the shop lit mostly by
   its own machines. Two banks of cabinets facing each other down a
   patterned runner, and a prize wall at the end. */
function buildArcade(R) {
  const W = 5.4, D = 8.0, H = 3.0;
  const rnd = R.rnd;
  R.add(freeze(shell({
    w: W, d: D, h: H,
    floor: mat("floorCarpet", 4, 6, "#7a5f74"),
    wall: mat("wallBlue", 2.6, 1.2, "#5e6d80"),
    ceil: mat("wallBlue", 3, 3, "#333d4a"),
    jamb: mat("metal", 0.6, 0.6, "#7a828a"),
    openings: { n: [{ x: -1.2, w: 1.4, h: 2.3 }], e: [{ x: 2.2, w: 1.4, h: 2.3 }] },
    aoFloor: 0.55, aoWall: 0.36,
  })));

  /* two rows of cabinets, alternating build, none square to the wall */
  for (let i = 0; i < 4; i++) {
    const c = KIT.cabinet(i % 4, rnd);
    R.place(freeze(c), -W / 2 + 0.62, 0, -2.6 + i * 1.5, { ry: Math.PI / 2 + range(rnd, -0.05, 0.05), shadowOpacity: 0.72 });
  }
  for (let i = 0; i < 3; i++) {
    const c = KIT.cabinet((i + 2) % 4, rnd);
    R.place(freeze(c), W / 2 - 0.62, 0, -2.2 + i * 1.6, { ry: -Math.PI / 2 + range(rnd, -0.05, 0.05), shadowOpacity: 0.72 });
  }

  /* the prize wall: three different shelf builds, stocked */
  [0, 2, 3].forEach((v, i) => {
    const sh = KIT.shelf(v, rnd, { w: 1.3, h: 1.7 + i * 0.14 });
    R.place(freeze(sh), -1.5 + i * 1.5, 0, -D / 2 + 0.34, { ry: range(rnd, -0.04, 0.04), shadowOpacity: 0.72 });
  });
  /* the change machine, with a real coin tray */
  const ch = new T.Group();
  const cm = mat("enamelRed", 1, 1.6, "#a8544a");
  ch.add(sb(0.52, 1.5, 0.4, cm, 0, 0.75, 0));
  ch.add(sb(0.56, 0.08, 0.44, mat("brass", 1, 1, "#c8a260"), 0, 1.52, 0));
  ch.add(sb(0.34, 0.26, 0.05, flat("#1c2028"), 0, 1.1, 0.21));
  ch.add(sb(0.3, 0.1, 0.12, mat("metal", 1, 1, "#8a9098"), 0, 0.62, 0.2));
  ch.add(sb(0.3, 0.02, 0.14, flat("#2a2e36"), 0, 0.6, 0.24));
  for (let i = 0; i < 2; i++) ch.add(at(new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.03, 10), mat("brass", 1, 1, "#d4b06a")), -0.08 + i * 0.16, 0.9, 0.22, Math.PI / 2));
  R.place(freeze(ch), W / 2 - 0.35, 0, -3.0, { ry: -Math.PI / 2, shadowOpacity: 0.7 });

  /* a bin of loose tokens, and a stool somebody left in the aisle */
  R.place(freeze(KIT.crate(1, rnd)), 1.4, 0, 2.7, { ry: 0.6, shadowOpacity: 0.72 });
  R.place(freeze(KIT.chair(1, rnd)), -0.9, 0, 1.9, { ry: 0.9, shadowOpacity: 0.7 });
  R.place(freeze(KIT.decor(4, rnd)), 0, 2.55, -D / 2 + 0.1, { shadow: false });
  R.place(freeze(KIT.decor(3, rnd)), W / 2 - 0.09, 1.5, 1.0, { ry: -Math.PI / 2, shadow: false });
  R.place(freeze(KIT.grate(3, rnd)), -W / 2 + 0.09, 2.5, 2.6, { ry: Math.PI / 2, shadow: false });

  /* the ceiling is a run of bare fluorescents, one of them out */
  for (let i = 0; i < 2; i++) R.place(freeze(KIT.bulb("strip")), 0, H - 0.14, -1.8 + i * 3.4, { ry: Math.PI / 2, shadow: false });

  R.light({ x: -W / 2 + 0.9, y: 1.4, z: -1.6, color: "#5f7fd0", intensity: 2.2, distance: 5.4, decay: 1.55, tag: "cab1" });
  R.light({ x: W / 2 - 0.9, y: 1.4, z: -0.6, color: "#d06a8a", intensity: 2.2, distance: 5.4, decay: 1.55, tag: "cab2" });
  R.light({ x: -W / 2 + 0.9, y: 1.4, z: 1.4, color: "#5fc0a0", intensity: 1.4, distance: 4.2, decay: 1.6, tag: "cab3" });
  R.light({ x: 0, y: H - 0.35, z: -1.8, color: "#cfd8e6", intensity: 1.9, distance: 7.4, decay: 1.45, tag: "strip0" });
  R.light({ x: 0, y: H - 0.35, z: 1.6, color: "#cfd8e6", intensity: 0.45, distance: 5.0, decay: 1.5, tag: "strip1" });
  R.light({ x: 0, y: 1.9, z: -D / 2 - 0.6, color: "#e0b060", intensity: 0.9, distance: 4.0, decay: 1.6, tag: "prize" });

  recessBox(R, -1.2, -D / 2 - 0.18, 0, { tint: "#7d7260", floor: "floorCheck", w: 2.2, h: 2.5 });
  recessBox(R, W / 2 + 0.18, 2.2, -Math.PI / 2, { tint: "#8a7a68", floor: "floorCheck", w: 2.2, h: 2.5 });

  R.mood({ fog: { color: "#070a10", near: 5, far: 24 }, ambient: { color: "#242c3a", intensity: 0.5 } });
  R.cam("main", [1.4, 2.65, 3.5], [-0.4, 1.0, -3.0], 66);
  R.anchor("s0", -0.4, 0, -1.6, 0);
  R.anchor("s1", 0.9, 0, 0.4, -0.5);
  R.anchor("s2", -0.7, 0, 2.2, 0.4);
}

/* --- CAM 04 · THE PARTY ROOM ---------------------------------------
   The brightest room in the building in the day and the worst one at
   night: paper, balloons and a long table with eleven places laid and
   nobody at any of them. */
function buildParty(R) {
  const W = 7.6, D = 7.0, H = 3.1;
  const rnd = R.rnd;
  R.add(freeze(shell({
    w: W, d: D, h: H,
    floor: mat("floorCheck", 6, 6, "#a08a70"),
    wall: mat("wallPaper", 3.4, 1.1, "#9a8272"),
    ceil: mat("wallCream", 3, 3, "#6a6252"),
    jamb: mat("woodShelf", 0.6, 0.6, "#a07c50"),
    rail: 1.0,
    openings: { n: [{ x: 2.0, w: 1.4, h: 2.3 }], w: [{ x: -1.6, w: 1.3, h: 2.2 }], e: [{ x: 1.8, w: 1.2, h: 2.2 }] },
    aoFloor: 0.48, aoWall: 0.3,
  })));

  /* the table: trestles, a cloth with a real hem, and what is on it */
  const table = new T.Group();
  const topM = mat("woodShelf", 2, 0.8, "#b08c5c");
  table.add(sb(4.4, 0.06, 1.1, topM, 0, 0.72, 0));
  table.add(sb(4.5, 0.05, 1.2, flat("#e8d8c0"), 0, 0.755, 0));
  for (const sz of [-1, 1]) table.add(sb(4.5, 0.2, 0.04, flat("#e8d8c0"), 0, 0.66, sz * 0.6));
  for (const sz of [-1, 1]) table.add(sb(4.5, 0.06, 0.05, flat("#d0405a"), 0, 0.55, sz * 0.61));
  for (const sx of [-1, 1]) {
    table.add(sb(0.1, 0.66, 0.1, mat("woodDark", 1, 1, "#6a4a30"), sx * 1.7, 0.33, -0.42));
    table.add(sb(0.1, 0.66, 0.1, mat("woodDark", 1, 1, "#6a4a30"), sx * 1.7, 0.33, 0.42));
    table.add(sb(0.08, 0.08, 0.94, mat("woodDark", 1, 1, "#5e4028"), sx * 1.7, 0.14, 0));
  }
  /* eleven places: a plate, a cup and a paper hat at each */
  for (let i = 0; i < 11; i++) {
    const sz = i % 2 ? 1 : -1;
    const x = -1.9 + ((i / 2) | 0) * 0.72;
    table.add(at(new T.Mesh(new T.CylinderGeometry(0.11, 0.1, 0.014, 14), flat(pick(rnd, ["#e4dcc8", "#dcc4d0", "#cfd8c4"]))), x, 0.79, sz * 0.3));
    table.add(at(new T.Mesh(new T.CylinderGeometry(0.04, 0.033, 0.09, 10), flat(pick(rnd, ["#d0607a", "#5f9ec4", "#e0b04c"]))), x + 0.17, 0.83, sz * 0.3));
    table.add(at(new T.Mesh(new T.ConeGeometry(0.06, 0.14, 10), flat(pick(rnd, ["#d0405a", "#3f7fb0", "#e0b040", "#6fb07a"]))), x - 0.02, 0.86, sz * 0.14, range(rnd, -0.3, 0.3), 0, range(rnd, -0.4, 0.4)));
  }
  /* the cake, uncut, with candles */
  const cake = new T.Group();
  cake.add(at(new T.Mesh(new T.CylinderGeometry(0.26, 0.27, 0.14, 18), flat("#efe0d0")), 0, 0.07, 0));
  cake.add(at(new T.Mesh(new T.CylinderGeometry(0.19, 0.2, 0.12, 18), flat("#f2d4dd")), 0, 0.2, 0));
  cake.add(at(new T.Mesh(new T.TorusGeometry(0.26, 0.02, 5, 22), flat("#d0607a")), 0, 0.14, 0, Math.PI / 2));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    cake.add(at(new T.Mesh(new T.CylinderGeometry(0.011, 0.011, 0.1, 6), flat(i % 2 ? "#d0405a" : "#5f9ec4")), Math.cos(a) * 0.12, 0.31, Math.sin(a) * 0.12));
  }
  cake.add(at(new T.Mesh(new T.CylinderGeometry(0.3, 0.32, 0.02, 20), mat("brass", 1, 1, "#c8a260")), 0, 0.0, 0));
  at(cake, 0, 0.785, 0);
  const cs = contactShadow(cake, { y: 0.785, opacity: 0.5 });
  if (cs) table.add(cs);
  table.add(cake);
  R.place(freeze(table), -0.2, 0, 0.2, { shadowOpacity: 0.72 });

  /* chairs down both sides, no two at the same angle */
  for (let i = 0; i < 5; i++) for (const sz of [-1, 1]) {
    if (i === 3 && sz > 0) continue;
    R.place(freeze(KIT.chair(0, rnd)), -1.9 + i * 0.85, 0, 0.2 + sz * 1.05,
      { ry: sz > 0 ? Math.PI + range(rnd, -0.3, 0.3) : range(rnd, -0.3, 0.3), shadowOpacity: 0.68 });
  }

  /* the serving counter along the far wall */
  const counter = new T.Group();
  const cm = mat("enamelCream", 2, 1, "#a89876");
  counter.add(sb(2.6, 0.9, 0.6, cm, 0, 0.45, 0));
  counter.add(sb(2.72, 0.08, 0.7, mat("woodShelf", 2, 1, "#a8825a"), 0, 0.93, 0));
  for (let i = 0; i < 3; i++) counter.add(sb(0.78, 0.5, 0.03, mat("enamelCream", 1, 1, "#9a8a68"), -0.86 + i * 0.86, 0.5, 0.31));
  for (let i = 0; i < 3; i++) counter.add(sb(0.2, 0.03, 0.05, mat("brass", 1, 1, "#c8a260"), -0.86 + i * 0.86, 0.66, 0.33));
  counter.add(sb(2.6, 0.1, 0.06, flat("#3a3028"), 0, 0.05, -0.28));
  for (let i = 0; i < 4; i++) {
    const jug = new T.Mesh(new T.CylinderGeometry(0.07, 0.09, 0.2, 12), flat(pick(rnd, ["#d0607a", "#5f9ec4", "#e0b04c", "#6fb07a"])));
    counter.add(at(jug, -0.9 + i * 0.6, 1.07, range(rnd, -0.1, 0.1)));
  }
  R.place(freeze(counter), 1.9, 0, -D / 2 + 0.42, { shadowOpacity: 0.72 });

  /* bunting across the ceiling in two runs, and balloons in the corners */
  R.place(freeze(KIT.decor(4, rnd)), -1.4, 2.55, -1.6, { ry: 0.2, shadow: false });
  R.place(freeze(KIT.decor(4, rnd)), 1.4, 2.62, 1.4, { ry: -0.3, shadow: false });
  [[-3.0, -2.4], [3.0, 2.2], [-2.8, 2.6]].forEach(([x, z], i) => {
    const bunch = new T.Group();
    for (let k = 0; k < 3; k++) {
      const b = new T.Mesh(new T.SphereGeometry(0.16, 12, 10), flat(pick(rnd, ["#d0405a", "#3f7fb0", "#e0b040", "#6fb07a", "#a86ac0"])));
      const y = 1.5 + k * 0.16 + range(rnd, -0.06, 0.06);
      at(b, range(rnd, -0.16, 0.16), y, range(rnd, -0.16, 0.16), 0, 0, 0, 1, 1.12, 1);
      bunch.add(b);
      bunch.add(at(new T.Mesh(new T.ConeGeometry(0.035, 0.07, 6), flat("#cfc4b0")), b.position.x, y - 0.17, b.position.z, Math.PI));
      bunch.add(at(new T.Mesh(new T.CylinderGeometry(0.004, 0.004, y - 0.28, 4), flat("#e0d8c8")), b.position.x * 0.4, (y - 0.28) / 2 + 0.06, b.position.z * 0.4, 0, 0, b.position.x * 0.2));
    }
    const w = KIT.crate(i % 3, rnd);
    at(w, 0, 0, 0, 0, range(rnd, 0, TAU), 0);
    bunch.add(w);
    R.place(freeze(bunch), x, 0, z, { shadowOpacity: 0.7 });
  });

  R.place(freeze(KIT.decor(0, rnd)), -W / 2 + 0.09, 1.8, -1.0, { ry: Math.PI / 2, shadow: false });
  R.place(freeze(KIT.decor(2, rnd)), W / 2 - 0.09, 1.6, -1.6, { ry: -Math.PI / 2, shadow: false });
  R.place(freeze(KIT.grate(0, rnd)), -W / 2 + 0.09, 2.6, 1.8, { ry: Math.PI / 2, shadow: false });
  R.place(freeze(KIT.bulb("pendant", "#8a5a52")), -0.2, 2.5, 0.2, { shadow: false });
  R.place(freeze(KIT.bulb("sconce", "#9a7452")), W / 2 - 0.1, 2.1, 1.6, { ry: -Math.PI / 2, shadow: false });

  R.light({ x: -0.2, y: 2.35, z: 0.2, color: "#ffc078", intensity: 2.0, distance: 7.4, decay: 1.4, tag: "pendant" });
  R.light({ x: W / 2 - 0.5, y: 2.1, z: 1.6, color: "#ffbe8a", intensity: 1.0, distance: 4.0, decay: 1.6, tag: "sconce" });
  R.light({ x: 1.9, y: 1.4, z: -D / 2 + 0.8, color: "#c0d0e0", intensity: 0.9, distance: 4.4, decay: 1.6, tag: "counter" });
  R.light({ x: -3.0, y: 1.7, z: -2.4, color: "#7a6ab0", intensity: 0.7, distance: 3.6, decay: 1.7, tag: "corner" });
  R.light({ x: -W / 2 - 0.8, y: 1.8, z: -1.6, color: "#8ea8c0", intensity: 0.9, distance: 4.2, decay: 1.6, tag: "officeSpill" });
  R.light({ x: 2.0, y: 1.8, z: -D / 2 - 0.8, color: "#7f9ad6", intensity: 0.8, distance: 4.0, decay: 1.6, tag: "arcadeSpill" });

  recessBox(R, 2.0, -D / 2 - 0.18, 0, { tint: "#6f7a86", floor: "floorCarpet", w: 2.2, h: 2.5 });
  recessBox(R, -W / 2 - 0.18, -1.6, Math.PI / 2, { tint: "#8a8070", floor: "floorOffice", w: 2.1, h: 2.4 });
  recessBox(R, W / 2 + 0.18, 1.8, -Math.PI / 2, { tint: "#6a665c", floor: "floorCon", w: 2.0, h: 2.4 });

  R.mood({ fog: { color: "#0a0810", near: 5, far: 24 }, ambient: { color: "#2a2436", intensity: 0.46 } });
  R.cam("main", [-2.9, 2.62, 2.9], [0.4, 1.0, -1.2], 68);
  R.anchor("s0", 2.5, 0, 1.9, -2.2);
  R.anchor("s1", -0.2, 0, 2.0, Math.PI);
  R.anchor("s2", -2.4, 0, 0.2, -1.2);
}

/* --- CAM 05 · THE FRONT FOYER --------------------------------------
   The street end. Shutters down over the glass, moonlight coming
   through the fanlight above them, a till nobody has cashed up and one
   enormous wind-up piece in the middle of the floor that is not part of
   the cast and never moves. */
function buildFoyer(R) {
  const W = 7.0, D = 6.0, H = 3.6;
  const rnd = R.rnd;
  R.add(freeze(shell({
    w: W, d: D, h: H,
    floor: mat("floorTile", 5, 5, "#8e8478"),
    wall: mat("wallCream", 3, 1.4, "#8e8270"),
    ceil: mat("wallCream", 3, 3, "#5e5648"),
    jamb: mat("woodDark", 0.6, 0.6, "#6a4a30"),
    rail: 1.1,
    openings: { s: [{ x: 0, w: 2.4, h: 2.5 }], n: [{ x: 0, w: 3.2, h: 2.6 }] },
    aoFloor: 0.5, aoWall: 0.32,
  })));

  /* the shopfront: shutter slats behind a mullioned frame, and the
     fanlight over it that lets the night in */
  const front = new T.Group();
  const fm = mat("woodDark", 1, 1, "#5e4430");
  for (let i = 0; i < 22; i++) front.add(sb(3.1, 0.09, 0.06, mat("metal", 2, 0.3, "#6a727a"), 0, 0.1 + i * 0.105, -0.1));
  front.add(sb(3.3, 0.16, 0.2, mat("metal", 1, 1, "#5a6068"), 0, 2.44, -0.1));
  for (const sx of [-1, 1]) front.add(sb(0.14, 2.5, 0.24, fm, sx * 1.62, 1.25, 0));
  front.add(sb(3.4, 0.14, 0.26, fm, 0, 2.56, 0));
  /* the fanlight, and the night behind it */
  front.add(at(new T.Mesh(new T.PlaneGeometry(2.9, 0.7), new T.MeshBasicMaterial({ map: TX.night, fog: true })), 0, 3.0, -0.13));
  for (let i = 0; i < 5; i++) front.add(sb(0.06, 0.72, 0.1, fm, -1.2 + i * 0.6, 3.0, -0.06));
  front.add(sb(3.4, 0.12, 0.22, fm, 0, 3.4, 0));
  /* the letterbox and the mat under it */
  front.add(sb(0.36, 0.06, 0.1, mat("brass", 1, 1, "#c8a260"), -0.7, 1.0, 0.03));
  R.place(freeze(front), 0, 0, -D / 2 + 0.12, { shadow: false });
  R.place(freeze(sb(1.5, 0.02, 0.85, mat("floorCarpet", 1.4, 1, "#7a6a54"), 0, 0.011, 0)), -0.2, 0, -2.1, { shadow: false });

  /* the till counter, an L of two carcasses with a raised lip */
  const till = new T.Group();
  const wm = mat("woodShelf", 2, 1, "#a8825a");
  till.add(sb(2.4, 0.95, 0.66, wm, 0, 0.475, 0));
  till.add(sb(2.5, 0.07, 0.76, mat("woodDark", 2, 1, "#6a4a30"), 0, 0.99, 0));
  till.add(sb(0.66, 0.95, 1.1, wm, -1.53, 0.475, 0.4));
  till.add(sb(0.76, 0.07, 1.2, mat("woodDark", 1, 1, "#6a4a30"), -1.53, 0.99, 0.4));
  for (let i = 0; i < 3; i++) {
    till.add(sb(0.66, 0.24, 0.03, mat("woodShelf", 1, 1, "#b8925e"), -0.7 + i * 0.7, 0.68, 0.33));
    till.add(at(new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 0.14, 6), mat("brass", 1, 1, "#c8a260")), -0.7 + i * 0.7, 0.68, 0.36, 0, 0, Math.PI / 2));
  }
  till.add(sb(2.5, 0.12, 0.06, mat("brass", 1, 1, "#b8945a"), 0, 1.06, -0.33));
  /* the register: a real machine with keys and a drawer */
  const reg = new T.Group();
  reg.add(sb(0.42, 0.3, 0.36, mat("brass", 1, 1, "#c09a56"), 0, 0.15, 0));
  reg.add(sb(0.46, 0.06, 0.4, mat("brass", 1, 1, "#d0aa64"), 0, 0.32, 0));
  reg.add(sb(0.3, 0.2, 0.03, flat("#2a2620"), 0, 0.42, -0.02));
  reg.add(sb(0.26, 0.14, 0.02, glow("#8a7a44", 0.9), 0, 0.42, 0.0));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
    reg.add(at(new T.Mesh(new T.CylinderGeometry(0.017, 0.017, 0.03, 8), flat(r === 2 ? "#c8b070" : "#e8e0cc")), -0.14 + c * 0.07, 0.31, 0.07 + r * 0.07, Math.PI / 2));
  }
  reg.add(sb(0.4, 0.09, 0.1, mat("brass", 1, 1, "#b8945a"), 0, 0.06, 0.2));
  at(reg, -0.5, 1.03, 0.02, 0, 0.2, 0);
  const rs = contactShadow(reg, { y: 1.03, opacity: 0.5 });
  if (rs) till.add(rs);
  till.add(reg);
  R.place(freeze(till), 2.0, 0, 0.9, { ry: -0.5, shadowOpacity: 0.72 });

  /* the centrepiece: a big brass wind-up carousel under a dome, on its
     own plinth, roped off. It is scenery — it never moves. */
  const piece = new T.Group();
  piece.add(at(new T.Mesh(new T.CylinderGeometry(0.72, 0.82, 0.42, 20), mat("woodDark", 1, 1, "#6a4a30")), 0, 0.21, 0));
  piece.add(at(new T.Mesh(new T.TorusGeometry(0.76, 0.03, 6, 24), mat("brass", 1, 1, "#c8a260")), 0, 0.43, 0, Math.PI / 2));
  piece.add(at(new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.9, 10), mat("brass", 1, 1, "#d0aa64")), 0, 0.9, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    piece.add(at(new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 0.5, 6), mat("brass", 1, 1, "#c8a260")), Math.cos(a) * 0.4, 0.82, Math.sin(a) * 0.4));
    const horse = new T.Group();
    horse.add(sb(0.22, 0.12, 0.09, flat(pick(rnd, ["#e0d0b8", "#c8a882", "#b06a62"])), 0, 0, 0));
    horse.add(sb(0.1, 0.13, 0.08, flat("#e0d0b8"), 0.11, 0.08, 0, 0, 0, -0.5));
    for (let k = 0; k < 4; k++) horse.add(sb(0.03, 0.13, 0.03, flat("#e0d0b8"), -0.07 + (k % 2) * 0.15, -0.11, -0.03 + ((k / 2) | 0) * 0.06));
    at(horse, Math.cos(a) * 0.4, 0.72, Math.sin(a) * 0.4, 0, -a, 0);
    piece.add(horse);
  }
  piece.add(at(new T.Mesh(new T.ConeGeometry(0.62, 0.38, 16), mat("velvet", 1, 1, "#8a3a48")), 0, 1.32, 0));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    piece.add(at(new T.Mesh(new T.SphereGeometry(0.035, 8, 6), mat("brass", 1, 1, "#d8b86e")), Math.cos(a) * 0.6, 1.16, Math.sin(a) * 0.6));
  }
  R.place(freeze(piece), -0.6, 0, 0.6, { ry: 0.3, shadowOpacity: 0.75 });
  /* the rope: four posts and three swags, each swag three segments */
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.78;
    const post = new T.Group();
    post.add(at(new T.Mesh(new T.CylinderGeometry(0.11, 0.13, 0.03, 12), mat("brass", 1, 1, "#b8945a")), 0, 0.015, 0));
    post.add(at(new T.Mesh(new T.CylinderGeometry(0.028, 0.032, 0.86, 10), mat("brass", 1, 1, "#c8a260")), 0, 0.44, 0));
    post.add(at(new T.Mesh(new T.SphereGeometry(0.052, 10, 8), mat("brass", 1, 1, "#d0aa64")), 0, 0.9, 0));
    R.place(freeze(post), -0.6 + Math.cos(a) * 1.5, 0, 0.6 + Math.sin(a) * 1.5, { shadowOpacity: 0.6 });
  }

  R.place(freeze(KIT.shelf(1, rnd)), -W / 2 + 0.4, 0, 1.9, { ry: Math.PI / 2 + 0.05, shadowOpacity: 0.72 });
  R.place(freeze(KIT.crate(2, rnd)), -2.6, 0, -1.7, { ry: -0.4, shadowOpacity: 0.7 });
  R.place(freeze(KIT.decor(1, rnd)), W / 2 - 0.09, 2.1, -1.4, { ry: -Math.PI / 2, shadow: false });
  R.place(freeze(KIT.decor(0, rnd)), -W / 2 + 0.09, 1.9, -0.6, { ry: Math.PI / 2, shadow: false });
  R.place(freeze(KIT.grate(2, rnd)), W / 2 - 0.09, 3.0, 1.6, { ry: -Math.PI / 2, shadow: false });
  R.place(freeze(KIT.bulb("pendant", "#7a6a4a")), -0.6, 3.0, 0.6, { shadow: false });

  R.light({ x: 0, y: 2.9, z: -D / 2 + 0.6, color: "#7f9ad6", intensity: 2.2, distance: 8.0, decay: 1.4, tag: "moon" });
  R.light({ x: -0.6, y: 2.85, z: 0.6, color: "#ffd0a0", intensity: 1.2, distance: 6.4, decay: 1.5, tag: "pendant" });
  R.light({ x: 2.0, y: 1.5, z: 0.9, color: "#e0b070", intensity: 0.9, distance: 3.6, decay: 1.6, tag: "till" });
  R.light({ x: 0, y: 1.9, z: D / 2 + 0.8, color: "#cfd8e6", intensity: 1.0, distance: 5.0, decay: 1.6, tag: "hallSpill" });
  R.light({ x: -2.6, y: 1.4, z: 2.2, color: "#5a6a8a", intensity: 0.6, distance: 3.4, decay: 1.7, tag: "corner" });

  recessBox(R, 0, D / 2 + 0.18, Math.PI, { tint: "#8a7f6c", floor: "floorCheck", w: 3.0, h: 2.7, dep: 2.6 });

  R.mood({ fog: { color: "#080c14", near: 5, far: 24 }, ambient: { color: "#242c3c", intensity: 0.48 } });
  R.cam("main", [2.7, 3.05, 2.5], [-0.5, 1.05, -1.8], 66);
  R.anchor("s0", -2.3, 0, -0.8, 0.9);
  R.anchor("s1", 1.2, 0, -1.4, 2.6);
  R.anchor("s2", -0.6, 0, 2.1, 0.2);
}

/* --- CAM 06 · THE SUPPLY CLOSET ------------------------------------
   Two and a half metres square, one bulb, and the fuse board the whole
   building runs off. The smallest room in the game and the one where a
   shape has nowhere to hide. */
function buildCloset(R) {
  const W = 3.4, D = 4.0, H = 2.7;
  const rnd = R.rnd;
  R.add(freeze(shell({
    w: W, d: D, h: H,
    floor: mat("floorCon", 3, 3, "#8a867c"),
    wall: mat("brickPale", 2.0, 1.3, "#a09484"),
    ceil: mat("wallCream", 2, 2, "#4e4638"),
    jamb: mat("metal", 0.5, 0.5, "#7a828a"),
    skirtMat: mat("floorCon", 2, 0.3, "#6a665c"),
    openings: { n: [{ x: -0.4, w: 1.0, h: 2.1 }] },
    aoFloor: 0.62, aoWall: 0.42,
  })));

  /* steel shelving on two walls, three different builds, well stocked */
  R.place(freeze(KIT.shelf(2, rnd, { w: 2.6, h: 2.1, d: 0.42 })), 0, 0, -D / 2 + 0.25, { shadowOpacity: 0.75 });
  /* the second run of shelving used to stand here, right under the
     camera, where all it ever showed was the back of itself */

  /* paint tins stacked on the floor, and a mop in a bucket */
  for (let i = 0; i < 5; i++) {
    const tin = new T.Group();
    const r = range(rnd, 0.09, 0.13);
    tin.add(at(new T.Mesh(new T.CylinderGeometry(r, r, range(rnd, 0.14, 0.2), 14), mat("enamelCream", 1, 1, pick(rnd, ["#9a8a68", "#7a8a94", "#8a7a6a"]))), 0, 0.09, 0));
    tin.add(at(new T.Mesh(new T.TorusGeometry(r, 0.012, 5, 16), mat("metal", 1, 1, "#8a9098")), 0, 0.18, 0, Math.PI / 2));
    tin.add(at(new T.Mesh(new T.TorusGeometry(r * 0.8, 0.008, 4, 12), mat("metal", 1, 1, "#9aa2aa")), 0, 0.2, 0, 0, 0, 0.4));
    R.place(freeze(tin), W / 2 - 0.42 - (i % 2) * 0.28, (i > 3 ? 0.19 : 0), 0.9 + ((i / 2) | 0) * 0.3,
      { ry: range(rnd, 0, TAU), shadowOpacity: 0.7 });
  }
  const bucket = new T.Group();
  bucket.add(at(new T.Mesh(new T.CylinderGeometry(0.16, 0.13, 0.26, 14, 1, true), mat("metal", 1, 1, "#7a828a", { side: T.DoubleSide })), 0, 0.13, 0));
  bucket.add(at(new T.Mesh(new T.CylinderGeometry(0.13, 0.13, 0.02, 14), flat("#2e3238")), 0, 0.01, 0));
  bucket.add(at(new T.Mesh(new T.TorusGeometry(0.16, 0.012, 5, 18), mat("metal", 1, 1, "#98a0a8")), 0, 0.26, 0, Math.PI / 2));
  bucket.add(at(new T.Mesh(new T.TorusGeometry(0.16, 0.008, 4, 16, Math.PI), mat("metal", 1, 1, "#8a9098")), 0, 0.3, 0, 0, 0, 0));
  bucket.add(at(new T.Mesh(new T.CylinderGeometry(0.018, 0.02, 1.25, 8), mat("woodShelf", 1, 1, "#a8825a")), 0.05, 0.68, -0.03, 0.1, 0, 0.06));
  for (let i = 0; i < 9; i++) {
    bucket.add(at(new T.Mesh(new T.CylinderGeometry(0.008, 0.006, 0.2, 5), flat("#cfc4a8")), 0.05 + range(rnd, -0.05, 0.05), 0.14, -0.03 + range(rnd, -0.05, 0.05), range(rnd, -0.2, 0.2), 0, range(rnd, -0.2, 0.2)));
  }
  R.place(freeze(bucket), -W / 2 + 0.5, 0, -0.3, { ry: 0.4, shadowOpacity: 0.72 });

  /* the fuse board — the reason this room exists */
  const board = new T.Group();
  board.add(sb(0.72, 0.56, 0.12, mat("metal", 1, 1, "#6e767e"), 0, 0, 0));
  board.add(sb(0.66, 0.5, 0.03, flat("#2a2e34"), 0, 0, 0.075));
  for (let i = 0; i < 8; i++) {
    board.add(sb(0.06, 0.16, 0.05, mat("enamelCream", 1, 1, "#9a9280"), -0.27 + i * 0.077, 0.1, 0.09));
    board.add(sb(0.03, 0.05, 0.03, flat(i === 5 ? "#c04a3c" : "#3a3e44"), -0.27 + i * 0.077, 0.16, 0.115));
  }
  board.add(sb(0.6, 0.05, 0.06, mat("metal", 1, 1, "#8a9098"), 0, -0.12, 0.085));
  board.add(sb(0.1, 0.16, 0.06, mat("enamelRed", 1, 1, "#a8544a"), 0.22, -0.2, 0.09));
  for (let i = 0; i < 3; i++) {
    board.add(at(new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.5, 5), flat("#2a2620")), -0.2 + i * 0.06, -0.55, 0.05));
  }
  R.place(freeze(board), W / 2 - 0.12, 1.5, -0.6, { ry: -Math.PI / 2, shadow: false });

  R.place(freeze(KIT.crate(1, rnd)), -0.5, 0, 1.3, { ry: 0.5, shadowOpacity: 0.74 });
  R.place(freeze(KIT.crate(0, rnd)), -1.0, 0, 0.8, { ry: -0.3, shadowOpacity: 0.74 });
  R.place(freeze(KIT.grate(1, rnd)), W / 2 - 0.09, 2.2, 1.1, { ry: -Math.PI / 2, shadow: false });
  R.place(freeze(KIT.bulb("pendant", "#5e564a")), 0, 2.4, 0.3, { shadow: false });

  R.light({ x: 0, y: 2.24, z: 0.3, color: "#ffdcb0", intensity: 2.4, distance: 5.6, decay: 1.4, tag: "bulb" });
  R.light({ x: -0.4, y: 1.6, z: -D / 2 - 0.7, color: "#c08a6a", intensity: 0.8, distance: 3.4, decay: 1.7, tag: "doorSpill" });
  R.light({ x: W / 2 - 0.3, y: 1.5, z: -0.6, color: "#6a8ab0", intensity: 0.4, distance: 2.2, decay: 1.8, tag: "board" });

  recessBox(R, -0.4, -D / 2 - 0.18, 0, { tint: "#8a8070", floor: "floorCheck", w: 1.8, h: 2.2, dep: 1.8 });

  R.mood({ fog: { color: "#0a0808", near: 3, far: 15 }, ambient: { color: "#2c2622", intensity: 0.46 } });
  R.cam("main", [-1.35, 2.45, 1.72], [0.5, 0.8, -1.7], 74);
  R.anchor("s0", -0.65, 0, -0.5, 0.4);
  R.anchor("s1", 0.5, 0, 0.5, -0.8);
  R.anchor("s2", -0.5, 0, 0.9, 0.2);
}

/* --- CAM 07 · THE DUCT JUNCTION ------------------------------------
   Inside the ductwork, where four runs meet over the shop floor. It is
   the only place in the building with no floor to speak of and it is
   the only route Chime uses. */
function buildDucts(R) {
  const W = 2.4, D = 6.4, H = 1.9;
  const rnd = R.rnd;
  const skin = mat("metal", 1.3, 0.8, "#93a2b0");
  R.add(freeze(shell({
    w: W, d: D, h: H,
    floor: mat("metal", 1.2, 3, "#8695a4"),
    wall: skin, ceil: mat("metal", 1.2, 1.4, "#74828f"),
    jamb: mat("metal", 0.5, 0.5, "#9aa2aa"),
    skirt: false,
    openings: { n: [{ x: 0, w: 1.4, h: 1.5 }], w: [{ x: -1.4, w: 1.2, h: 1.4 }], e: [{ x: 1.6, w: 1.2, h: 1.4 }] },
    aoFloor: 0.6, aoWall: 0.45,
  })));

  /* stiffening ribs all the way down, which is what tells you this is a
     duct and not a corridor */
  for (let i = 0; i < 9; i++) {
    const z = -D / 2 + 0.5 + i * 0.72;
    const rib = new T.Group();
    rib.add(sb(W + 0.06, 0.1, 0.09, mat("metal", 1, 1, "#9aa2aa"), 0, H - 0.05, 0));
    rib.add(sb(W + 0.06, 0.09, 0.09, mat("metal", 1, 1, "#7e868e"), 0, 0.045, 0));
    for (const sx of [-1, 1]) rib.add(sb(0.09, H, 0.09, mat("metal", 1, 1, "#8a929a"), sx * (W / 2 - 0.03), H / 2, 0));
    R.place(freeze(rib), 0, 0, z, { shadow: false });
  }
  /* the grates that let the shop through, each one a different build */
  [[-2.2, -1], [0.4, 1], [2.4, -1]].forEach(([z, sx], i) => {
    R.place(freeze(KIT.grate(i, rnd)), sx * (W / 2 - 0.06), 0.9, z, { ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2, shadow: false });
  });
  /* a grate in the floor, looking down onto a lit room */
  const floorGrate = KIT.grate(2, rnd, 0.9, 0.7);
  R.place(freeze(floorGrate), 0, 0.03, -0.9, { rx: -Math.PI / 2, shadow: false });
  R.add(freeze(sb(0.86, 0.02, 0.66, glow("#8a6a3a", 0.55), 0, -0.03, -0.9)));

  /* cable trays and a run of conduit down one side */
  const tray = new T.Group();
  tray.add(sb(0.22, 0.04, D - 0.5, mat("metal", 1, 3, "#6e767e"), 0, 0, 0));
  for (const sz of [-1, 1]) tray.add(sb(0.03, 0.09, D - 0.5, mat("metal", 1, 3, "#8a929a"), sz * 0.11, 0.04, 0));
  for (let i = 0; i < 5; i++) {
    tray.add(at(new T.Mesh(new T.CylinderGeometry(0.022, 0.022, D - 0.6, 6), flat(["#2a2620", "#3a3028", "#4a3a2a", "#2e2a24", "#3a2f2a"][i])),
      -0.08 + i * 0.04, 0.05 + (i % 2) * 0.02, 0, Math.PI / 2));
  }
  R.place(freeze(tray), -W / 2 + 0.2, H - 0.24, 0.1, { shadow: false });
  for (let i = 0; i < 4; i++) {
    R.place(freeze(at(new T.Mesh(new T.CylinderGeometry(0.03, 0.03, W - 0.2, 8), mat("metal", 1, 1, "#7a828a")), 0, 0, 0, 0, 0, Math.PI / 2)),
      0, H - 0.12, -2.2 + i * 1.5, { shadow: false });
  }
  /* dust, insulation and one dropped spanner, so it is a real place */
  for (let i = 0; i < 7; i++) {
    const w = new T.Mesh(new T.SphereGeometry(range(rnd, 0.04, 0.09), 7, 5), flat("#7a7266"));
    R.place(freeze(at(w, 0, 0, 0, 0, 0, 0, 1.4, 0.4, 1.2)), range(rnd, -0.9, 0.9), 0.02, range(rnd, -2.8, 2.8), { shadowOpacity: 0.4 });
  }
  const spanner = new T.Group();
  spanner.add(sb(0.03, 0.012, 0.22, mat("pewter", 1, 1, "#9aa2aa"), 0, 0, 0));
  spanner.add(sb(0.07, 0.014, 0.06, mat("pewter", 1, 1, "#a8b0b8"), 0, 0, 0.13));
  spanner.add(sb(0.06, 0.014, 0.05, mat("pewter", 1, 1, "#a8b0b8"), 0, 0, -0.12));
  R.place(freeze(spanner), 0.6, 0.012, 1.7, { ry: 0.7, shadowOpacity: 0.5 });

  R.light({ x: 0, y: 1.2, z: -2.6, color: "#6f8ab0", intensity: 1.1, distance: 4.2, decay: 1.6, tag: "far" });
  R.light({ x: 0, y: 0.35, z: -0.9, color: "#e0a860", intensity: 1.3, distance: 3.0, decay: 1.6, tag: "floorGrate" });
  R.light({ x: W / 2 - 0.4, y: 1.0, z: 0.4, color: "#c08a5a", intensity: 0.9, distance: 2.8, decay: 1.7, tag: "grate1" });
  R.light({ x: -W / 2 + 0.4, y: 1.0, z: 2.4, color: "#7aa0c8", intensity: 0.9, distance: 2.8, decay: 1.7, tag: "grate2" });
  R.light({ x: 0, y: 1.0, z: D / 2 + 0.6, color: "#8a94a0", intensity: 0.7, distance: 3.4, decay: 1.7, tag: "mouth" });

  const ductRecess = { wall: "metal", tint: "#6a7684", floor: "metal", floorTint: "#6a7684", w: 1.7, h: 1.5, dep: 2.2 };
  recessBox(R, -W / 2 - 0.18, 1.4, Math.PI / 2, ductRecess);
  recessBox(R, W / 2 + 0.18, 1.6, -Math.PI / 2, ductRecess);
  recessBox(R, 0, -D / 2 - 0.18, 0, { wall: "metal", tint: "#5e6a78", floor: "metal", floorTint: "#5e6a78", w: 1.8, h: 1.6, dep: 3.0 });

  R.mood({ fog: { color: "#06080a", near: 2.5, far: 12 }, ambient: { color: "#1e2833", intensity: 0.42 } });
  R.cam("main", [0.35, 1.42, 2.75], [0, 0.75, -2.8], 74);
  R.anchor("s0", -0.45, 0.06, -2.3, 0.2);
  R.anchor("s1", 0.4, 0.06, -0.5, -0.3);
  R.anchor("s2", -0.2, 0.06, 1.3, 0.1);
}

/* --- CAM 08 · THE REPAIR WORKSHOP ----------------------------------
   Where they get mended. A bench, a pegboard, a half-finished figure on
   a stand with no head on it yet, and drawers of parts. On the second
   night this camera stops working and nobody says why. */
function buildWorkshop(R) {
  const W = 5.2, D = 5.6, H = 2.9;
  const rnd = R.rnd;
  R.add(freeze(shell({
    w: W, d: D, h: H,
    floor: mat("floorWood", 4, 4, "#8a6a48"),
    wall: mat("wallGreen", 2.6, 1.2, "#6e7a6a"),
    ceil: mat("wallGreen", 2, 2, "#454e44"),
    jamb: mat("woodDark", 0.6, 0.6, "#6a4a30"),
    joists: true,
    openings: { s: [{ x: 1.4, w: 1.2, h: 2.2 }] },
    aoFloor: 0.55, aoWall: 0.36,
  })));

  /* the bench: a slab top on a braced frame, with a vice on the corner */
  const bench = new T.Group();
  const topM = mat("woodDark", 2, 1, "#7a5a3a");
  bench.add(sb(3.0, 0.08, 0.8, topM, 0, 0.9, 0));
  bench.add(sb(3.0, 0.05, 0.1, mat("woodShelf", 2, 1, "#a8825a"), 0, 0.86, 0.4));
  for (const sx of [-1, 1]) {
    bench.add(sb(0.1, 0.86, 0.1, mat("woodDark", 1, 1, "#5e4028"), sx * 1.4, 0.43, -0.32));
    bench.add(sb(0.1, 0.86, 0.1, mat("woodDark", 1, 1, "#5e4028"), sx * 1.4, 0.43, 0.32));
    bench.add(sb(0.08, 0.08, 0.72, mat("woodDark", 1, 1, "#54381f"), sx * 1.4, 0.18, 0));
  }
  bench.add(sb(2.9, 0.06, 0.7, mat("woodDark", 2, 1, "#5e4028"), 0, 0.2, 0));
  /* a drawer bank under one end */
  for (let i = 0; i < 3; i++) {
    bench.add(sb(0.8, 0.2, 0.03, mat("woodShelf", 1, 1, "#a8825a"), -0.9, 0.36 + i * 0.24, 0.39));
    bench.add(at(new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.14, 6), mat("brass", 1, 1, "#c8a260")), -0.9, 0.36 + i * 0.24, 0.42, 0, 0, Math.PI / 2));
  }
  /* the vice */
  const vice = new T.Group();
  vice.add(sb(0.2, 0.1, 0.16, mat("pewter", 1, 1, "#7a828a"), 0, 0.05, 0));
  vice.add(sb(0.22, 0.16, 0.05, mat("pewter", 1, 1, "#8a929a"), 0, 0.14, -0.06));
  vice.add(sb(0.22, 0.16, 0.05, mat("pewter", 1, 1, "#8a929a"), 0, 0.14, 0.08));
  vice.add(at(new T.Mesh(new T.CylinderGeometry(0.016, 0.016, 0.3, 8), mat("pewter", 1, 1, "#9aa2aa")), 0, 0.14, 0.2, Math.PI / 2));
  vice.add(at(new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.2, 6), mat("pewter", 1, 1, "#a8b0b8")), 0, 0.14, 0.34, 0, 0, Math.PI / 2));
  at(vice, 1.18, 0.94, -0.1, 0, 0.2, 0);
  bench.add(vice);
  /* tools laid out, none of them the same */
  for (let i = 0; i < 6; i++) {
    const t = new T.Group();
    const L = range(rnd, 0.14, 0.26);
    t.add(sb(range(rnd, 0.02, 0.035), 0.012, L, mat("pewter", 1, 1, "#98a0a8"), 0, 0, 0));
    t.add(sb(range(rnd, 0.03, 0.05), 0.024, range(rnd, 0.05, 0.09), mat("woodDark", 1, 1, "#7a4a2a"), 0, 0.006, -L / 2 - 0.03));
    at(t, -0.6 + i * 0.34 + range(rnd, -0.06, 0.06), 0.946, range(rnd, -0.24, 0.24), 0, range(rnd, -1.2, 1.2), 0);
    const ts = contactShadow(t, { y: 0.946, opacity: 0.4 });
    if (ts) bench.add(ts);
    bench.add(t);
  }
  R.place(freeze(bench), -0.4, 0, -D / 2 + 0.55, { shadowOpacity: 0.74 });

  /* the pegboard over it, with hooks and outlines of the missing tools */
  const peg = new T.Group();
  peg.add(sb(2.4, 1.0, 0.04, mat("enamelCream", 2, 1, "#8a7a58"), 0, 0, 0));
  for (let y = 0; y < 6; y++) for (let x = 0; x < 14; x++) {
    if ((x + y) % 3) continue;
    peg.add(at(new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 0.05, 6), flat("#3a3228")), -1.1 + x * 0.17, -0.42 + y * 0.17, 0.03, Math.PI / 2));
  }
  for (let i = 0; i < 7; i++) {
    const x = -1.0 + i * 0.32, y = range(rnd, -0.3, 0.32);
    peg.add(at(new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.09, 5), mat("pewter", 1, 1, "#9aa2aa")), x, y, 0.05, Math.PI / 2));
    if (i % 3 === 2) continue;                       // a hook with nothing on it
    peg.add(sb(range(rnd, 0.03, 0.05), range(rnd, 0.16, 0.3), 0.02, mat("pewter", 1, 1, "#8a929a"), x, y - 0.14, 0.06));
    peg.add(sb(range(rnd, 0.04, 0.06), 0.07, 0.03, mat("woodDark", 1, 1, "#7a4a2a"), x, y - 0.28, 0.06));
  }
  R.place(freeze(peg), -0.4, 1.72, -D / 2 + 0.14, { shadow: false });

  /* the one on the stand: a body with no head, which is the thing you
     are meant to notice is still there */
  const stand = new T.Group();
  stand.add(at(new T.Mesh(new T.CylinderGeometry(0.28, 0.32, 0.05, 16), mat("pewter", 1, 1, "#7a828a")), 0, 0.025, 0));
  stand.add(at(new T.Mesh(new T.CylinderGeometry(0.04, 0.05, 1.1, 10), mat("pewter", 1, 1, "#8a929a")), 0, 0.6, 0));
  stand.add(at(new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.06, 10), mat("brass", 1, 1, "#c8a260")), 0, 1.14, 0));
  const torso = new T.Group();
  torso.add(sb(0.42, 0.52, 0.26, mat("enamelBlue", 1, 1, "#5a6e84"), 0, 0, 0));
  torso.add(sb(0.2, 0.2, 0.03, flat("#14161a"), 0, 0.05, 0.135));
  torso.add(at(new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.02, 12), mat("brass", 1, 1, "#d0aa64")), 0, 0.05, 0.15, Math.PI / 2));
  torso.add(at(new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.02, 10), mat("brass", 1, 1, "#b8945a")), 0.06, -0.02, 0.152, Math.PI / 2));
  torso.add(sb(0.46, 0.06, 0.3, mat("pewter", 1, 1, "#8a929a"), 0, 0.28, 0));
  /* a neck socket with nothing in it */
  torso.add(at(new T.Mesh(new T.CylinderGeometry(0.07, 0.08, 0.08, 12), mat("pewter", 1, 1, "#6a727a")), 0, 0.34, 0));
  torso.add(at(new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.02, 12), flat("#0d0f12")), 0, 0.38, 0));
  for (const sx of [-1, 1]) {
    torso.add(at(new T.Mesh(new T.CylinderGeometry(0.055, 0.05, 0.34, 9), mat("enamelBlue", 1, 1, "#4e6274")), sx * 0.26, -0.12, 0, 0, 0, sx * 0.2));
  }
  at(torso, 0, 1.42, 0, 0, -0.4, 0);
  stand.add(torso);
  R.place(freeze(stand), 1.5, 0, 0.4, { shadowOpacity: 0.72 });

  /* parts bins, a stool, a swept pile of sawdust */
  for (let i = 0; i < 6; i++) {
    const bin = new T.Group();
    bin.add(sb(0.3, 0.18, 0.24, mat("enamelRed", 1, 1, pick(rnd, ["#a8544a", "#7a8a94", "#8a7a4a"])), 0, 0.09, 0));
    bin.add(sb(0.32, 0.03, 0.26, mat("metal", 1, 1, "#8a9098"), 0, 0.185, 0));
    bin.add(sb(0.16, 0.04, 0.02, mat("brass", 1, 1, "#c8a260"), 0, 0.1, 0.13));
    for (let k = 0; k < 3; k++) {
      bin.add(at(new T.Mesh(new T.SphereGeometry(range(rnd, 0.02, 0.035), 7, 6), mat("brass", 1, 1, "#c09a56")),
        range(rnd, -0.09, 0.09), 0.19, range(rnd, -0.07, 0.07)));
    }
    R.place(freeze(bin), -W / 2 + 0.35 + (i % 2) * 0.36, ((i / 2) | 0) * 0.2, 0.4 + ((i / 2) | 0) * 0.05,
      { ry: range(rnd, -0.2, 0.2), shadowOpacity: 0.6 });
  }
  R.place(freeze(KIT.chair(1, rnd)), 0.3, 0, -1.1, { ry: 0.6, shadowOpacity: 0.7 });
  R.place(freeze(KIT.crate(0, rnd)), W / 2 - 0.6, 0, 2.0, { ry: -0.5, shadowOpacity: 0.72 });
  R.place(freeze(KIT.shelf(2, rnd, { w: 1.5, h: 1.5 })), W / 2 - 0.3, 0, -1.5, { ry: -Math.PI / 2, shadowOpacity: 0.72 });
  R.place(freeze(KIT.grate(3, rnd)), -W / 2 + 0.09, 2.4, -1.2, { ry: Math.PI / 2, shadow: false });
  R.place(freeze(KIT.decor(1, rnd)), W / 2 - 0.09, 2.0, 1.2, { ry: -Math.PI / 2, shadow: false });

  /* one work lamp on an arm over the bench, and a bulb by the door */
  R.place(freeze(KIT.bulb("desk")), 0.9, 0.94, -D / 2 + 0.4, { ry: -0.8, s: 1.5, shadowOpacity: 0.45 });
  R.place(freeze(KIT.bulb("pendant", "#5e564a")), 1.2, 2.4, 1.4, { shadow: false });

  R.light({ x: 0.5, y: 1.5, z: -D / 2 + 0.7, color: "#ffcc86", intensity: 2.1, distance: 4.6, decay: 1.5, tag: "work" });
  R.light({ x: 1.2, y: 2.2, z: 1.4, color: "#ffd0a0", intensity: 1.0, distance: 5.4, decay: 1.5, tag: "pendant" });
  R.light({ x: 1.5, y: 1.5, z: 0.4, color: "#6a86a8", intensity: 0.5, distance: 2.6, decay: 1.8, tag: "stand" });
  R.light({ x: 1.4, y: 1.7, z: D / 2 + 0.7, color: "#c07a5a", intensity: 0.8, distance: 3.6, decay: 1.7, tag: "stageSpill" });
  R.light({ x: -1.8, y: 1.2, z: 1.8, color: "#4e5a6a", intensity: 0.5, distance: 3.0, decay: 1.8, tag: "corner" });

  recessBox(R, 1.4, D / 2 + 0.18, Math.PI, { tint: "#7e8c7e", floor: "floorStage", w: 2.0, h: 2.4 });

  R.mood({ fog: { color: "#080a08", near: 4, far: 18 }, ambient: { color: "#242a24", intensity: 0.44 } });
  R.cam("main", [-1.9, 2.4, 2.3], [0.4, 1.0, -1.7], 66);
  R.anchor("s0", 1.5, 0, 0.4, -0.4);
  R.anchor("s1", -1.0, 0, -0.4, 0.6);
  R.anchor("s2", 0.2, 0, 1.5, 0.1);
}

/* =========================================================
   15b. THE PERFORMERS

   Four figures, four silhouettes, nothing shared between them. Each is
   built once at boot, faces +Z, and carries a `joints` record so the
   frame loop can pose it — the only geometry in the game that is
   allowed to move besides the shutters.

   They are deliberately readable as shapes before they are readable as
   detail: a square-shouldered column with a tall hat, a wide low disc
   with two lit eyes, a narrow cone on a plinth, and a lanky thing with
   three points on its head. In a doorway with one bulb behind it, the
   silhouette is all the player gets, and it has to be enough.
   ========================================================= */
const MODELS = {};

/* Every figure is built at whatever size its parts came out, then sat on
   the floor and scaled to the height it is supposed to be. Doing it here
   rather than by hand means a change to one part cannot leave a
   performer standing three centimetres into the carpet, which is exactly
   the class of fault this build is trying not to repeat. */
function fitFigure(g, targetH) {
  const b = new T.Box3().setFromObject(g);
  const h = Math.max(0.01, b.max.y - b.min.y);
  const k = targetH / h;
  const inner = new T.Group();
  while (g.children.length) inner.add(g.children[0]);
  inner.scale.setScalar(k);
  inner.position.y = -b.min.y * k;
  g.add(inner);
  g.userData.height = targetH;
  if (g.userData.eyeY) g.userData.eyeY = (g.userData.eyeY - b.min.y) * k;
  return g;
}

/* --- OUISSY -----------------------------------------------------------
   The guard, and the only person in the building. She stands in the
   office doorway on the title screen and nowhere else during a shift —
   during a shift you are behind her eyes, and what you see of her is
   her own hands on the desk.

   Same palette as the racer, translated up: the long centre-parted
   brown hair, the cream varsity jacket with coral sleeves, and the
   goggles she never actually wears pushed up on her forehead. */
MODELS.ouissy = function () {
  const g = new T.Group();
  const joints = {};
  /* a step darker than her sheet colour: these are the closest things in
     the room to the desk lamp, and at half a metre the sheet tone tone-maps
     to flat white */
  const skin = flat(OUI.handSkin);
  const skinSh = flat(OUI.skinSh);
  const jacket = mat("porcelain", 1, 1, OUI.jacket);
  const sleeve = flat(OUI.sleeve);
  const hair = flat(OUI.hair);
  const hairMid = flat(OUI.hairMid);

  /* jeans and boots */
  [["legL", -1], ["legR", 1]].forEach(([k, sx]) => {
    const hip = part(sx * 0.1, 0.86, 0);
    hip.add(at(new T.Mesh(new T.CylinderGeometry(0.075, 0.062, 0.48, 10), flat(OUI.jeans)), 0, -0.24, 0));
    hip.add(at(new T.Mesh(new T.CylinderGeometry(0.062, 0.055, 0.36, 10), flat(OUI.jeans)), 0, -0.62, 0));
    hip.add(sb(0.11, 0.08, 0.22, flat(OUI.boot), 0, -0.83, 0.03));
    hip.add(sb(0.115, 0.05, 0.1, flat("#4a3428"), 0, -0.86, -0.02));
    g.add(hip);
    joints[k] = hip;
  });

  /* the varsity jacket: a body, a coral band at the hem, two coral
     sleeves and a collar */
  const torso = part(0, 0, 0);
  torso.add(at(new T.Mesh(new T.CylinderGeometry(0.19, 0.165, 0.46, 12), jacket), 0, 1.09, 0));
  torso.add(at(new T.Mesh(new T.CylinderGeometry(0.168, 0.168, 0.07, 12), sleeve), 0, 0.89, 0));
  torso.add(at(new T.Mesh(new T.SphereGeometry(0.2, 12, 9), jacket), 0, 1.3, 0, 0, 0, 0, 1.08, 0.62, 0.86));
  /* the zip and a rose stripe down it */
  torso.add(sb(0.022, 0.44, 0.02, flat(OUI.jacketSh), 0, 1.09, 0.168));
  torso.add(sb(0.05, 0.1, 0.02, flat(OUI.accent), 0.075, 1.2, 0.166));
  /* the collar */
  torso.add(at(new T.Mesh(new T.CylinderGeometry(0.105, 0.135, 0.075, 12), sleeve), 0, 1.36, 0));
  g.add(torso);
  joints.torso = torso;

  [["armL", -1], ["armR", 1]].forEach(([k, sx]) => {
    const sh = part(sx * 0.21, 1.32, 0);
    sh.add(at(new T.Mesh(new T.CylinderGeometry(0.062, 0.05, 0.3, 10), sleeve), sx * 0.02, -0.16, 0, 0, 0, -sx * 0.1));
    sh.add(at(new T.Mesh(new T.CylinderGeometry(0.05, 0.044, 0.26, 10), sleeve), sx * 0.05, -0.42, 0.01, 0.08, 0, -sx * 0.06));
    sh.add(at(new T.Mesh(new T.CylinderGeometry(0.047, 0.047, 0.045, 10), jacket), sx * 0.06, -0.55, 0.01));
    sh.add(at(new T.Mesh(new T.SphereGeometry(0.05, 10, 8), skin), sx * 0.065, -0.62, 0.015, 0, 0, 0, 0.85, 1.15, 0.9));
    g.add(sh);
    joints[k] = sh;
  });

  /* the head: a face, then the hair over and behind it, then goggles */
  const head = part(0, 1.44, 0);
  head.add(at(new T.Mesh(new T.CylinderGeometry(0.05, 0.058, 0.07, 10), skinSh), 0, 0.02, 0));
  head.add(at(new T.Mesh(new T.SphereGeometry(0.125, 16, 12), skin), 0, 0.13, 0, 0, 0, 0, 0.93, 1.08, 0.95));
  /* the hair: a crown, two long curtains at the sides and a mass down
     the back — never a full sphere, which swallows the face whole */
  head.add(at(new T.Mesh(new T.SphereGeometry(0.132, 16, 12), hair), 0, 0.145, -0.022, 0, 0, 0, 1.02, 1.03, 0.86));
  for (const sx of [-1, 1]) {
    head.add(at(new T.Mesh(new T.CylinderGeometry(0.045, 0.055, 0.42, 9), hair), sx * 0.108, -0.03, -0.01, 0, 0, sx * 0.05));
    head.add(at(new T.Mesh(new T.SphereGeometry(0.05, 10, 8), hairMid), sx * 0.112, -0.23, -0.01));
  }
  head.add(at(new T.Mesh(new T.SphereGeometry(0.115, 12, 10), hair), 0, 0.06, -0.11, 0, 0, 0, 1.1, 1.5, 0.7));
  head.add(sb(0.11, 0.05, 0.06, hairMid, 0, 0.225, 0.075));
  head.add(sb(0.012, 0.05, 0.05, flat(OUI.hairHi), 0, 0.235, 0.088));   // the parting
  /* the goggles, up on her forehead where she keeps them */
  head.add(at(new T.Mesh(new T.TorusGeometry(0.125, 0.021, 6, 20, Math.PI * 1.2), flat(OUI.goggle)), 0, 0.2, 0.012, 0, 0, -0.6));
  for (const sx of [-1, 1]) {
    head.add(at(new T.Mesh(new T.CylinderGeometry(0.042, 0.042, 0.03, 12), flat(OUI.goggle)), sx * 0.055, 0.215, 0.088, Math.PI / 2 - 0.3));
    const lens = new T.Mesh(new T.CylinderGeometry(0.032, 0.032, 0.014, 12), glow(OUI.lens, 0.9));
    head.add(at(lens, sx * 0.055, 0.216, 0.1, Math.PI / 2 - 0.3));
    /* eyes */
    const eye = new T.Mesh(new T.SphereGeometry(0.017, 10, 8), flat(OUI.ink));
    eye.userData.eye = true;
    head.add(at(eye, sx * 0.045, 0.115, 0.105));
    head.add(at(new T.Mesh(new T.SphereGeometry(0.006, 6, 5), flat("#ffffff")), sx * 0.052, 0.126, 0.116));
    head.add(at(new T.Mesh(new T.SphereGeometry(0.028, 8, 6), flat(OUI.blush)), sx * 0.075, 0.078, 0.09, 0, 0, 0, 1, 0.5, 0.35));
  }
  head.add(at(new T.Mesh(new T.SphereGeometry(0.014, 8, 6), skinSh), 0, 0.1, 0.118));
  head.add(sb(0.03, 0.009, 0.012, flat("#b0576a"), 0, 0.068, 0.114));
  g.add(head);
  joints.head = head;

  g.userData.joints = joints;
  g.userData.eyeY = 1.555;
  return fitFigure(g, 1.66);
};

/* --- her hands, from where she is sitting ----------------------------
   The one part of her that is on screen during a shift. Two forearms in
   coral sleeves coming in at the bottom corners with her hands flat on
   the desk, and they answer to what she does: the hand on a door's side
   lifts and presses when that door moves, and now and then the fingers
   drum on their own.

   Sized and placed against the seat's camera — the frame covers about
   six degrees up from the eye line to forty-three down, so anything
   meant to be visible from the chair has to be roughly a metre out and
   eighty centimetres below it. Nearer than that and it is behind the
   bottom edge of the picture. */
function buildHands() {
  const g = new T.Group();
  const sleeve = flat(OUI.handSleeve);
  const cuff = mat("porcelain", 1, 1, "#cfc3b0");
  const skin = flat(OUI.handSkin);
  const skinLo = flat(OUI.handSkinLo);
  const nail = flat(OUI.handNail);
  const out = { group: g, hands: {} };

  /* One finger, built the way a finger is built: three segments that
     each taper and each bend a little further than the one before, so
     the whole thing curls instead of pointing. `len` scales it — the
     middle finger is the long one, the little finger is two thirds of
     it — and `curl` is how far this particular finger has relaxed onto
     the desk. The old version was one cylinder and a ball, and it read
     as a fork. */
  function finger(len, curl, thick) {
    const root = new T.Group();
    const r0 = 0.0132 * thick, r1 = 0.0118 * thick, r2 = 0.0102 * thick;
    const L0 = 0.040 * len, L1 = 0.027 * len, L2 = 0.021 * len;

    /* proximal — leaves the knuckle almost flat */
    root.rotation.x = -0.085 * curl;
    root.add(at(new T.Mesh(new T.CylinderGeometry(r0, r1, L0, 10), skin),
                0, 0, -L0 / 2, Math.PI / 2));
    /* the knuckle itself, sitting proud on the back of the hand */
    root.add(at(new T.Mesh(new T.SphereGeometry(r0 * 1.16, 10, 8), skin),
                0, 0.0016, 0.002, 0, 0, 0, 1, 0.92, 1));

    const mid = part(0, 0, -L0);
    mid.rotation.x = -0.20 * curl;
    mid.add(at(new T.Mesh(new T.CylinderGeometry(r1, r2, L1, 10), skin),
               0, 0, -L1 / 2, Math.PI / 2));
    mid.add(at(new T.Mesh(new T.SphereGeometry(r1 * 1.04, 10, 8), skin), 0, 0, 0));

    const tip = part(0, 0, -L1);
    tip.rotation.x = -0.26 * curl;
    tip.add(at(new T.Mesh(new T.CylinderGeometry(r2, r2 * 0.9, L2, 10), skin),
               0, 0, -L2 / 2, Math.PI / 2));
    /* the pad of the fingertip, rounded off, and a nail on the back of
       it — small, but it is the thing that stops a finger reading as a
       peg */
    tip.add(at(new T.Mesh(new T.SphereGeometry(r2 * 0.98, 10, 8), skin),
               0, 0, -L2, 0, 0, 0, 1, 0.86, 1.12));
    tip.add(at(new T.Mesh(new T.SphereGeometry(r2 * 0.66, 8, 6), nail),
               0, r2 * 0.56, -L2 * 0.80, 0.30, 0, 0, 1, 0.30, 1.45));
    mid.add(tip);
    root.add(mid);
    return root;
  }

  [["left", -1], ["right", 1]].forEach(([k, sx]) => {
    /* Sat where a person's hands actually are: on the near half of the
       desk (which runs z 0.78 to 1.58), not up by the monitor, and a
       little over life size so they still read at the bottom of a
       seventy-four degree frame. */
    const arm = part(sx * (sx < 0 ? 0.615 : 0.635), 0.818, sx < 0 ? 1.31 : 1.30);
    arm.rotation.y = -sx * 0.30;
    /* almost flat: a fifth of a radian of tilt was lifting the fingertips
       a clear inch off the desk and the shadow underneath gave it away */
    arm.rotation.x = -0.035;
    arm.scale.setScalar(1.22);
    /* the forearm runs back out of shot; the cuff is the bit of coral
       and cream you actually see, right on the bottom edge */
    arm.add(at(new T.Mesh(new T.CylinderGeometry(0.062, 0.052, 0.44, 12), sleeve), 0, 0.014, 0.28, Math.PI / 2 + 0.05));
    arm.add(at(new T.Mesh(new T.CylinderGeometry(0.056, 0.056, 0.05, 12), cuff), 0, 0.008, 0.068, Math.PI / 2));
    arm.add(at(new T.Mesh(new T.TorusGeometry(0.055, 0.0075, 5, 14), flat(OUI.accent)), 0, 0.008, 0.094, Math.PI / 2));

    const hand = part(0, 0.004, -0.055);
    hand.rotation.x = -0.06;
    /* the wrist, then the back of the hand as a wedge that is wider at
       the knuckles than at the wrist — a hand is not a ball */
    hand.add(at(new T.Mesh(new T.CylinderGeometry(0.044, 0.048, 0.05, 12), skin),
                0, 0.001, 0.052, Math.PI / 2));
    hand.add(at(new T.Mesh(new T.BoxGeometry(0.098, 0.030, 0.088), skin),
                0, 0, 0.0, 0, 0, 0));
    /* rounded off along both edges so the box never shows a corner */
    hand.add(at(new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.088, 10), skin),
                -0.049, 0, 0, Math.PI / 2, 0, 0, 1, 1, 0.92));
    hand.add(at(new T.Mesh(new T.CylinderGeometry(0.016, 0.016, 0.088, 10), skin),
                0.049, 0, 0, Math.PI / 2, 0, 0, 1, 1, 0.92));
    /* the heel of the palm, resting on the desk, in the shaded tone */
    hand.add(at(new T.Mesh(new T.SphereGeometry(0.036, 12, 9), skinLo),
                0, -0.008, 0.030, 0, 0, 0, 1.25, 0.62, 1));

    /* index, middle, ring, little: real lengths, and each one a little
       more relaxed than the last, which is what a resting hand does */
    const spread = [-0.038, -0.013, 0.013, 0.037];
    const lens   = [0.97, 1.06, 0.99, 0.80];
    const curls  = [0.85, 0.78, 0.90, 1.05];
    const thicks = [1.0, 1.02, 0.95, 0.85];
    const fan    = [-0.13, -0.04, 0.05, 0.15];
    for (let i = 0; i < 4; i++) {
      const f = finger(lens[i], curls[i], thicks[i]);
      f.position.set(spread[i] * (sx < 0 ? -1 : 1), 0.004, -0.043);
      f.rotation.y = fan[i] * (sx < 0 ? -1 : 1);
      hand.add(f);
    }

    /* the thumb comes off the side of the palm, not the front, and it
       is the one that faces the others */
    const thumb = part(sx * -0.050, -0.006, 0.014);
    thumb.rotation.set(0.16, sx * 0.92, sx * -0.30);
    const tb = finger(0.86, 0.62, 1.28);
    thumb.add(tb);
    hand.add(thumb);

    arm.add(hand);
    out.hands[k] = hand;
    const sh = contactShadow(hand, { y: -0.006, opacity: 0.34, spread: 1.15 });
    if (sh) arm.add(sh);
    g.add(arm);
  });
  return out;
}

/* --- COGSWORTH: a tin soldier, a metre and nine, all right angles --- */
MODELS.cogsworth = function () {
  const g = new T.Group();
  const rnd = rngFor("cogsworth");
  const joints = {};

  const tunic = mat("enamelRed", 1, 1.4, "#c05248");
  const trews = mat("enamelBlue", 1, 1.4, "#3c4a68");
  const brass = mat("brass", 1, 1, "#d0a860");
  const black = flat("#1c1c22");
  const white = flat("#d8d2c4");

  /* boots and legs, each on its own hinge so he can march */
  [["legL", -1], ["legR", 1]].forEach(([k, sx]) => {
    const hip = part(sx * 0.13, 0.86, 0);
    hip.add(sb(0.17, 0.5, 0.17, trews, 0, -0.25, 0));
    hip.add(sb(0.185, 0.09, 0.19, black, 0, -0.5, 0));
    hip.add(sb(0.19, 0.34, 0.2, black, 0, -0.68, 0));
    hip.add(sb(0.2, 0.09, 0.3, black, 0, -0.83, 0.06));
    hip.add(sb(0.21, 0.04, 0.32, flat("#0f0f13"), 0, -0.87, 0.07));
    /* a red seam down the outside of the trouser */
    hip.add(sb(0.02, 0.5, 0.18, flat("#a8443c"), sx * 0.086, -0.25, 0));
    g.add(hip);
    joints[k] = hip;
  });

  /* the body: a squared-off tunic with a brass gear where a heart goes */
  const torso = part(0, 0, 0);
  torso.add(sb(0.46, 0.56, 0.28, tunic, 0, 1.14, 0));
  torso.add(sb(0.5, 0.09, 0.31, brass, 0, 0.87, 0));            // waist plate
  torso.add(sb(0.52, 0.1, 0.3, black, 0, 0.92, 0));             // belt
  torso.add(sb(0.14, 0.11, 0.04, brass, 0, 0.92, 0.155));       // buckle
  /* cross belts, two real straps at an angle */
  for (const sx of [-1, 1]) torso.add(sb(0.07, 0.62, 0.03, white, 0, 1.16, 0.152, 0, 0, sx * 0.42));
  /* the frogging: four bars of braid across the lower tunic, which is
     what stops the coat reading as a red box */
  for (let i = 0; i < 3; i++) {
    torso.add(sb(0.3 - i * 0.03, 0.026, 0.03, brass, 0, 0.98 + i * 0.075, 0.146));
  }
  torso.add(sb(0.4, 0.07, 0.29, brass, 0, 1.42, 0));            // collar
  /* six buttons, in two rows */
  for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) {
    const b = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 0.016, 10), brass);
    torso.add(at(b, sx * 0.11, 1.02 + i * 0.14, 0.145, Math.PI / 2));
  }
  /* the movement, showing through a cut-out in his chest */
  torso.add(sb(0.21, 0.21, 0.03, flat("#14161a"), 0, 1.31, 0.144));
  torso.add(sb(0.23, 0.024, 0.035, brass, 0, 1.42, 0.15));
  torso.add(sb(0.23, 0.024, 0.035, brass, 0, 1.2, 0.15));
  const gear = new T.Mesh(new T.CylinderGeometry(0.082, 0.082, 0.018, 14), brass);
  at(gear, 0, 1.31, 0.158, Math.PI / 2);
  torso.add(gear);
  joints.gear = gear;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    gear.add(at(sb(0.026, 0.02, 0.03, brass, Math.cos(a) * 0.082, 0, Math.sin(a) * 0.082, 0, 0, 0), 0, 0, 0));
  }
  /* epaulettes with real bullion */
  for (const sx of [-1, 1]) {
    torso.add(sb(0.16, 0.05, 0.2, brass, sx * 0.24, 1.4, 0));
    for (let i = 0; i < 4; i++) {
      torso.add(sb(0.02, 0.09, 0.02, brass, sx * (0.19 + i * 0.035), 1.35, 0.03));
    }
  }
  /* the key in his back — the thing you hear */
  const key = part(0, 1.24, -0.16);
  const shaft = new T.Mesh(new T.CylinderGeometry(0.024, 0.024, 0.1, 8), brass);
  key.add(at(shaft, 0, 0, -0.05, Math.PI / 2));
  for (const rz of [0, Math.PI / 2]) {
    const wing = sb(0.19, 0.06, 0.018, brass, 0, 0, -0.09, 0, 0, rz);
    key.add(wing);
  }
  torso.add(key);
  joints.key = key;
  g.add(torso);
  joints.torso = torso;

  /* arms, hinged at the shoulder, gloved */
  [["armL", -1], ["armR", 1]].forEach(([k, sx]) => {
    const sh = part(sx * 0.27, 1.36, 0);
    sh.add(sb(0.14, 0.34, 0.15, tunic, 0, -0.17, 0));
    sh.add(sb(0.15, 0.05, 0.16, brass, 0, -0.36, 0));
    sh.add(sb(0.13, 0.26, 0.14, tunic, 0, -0.51, 0));
    sh.add(sb(0.145, 0.045, 0.155, brass, 0, -0.62, 0));         // cuff
    sh.add(sb(0.14, 0.14, 0.15, white, 0, -0.71, 0.01));
    g.add(sh);
    joints[k] = sh;
  });

  /* the head: a block, a jaw on a hinge, a shako over it */
  const head = part(0, 1.46, 0);
  head.add(sb(0.28, 0.24, 0.26, mat("porcelain", 1, 1, "#e0cdb6"), 0, 0.14, 0));
  /* eyes, wide and painted, with a black pupil that catches a highlight */
  for (const sx of [-1, 1]) {
    head.add(sb(0.08, 0.09, 0.02, white, sx * 0.07, 0.17, 0.132));
    const p = new T.Mesh(new T.SphereGeometry(0.024, 8, 6), flat("#101018"));
    head.add(at(p, sx * 0.07, 0.17, 0.142));
    head.add(sb(0.09, 0.02, 0.022, flat("#2b2119"), sx * 0.07, 0.225, 0.133));  // brow
    const ch = new T.Mesh(new T.SphereGeometry(0.03, 8, 6), flat("#c86a62"));
    head.add(at(ch, sx * 0.105, 0.09, 0.115, 0, 0, 0, 1, 0.6, 0.35));
  }
  /* moustache, and the hinged jaw under it */
  head.add(sb(0.15, 0.028, 0.03, flat("#3a2a20"), 0, 0.075, 0.13));
  const jaw = part(0, 0.055, -0.02);
  jaw.add(sb(0.24, 0.08, 0.22, mat("porcelain", 1, 1, "#dcc8b0"), 0, -0.04, 0.02));
  jaw.add(sb(0.19, 0.02, 0.02, flat("#8a3a34"), 0, -0.005, 0.115));
  head.add(jaw);
  joints.jaw = jaw;
  /* the shako: a tall drum, a peak, a brass plate and a plume */
  head.add(sb(0.3, 0.04, 0.28, black, 0, 0.27, 0));
  head.add(sb(0.29, 0.3, 0.27, black, 0, 0.43, 0));
  head.add(sb(0.31, 0.035, 0.29, black, 0, 0.59, 0));
  head.add(sb(0.3, 0.03, 0.1, black, 0, 0.26, 0.16, 0, -0.25));   // the peak
  head.add(sb(0.13, 0.13, 0.02, brass, 0, 0.44, 0.14));
  head.add(sb(0.31, 0.035, 0.29, brass, 0, 0.325, 0));
  const plume = new T.Mesh(new T.CylinderGeometry(0.03, 0.055, 0.18, 8), flat("#b8443c"));
  head.add(at(plume, 0, 0.68, 0));
  head.add(at(new T.Mesh(new T.SphereGeometry(0.05, 10, 8), brass), 0, 0.6, 0));
  head.add(at(new T.Mesh(new T.CylinderGeometry(0.045, 0.06, 0.06, 10), brass), 0, 0.61, 0));
  g.add(head);
  joints.head = head;

  g.userData.joints = joints;
  g.userData.eyeY = 1.63;
  void rnd;
  return fitFigure(g, 1.88);
};

/* --- CHIME: an owl, wide and low, made of riveted plate ------------- */
MODELS.chime = function () {
  const g = new T.Group();
  const joints = {};
  const plate = mat("pewter", 1, 1, "#96a0aa");
  const bronze = mat("brassDark", 1, 1, "#9a7c48");

  /* the body is a barrel, banded, with the bands proud of it */
  const body = part(0, 0, 0);
  const barrel = new T.Mesh(new T.CylinderGeometry(0.27, 0.32, 0.44, 14), plate);
  body.add(at(barrel, 0, 0.34, 0));
  for (let i = 0; i < 3; i++) {
    const band = new T.Mesh(new T.TorusGeometry(0.29 - i * 0.012, 0.018, 6, 18), bronze);
    body.add(at(band, 0, 0.2 + i * 0.14, 0, Math.PI / 2));
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const r = new T.Mesh(new T.SphereGeometry(0.014, 6, 5), bronze);
    body.add(at(r, Math.cos(a) * 0.3, 0.28, Math.sin(a) * 0.3));
  }
  /* a glass belly with the movement behind it */
  body.add(sb(0.2, 0.2, 0.03, flat("#12161c"), 0, 0.34, 0.28));
  const esc = new T.Mesh(new T.TorusGeometry(0.06, 0.012, 6, 16), bronze);
  at(esc, 0, 0.34, 0.3, 0, 0, 0);
  body.add(esc);
  joints.escape = esc;
  const pend = part(0, 0.34, 0.3);
  pend.add(at(new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 0.16, 5), bronze), 0, -0.08, 0));
  pend.add(at(new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.012, 12), bronze), 0, -0.16, 0, Math.PI / 2));
  body.add(pend);
  joints.pendulum = pend;
  g.add(body);

  /* the wings: three layered plates a side, folded back */
  [["wingL", -1], ["wingR", 1]].forEach(([k, sx]) => {
    const w = part(sx * 0.27, 0.42, -0.02);
    for (let i = 0; i < 3; i++) {
      w.add(sb(0.09, 0.34 - i * 0.05, 0.16, plate, sx * i * 0.045, -i * 0.05, -i * 0.05, 0, 0, sx * (0.1 + i * 0.08)));
      w.add(sb(0.095, 0.02, 0.17, bronze, sx * i * 0.045, -i * 0.05 - 0.16 + i * 0.025, -i * 0.05, 0, 0, sx * (0.1 + i * 0.08)));
    }
    g.add(w);
    joints[k] = w;
  });

  /* the head: a wide disc of a face, two brass eye rings, ear tufts */
  const head = part(0, 0.6, 0.01);
  head.add(at(new T.Mesh(new T.CylinderGeometry(0.25, 0.23, 0.2, 14), plate), 0, 0.1, 0, Math.PI / 2, 0, 0));
  head.add(sb(0.42, 0.34, 0.05, plate, 0, 0.1, 0.11));            // the facial disc
  head.add(sb(0.44, 0.03, 0.06, bronze, 0, 0.26, 0.11));
  for (const sx of [-1, 1]) {
    const ring = new T.Mesh(new T.TorusGeometry(0.082, 0.018, 6, 18), bronze);
    head.add(at(ring, sx * 0.11, 0.11, 0.135));
    const lens = new T.Mesh(new T.CylinderGeometry(0.072, 0.072, 0.02, 14), glow("#e8a94a"));
    lens.userData.eye = true;
    head.add(at(lens, sx * 0.11, 0.11, 0.14, Math.PI / 2));
    const pupil = new T.Mesh(new T.CylinderGeometry(0.026, 0.026, 0.022, 10), flat("#160f08"));
    head.add(at(pupil, sx * 0.11, 0.11, 0.146, Math.PI / 2));
    /* ear tufts, angled out */
    head.add(at(new T.Mesh(new T.ConeGeometry(0.045, 0.16, 6), plate), sx * 0.17, 0.29, 0.02, 0, 0, sx * 0.4));
  }
  const beak = new T.Mesh(new T.ConeGeometry(0.05, 0.13, 5), bronze);
  head.add(at(beak, 0, 0.03, 0.16, 1.35));
  g.add(head);
  joints.head = head;

  /* talons, so it is gripping something rather than hovering */
  for (const sx of [-1, 1]) {
    const foot = part(sx * 0.11, 0.1, 0.06);
    foot.add(at(new T.Mesh(new T.CylinderGeometry(0.022, 0.026, 0.11, 7), bronze), 0, -0.04, 0));
    for (let i = 0; i < 3; i++) {
      const a = -0.5 + i * 0.5;
      foot.add(sb(0.02, 0.02, 0.11, bronze, Math.sin(a) * 0.04, -0.1, 0.04 + Math.cos(a) * 0.02, a, 0.5));
    }
    g.add(foot);
  }

  g.userData.joints = joints;
  g.userData.eyeY = 0.71;
  return fitFigure(g, 0.86);
};

/* --- MARABELLE: porcelain, on the plinth she came with -------------- */
MODELS.marabelle = function () {
  const g = new T.Group();
  const joints = {};
  const skin = mat("porcelain", 1, 1, "#efe6da");
  const gilt = mat("brass", 1, 1, "#cfa860");
  const satin = mat("porcelain", 1, 1, "#e2b0c0");
  const net1 = flat("#f0d4dd", { side: T.DoubleSide });
  const net2 = flat("#e2b6c6", { side: T.DoubleSide });

  /* --- the music box she stands on: turned, gilt-lined, with the key --- */
  const base = part(0, 0, 0);
  base.add(at(new T.Mesh(new T.CylinderGeometry(0.28, 0.32, 0.13, 20), mat("woodDark", 1, 1, "#7a5236")), 0, 0.065, 0));
  base.add(at(new T.Mesh(new T.TorusGeometry(0.295, 0.016, 6, 22), gilt), 0, 0.132, 0, Math.PI / 2));
  base.add(at(new T.Mesh(new T.CylinderGeometry(0.21, 0.26, 0.06, 20), mat("woodDark", 1, 1, "#8a5f3e")), 0, 0.165, 0));
  base.add(at(new T.Mesh(new T.CylinderGeometry(0.135, 0.135, 0.03, 18), gilt), 0, 0.205, 0));
  base.add(at(new T.Mesh(new T.TorusGeometry(0.135, 0.008, 5, 20), gilt), 0, 0.222, 0, Math.PI / 2));
  /* four little feet, so it sits on something */
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    base.add(at(new T.Mesh(new T.SphereGeometry(0.028, 8, 6), gilt), Math.cos(a) * 0.24, 0.014, Math.sin(a) * 0.24));
  }
  const wind = part(0.29, 0.065, 0);
  wind.add(at(new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.08, 8), gilt), 0.035, 0, 0, 0, 0, Math.PI / 2));
  for (const rz of [0, Math.PI / 2]) wind.add(sb(0.12, 0.04, 0.013, gilt, 0.08, 0, 0, Math.PI / 2, 0, rz));
  base.add(wind);
  joints.wind = wind;
  g.add(base);

  /* --- the figure, everything above the plinth on one turning mount --- */
  const fig = part(0, 0.22, 0);

  /* the supporting leg, en pointe: a shoe block, ankle, calf, thigh */
  fig.add(at(new T.Mesh(new T.CylinderGeometry(0.028, 0.038, 0.07, 10), satin), -0.01, 0.035, 0.01, -0.12));
  fig.add(at(new T.Mesh(new T.CylinderGeometry(0.036, 0.028, 0.22, 10), skin), -0.015, 0.18, 0.008, -0.06));
  fig.add(at(new T.Mesh(new T.CylinderGeometry(0.045, 0.036, 0.24, 10), skin), -0.02, 0.4, 0));
  /* the ribbons up the ankle */
  for (let i = 0; i < 3; i++) {
    fig.add(at(new T.Mesh(new T.TorusGeometry(0.032 + i * 0.001, 0.005, 4, 12), satin), -0.014, 0.1 + i * 0.035, 0.008, Math.PI / 2 - 0.2));
  }

  /* the raised leg, out behind and up — the line that makes her hers.
     Built as three segments on a hinge so the arabesque is a real pose
     and not a flat cutout of one. */
  const back = part(0.0, 0.5, -0.02);
  back.rotation.x = 1.05;
  back.add(at(new T.Mesh(new T.CylinderGeometry(0.045, 0.036, 0.26, 10), skin), 0.03, -0.13, 0));
  back.add(at(new T.Mesh(new T.SphereGeometry(0.04, 8, 6), skin), 0.05, -0.26, 0));
  back.add(at(new T.Mesh(new T.CylinderGeometry(0.034, 0.026, 0.26, 10), skin), 0.07, -0.39, 0.01, 0.18));
  back.add(at(new T.Mesh(new T.CylinderGeometry(0.026, 0.02, 0.09, 10), satin), 0.09, -0.54, 0.02, 0.3));
  fig.add(back);
  joints.legBack = back;

  /* the tutu: five layers of net, each a real ring with thickness and
     each set a little lower and wider than the one above it. A single
     wide cone reads as a saucer; five shallow ones read as a skirt. */
  const skirt = part(0, 0.62, 0);
  for (let i = 0; i < 5; i++) {
    const rIn = 0.085 + i * 0.012;
    const rOut = 0.15 + i * 0.036;
    const drop = i * 0.019;
    skirt.add(at(new T.Mesh(new T.CylinderGeometry(rIn, rOut, 0.05 + i * 0.006, 22, 1, true), i % 2 ? net2 : net1), 0, -drop, 0));
    /* a rolled hem, so the edge of each layer is not a knife */
    skirt.add(at(new T.Mesh(new T.TorusGeometry(rOut, 0.011, 5, 24), i % 2 ? net2 : net1), 0, -drop - (0.025 + i * 0.003), 0, Math.PI / 2));
  }
  skirt.add(at(new T.Mesh(new T.TorusGeometry(0.088, 0.017, 6, 20), gilt), 0, 0.028, 0, Math.PI / 2));
  fig.add(skirt);
  joints.skirt = skirt;

  /* bodice, shoulders, neck */
  fig.add(at(new T.Mesh(new T.CylinderGeometry(0.062, 0.088, 0.24, 14), satin), 0, 0.74, 0));
  fig.add(at(new T.Mesh(new T.SphereGeometry(0.075, 12, 9), satin), 0, 0.86, 0, 0, 0, 0, 1.15, 0.7, 0.9));
  fig.add(at(new T.Mesh(new T.CylinderGeometry(0.024, 0.028, 0.06, 10), skin), 0, 0.9, 0));
  /* a gilt band at the waist and a line of seed pearls up the bodice */
  fig.add(at(new T.Mesh(new T.TorusGeometry(0.064, 0.009, 5, 18), gilt), 0, 0.635, 0, Math.PI / 2));
  for (let i = 0; i < 4; i++) {
    fig.add(at(new T.Mesh(new T.SphereGeometry(0.011, 7, 6), gilt), 0, 0.67 + i * 0.05, 0.072 - i * 0.004));
  }

  /* the arms, carried in a ring above her head: four segments a side so
     the arc is an arc and not an elbow */
  [["armL", -1], ["armR", 1]].forEach(([k, sx]) => {
    const a = part(sx * 0.075, 0.855, 0);
    a.add(at(new T.Mesh(new T.CylinderGeometry(0.024, 0.028, 0.19, 9), skin), sx * 0.055, 0.08, 0, 0, 0, -sx * 0.62));
    a.add(at(new T.Mesh(new T.SphereGeometry(0.026, 8, 6), skin), sx * 0.1, 0.16, 0));
    a.add(at(new T.Mesh(new T.CylinderGeometry(0.019, 0.024, 0.18, 9), skin), sx * 0.105, 0.25, 0, 0, 0, -sx * 0.12));
    a.add(at(new T.Mesh(new T.CylinderGeometry(0.016, 0.019, 0.14, 9), skin), sx * 0.072, 0.36, 0, 0, 0, sx * 0.6));
    a.add(at(new T.Mesh(new T.SphereGeometry(0.022, 8, 6), skin), sx * 0.032, 0.41, 0, 0, 0, 0, 1.3, 0.7, 1));
    fig.add(a);
    joints[k] = a;
  });

  /* the head: smaller than a doll's wants to be, hair over the crown,
     a bun, a ribbon, and a face that is painted rather than modelled */
  const head = part(0, 0.96, 0);
  head.add(at(new T.Mesh(new T.SphereGeometry(0.082, 16, 12), skin), 0, 0.06, 0, 0, 0, 0, 0.94, 1.08, 0.96));
  /* the hair sits over the crown and down the back only: a full sphere
     here, however slightly bigger, swallows the face whole */
  head.add(at(new T.Mesh(new T.SphereGeometry(0.087, 16, 12), flat("#3a2820")), 0, 0.075, -0.022, 0, 0, 0, 1.02, 1.02, 0.84));
  head.add(sb(0.14, 0.052, 0.055, flat("#3a2820"), 0, 0.108, 0.046));           // the fringe
  head.add(sb(0.03, 0.14, 0.05, flat("#33241c"), -0.072, 0.05, 0.0, 0, 0, 0.16));
  head.add(sb(0.03, 0.14, 0.05, flat("#33241c"), 0.072, 0.05, 0.0, 0, 0, -0.16));
  head.add(at(new T.Mesh(new T.SphereGeometry(0.045, 12, 9), flat("#33241c")), 0, 0.1, -0.085));
  head.add(at(new T.Mesh(new T.TorusGeometry(0.048, 0.009, 5, 16), satin), 0, 0.1, -0.085, 0.4));
  for (const sx of [-1, 1]) {
    /* a lash line over an eye, the way a painted doll is done */
    head.add(sb(0.032, 0.006, 0.01, flat("#2a1e22"), sx * 0.031, 0.077, 0.073));
    const eye = new T.Mesh(new T.SphereGeometry(0.013, 9, 7), flat("#243a4e"));
    eye.userData.eye = true;
    head.add(at(eye, sx * 0.031, 0.062, 0.072));
    head.add(at(new T.Mesh(new T.SphereGeometry(0.006, 6, 5), flat("#0e1218")), sx * 0.031, 0.062, 0.079));
    const bl = new T.Mesh(new T.SphereGeometry(0.022, 8, 6), flat("#dd9aa4"));
    head.add(at(bl, sx * 0.05, 0.032, 0.06, 0, 0, 0, 1, 0.55, 0.4));
  }
  head.add(at(new T.Mesh(new T.SphereGeometry(0.009, 7, 6), skin), 0, 0.05, 0.082));
  head.add(sb(0.02, 0.011, 0.012, flat("#b8555e"), 0, 0.026, 0.079));
  fig.add(head);
  joints.head = head;

  g.add(fig);
  joints.fig = fig;

  g.userData.joints = joints;
  g.userData.eyeY = 1.24;
  return fitFigure(g, 1.34);
};

/* --- JAX: all limbs, three points on his hat, and a grin ------------ */
MODELS.jax = function () {
  const g = new T.Group();
  const joints = {};
  const cloth = mat("harlequin", 1, 1.6, "#b9a6cc");
  const cloth2 = mat("harlequin", 1.4, 1, "#a894bd", { rot: 0.8 });
  const gold = mat("brass", 1, 1, "#d8b264");
  const pale = mat("porcelain", 1, 1, "#e6dcc8");

  /* long spindly legs with a kick in them */
  [["legL", -1], ["legR", 1]].forEach(([k, sx]) => {
    const hip = part(sx * 0.11, 0.98, 0);
    hip.add(at(new T.Mesh(new T.CylinderGeometry(0.055, 0.045, 0.52, 9), cloth), 0, -0.26, 0));
    hip.add(at(new T.Mesh(new T.SphereGeometry(0.055, 8, 6), gold), 0, -0.52, 0));
    hip.add(at(new T.Mesh(new T.CylinderGeometry(0.045, 0.038, 0.4, 9), cloth), 0, -0.72, 0));
    /* a curled shoe with a bell on the toe */
    hip.add(sb(0.09, 0.07, 0.2, flat("#4a2f6a"), 0, -0.94, 0.06));
    hip.add(at(new T.Mesh(new T.SphereGeometry(0.038, 8, 6), flat("#4a2f6a")), 0, -0.9, 0.15));
    const bell = new T.Mesh(new T.SphereGeometry(0.032, 8, 6), gold);
    hip.add(at(bell, 0, -0.86, 0.19));
    g.add(hip);
    joints[k] = hip;
  });

  /* a narrow torso with a big ruff, so the shoulders read wide and the
     body reads thin — the shape you see first in a doorway */
  const torso = part(0, 0, 0);
  torso.add(at(new T.Mesh(new T.CylinderGeometry(0.15, 0.19, 0.5, 12), cloth), 0, 1.22, 0));
  torso.add(at(new T.Mesh(new T.CylinderGeometry(0.19, 0.13, 0.1, 12), gold), 0, 0.97, 0));
  /* the ruff: eight real lobes, not a disc */
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const lobe = new T.Mesh(new T.SphereGeometry(0.085, 9, 7), i % 2 ? cloth2 : flat("#e3d0a0"));
    torso.add(at(lobe, Math.cos(a) * 0.2, 1.45, Math.sin(a) * 0.2, 0, 0, 0, 1, 0.6, 1));
  }
  /* three buttons down the front, and a spring coming out of his back */
  for (let i = 0; i < 3; i++) {
    torso.add(at(new T.Mesh(new T.SphereGeometry(0.03, 8, 6), gold), 0, 1.1 + i * 0.14, 0.17));
  }
  const coil = part(0, 1.06, -0.16);
  for (let i = 0; i < 5; i++) {
    const r = new T.Mesh(new T.TorusGeometry(0.075, 0.014, 5, 14), mat("pewter", 1, 1, "#9aa2aa"));
    coil.add(at(r, 0, -i * 0.05, -i * 0.012, Math.PI / 2 - 0.2));
  }
  torso.add(coil);
  joints.coil = coil;
  g.add(torso);
  joints.torso = torso;

  /* arms that hang far too low, with hands too big for them */
  [["armL", -1], ["armR", 1]].forEach(([k, sx]) => {
    const sh = part(sx * 0.19, 1.42, 0);
    sh.add(at(new T.Mesh(new T.CylinderGeometry(0.045, 0.038, 0.42, 9), cloth), sx * 0.05, -0.2, 0, 0, 0, -sx * 0.2));
    sh.add(at(new T.Mesh(new T.SphereGeometry(0.045, 8, 6), gold), sx * 0.11, -0.4, 0));
    sh.add(at(new T.Mesh(new T.CylinderGeometry(0.036, 0.03, 0.4, 9), cloth), sx * 0.14, -0.6, 0.02, 0.1, 0, -sx * 0.1));
    /* the hand: a palm and four fingers, deliberately oversized */
    const hand = part(sx * 0.17, -0.82, 0.03);
    hand.add(sb(0.12, 0.14, 0.06, pale, 0, 0, 0));
    for (let i = 0; i < 4; i++) {
      hand.add(sb(0.024, 0.11, 0.03, pale, -0.042 + i * 0.028, -0.11, 0.005, 0, 0, (i - 1.5) * 0.09));
    }
    hand.add(sb(0.04, 0.08, 0.032, pale, sx * -0.07, -0.03, 0.01, 0, 0, sx * 0.7));
    sh.add(hand);
    joints[k + "Hand"] = hand;
    g.add(sh);
    joints[k] = sh;
  });

  /* the head: a long pale face, black diamonds over the eyes, a grin
     that goes further round than it should */
  const head = part(0, 1.56, 0);
  head.add(at(new T.Mesh(new T.SphereGeometry(0.14, 14, 11), pale), 0, 0.12, 0, 0, 0, 0, 0.92, 1.15, 0.95));
  for (const sx of [-1, 1]) {
    const eye = new T.Mesh(new T.SphereGeometry(0.028, 9, 7), glow("#f2e6c8"));
    eye.userData.eye = true;
    head.add(at(eye, sx * 0.055, 0.15, 0.115));
    head.add(at(new T.Mesh(new T.SphereGeometry(0.013, 7, 6), flat("#100c14")), sx * 0.055, 0.15, 0.135));
    /* the diamond, built as two triangles so it stands off the face */
    head.add(at(new T.Mesh(new T.ConeGeometry(0.05, 0.07, 3), flat("#241a30")), sx * 0.055, 0.225, 0.116, 0, 0, 0, 1, 1, 0.35));
    head.add(at(new T.Mesh(new T.ConeGeometry(0.05, 0.07, 3), flat("#241a30")), sx * 0.055, 0.078, 0.116, Math.PI, 0, 0, 1, 1, 0.35));
  }
  head.add(at(new T.Mesh(new T.ConeGeometry(0.03, 0.06, 7), flat("#c07a86")), 0, 0.1, 0.14, 1.4));
  /* the grin: nine teeth in a curved jaw, each one its own block */
  const grin = part(0, 0.055, 0.108);
  grin.add(sb(0.2, 0.06, 0.05, flat("#3a1e28"), 0, 0, 0));
  for (let i = 0; i < 9; i++) {
    const t = (i / 8 - 0.5);
    grin.add(sb(0.019, 0.045, 0.02, flat("#efe6d0"), t * 0.19, 0.006 - Math.abs(t) * 0.012, 0.02, 0, 0, t * 0.5));
  }
  head.add(grin);
  joints.grin = grin;
  /* the hat: three points, each on its own hinge, each with a bell */
  const hat = part(0, 0.24, 0);
  hat.add(at(new T.Mesh(new T.CylinderGeometry(0.145, 0.155, 0.07, 14), cloth2), 0, 0.02, 0));
  [[-0.55, -0.5, 0], [0, 0, -0.55], [0.55, -0.5, 0]].forEach(([rz, , rx], i) => {
    const horn = part(0, 0.05, 0);
    horn.rotation.set(rx || 0, 0, rz);
    for (let k = 0; k < 3; k++) {
      horn.add(at(new T.Mesh(new T.ConeGeometry(0.06 - k * 0.016, 0.13, 7), k % 2 ? cloth : cloth2), 0, 0.06 + k * 0.12, 0, 0, 0, 0.12 * (k % 2 ? 1 : -1)));
    }
    horn.add(at(new T.Mesh(new T.SphereGeometry(0.036, 8, 6), gold), 0, 0.42, 0));
    hat.add(horn);
    joints["horn" + i] = horn;
  });
  head.add(hat);
  g.add(head);
  joints.head = head;

  g.userData.joints = joints;
  g.userData.eyeY = 1.71;
  return fitFigure(g, 2.04);
};

/* =========================================================
   15c. THE CAST AT RUNTIME

   The four figures live in the scene, not in a room: a room is a frozen
   branch and they are the one thing that has to move between rooms.
   Putting them where they belong is one write of position and rotation
   when their state changes — never per frame, and never relative to the
   camera.
   ========================================================= */
const cast = {};

/* =========================================================
   15f. THE ONES HE SOLD

   Four hundred and eleven of them went out of this shop into houses
   with people asleep in them, and the address on every one of them is
   here. From night two, some of them come back.

   They are not a faster animatronic. They are a different problem:

     they never walk      — a parcel is never seen moving. It is simply
                            one room closer than it was the last time
                            she looked, which is worse
     they do not knock    — a shut door is a handle being tried, over
                            and over, for as long as they feel like it
     watching does nothing— they were not built for her and they do not
                            care whether they are observed
     winding does nothing — they are not his to wind

   And nobody ever sees one. They came back the way they were sent:
   wrapped, tied and labelled, with something showing through a tear in
   the corner. Whatever is inside stays inside for the whole chapter.
   That is deliberate — the thing she is frightened of on nights two to
   six is a brown paper parcel that is closer than it was, and the
   moment we show her a monster instead we have made it ordinary.

   She tells them from his four by ear. His four have voices: boots,
   wings, a music box, bells. These have paper and string and a weight
   settling. There is no melody anywhere in them.
   ========================================================= */
const SOLD = [
  {
    id: "post1", name: "UNREGISTERED",
    what: "a parcel that came back", colour: "#7b6a55",
    variant: 0, door: "left", from: 1,
    route: [["foyer","s0"], ["foyer","s2"], ["hall","far"], ["hall","mid"], ["hall","near"], ["office","leftDoor"]],
  },
  {
    id: "post2", name: "UNREGISTERED",
    what: "a parcel that came back", colour: "#6d6558",
    variant: 1, door: "right", from: 2,
    route: [["foyer","s1"], ["hall","far"], ["arcade","s1"], ["party","s1"], ["party","s2"], ["office","rightDoor"]],
  },
  {
    id: "post3", name: "UNREGISTERED",
    what: "a parcel that came back", colour: "#83705a",
    variant: 2, door: "left", from: 3,
    route: [["foyer","s2"], ["hall","near"], ["hall","mid"], ["office","leftDoor"]],
  },
];
const SOLD_BY = {};
SOLD.forEach((d) => { SOLD_BY[d.id] = d; });

/* how they behave, and it is deliberately simple: relentless, and not
   negotiable. A shut door holds one for a while and then it goes. */
const SOLD_TUNE = {
  /* Measured, not guessed. At nine seconds a hold and a move every
     seven, three of these added a hundred door-seconds to a late night
     — about a quarter of the meter — and nights five and six stopped
     being winnable at all. They are supposed to be the reason a night
     is frightening, not the reason it is arithmetic. */
  step: 9.5,        // seconds between one look and the next being worse
  chance: 0.34,
  doorGrace: 3.0,   // seconds at an OPEN door before it is over
  holdFor: 4.4,     // how long a shut door keeps one there, draining
  retreat: 34,      // and how long it stays away afterwards
  back: 99,         // all the way back to the front door
};

/* --- the model: still wrapped ------------------------------------- */
MODELS.parcel = function (variant) {
  const v = variant | 0;
  const g = new T.Group();
  const rnd = mulberry(seedOf("parcel" + v));
  const paper = mat("paper", 1.4, 2.2, ["#8c7a61", "#948161", "#7f7057"][v] || "#8c7a61");
  const paper2 = mat("paper", 1, 1, ["#7d6d55", "#867455", "#736550"][v] || "#7d6d55");
  const string = flat("#d8cbb0");
  const tape = flat("#c8b58e");

  /* the body: three stacked slabs of different widths, so no two of
     them are the same silhouette and none of them is a box */
  const H = [1.62, 1.78, 1.44][v];
  const W = [0.52, 0.44, 0.60][v];
  const D = [0.40, 0.46, 0.36][v];
  const segs = 3;
  let y = 0;
  for (let i = 0; i < segs; i++) {
    const h = H / segs * (i === 1 ? 1.12 : 0.94);
    const w = W * (1 - i * 0.09) * (1 + (rnd() - 0.5) * 0.1);
    const d = D * (1 - i * 0.07);
    const m = i === 1 ? paper2 : paper;
    g.add(at(new T.Mesh(new T.BoxGeometry(w, h, d), m), (rnd() - 0.5) * 0.03, y + h / 2, (rnd() - 0.5) * 0.03,
             0, (rnd() - 0.5) * 0.14, 0));
    y += h;
  }
  /* string, twice round and knotted */
  [0.34, 0.68].forEach((f) => {
    g.add(at(new T.Mesh(new T.BoxGeometry(W * 1.06, 0.016, D * 1.08), string), 0, H * f, 0));
    g.add(at(new T.Mesh(new T.BoxGeometry(0.016, 0.016, D * 1.1), string), 0, H * f + 0.012, 0));
  });
  g.add(at(new T.Mesh(new T.BoxGeometry(0.05, 0.05, 0.05), string), W * 0.28, H * 0.68, D * 0.5));
  /* the label, and the tear */
  g.add(at(new T.Mesh(new T.BoxGeometry(0.2, 0.13, 0.006), tape), W * 0.1, H * 0.79, D / 2 + 0.004));
  for (let i = 0; i < 3; i++) {
    g.add(at(new T.Mesh(new T.BoxGeometry(0.13 - i * 0.02, 0.008, 0.004), flat("#5b4a38")),
             W * 0.08, H * 0.82 - i * 0.026, D / 2 + 0.009));
  }
  /* something pale through a torn corner, and it never resolves */
  const tear = new T.Group();
  tear.add(at(new T.Mesh(new T.BoxGeometry(0.11, 0.1, 0.02), flat("#1a1512")), 0, 0, 0));
  tear.add(at(new T.Mesh(new T.SphereGeometry(0.032, 8, 6), flat("#d9cdb6")), -0.014, 0.008, 0.012));
  tear.add(at(new T.Mesh(new T.SphereGeometry(0.022, 8, 6), flat("#efe6d2")), 0.02, -0.012, 0.014));
  tear.position.set(-W * 0.34, H * 0.55, D / 2 + 0.006);
  tear.rotation.z = 0.3;
  g.add(tear);

  g.userData.joints = { tear, body: g };
  g.userData.eyeY = H * 0.62;
  return g;
};

/* --- runtime ------------------------------------------------------- */
function buildSold() {
  SOLD.forEach((def) => {
    const g = MODELS.parcel(def.variant);
    g.visible = false;
    scene.add(g);
    cast[def.id] = {
      def, group: g, joints: g.userData.joints || {},
      room: def.route[0][0], anchor: def.route[0][1],
      step: 0, phase: 0, pose: "idle", cool: 0,
      atDoor: false, awake: false, seen: 0,
      sold: true,          // the one flag everything else asks about
      holdT: 0, doorT: 0, wound: 0,
    };
  });
}
function resetSold() {
  SOLD.forEach((def) => {
    const ch = cast[def.id];
    if (!ch) return;
    /* clear the test hold, exactly as resetCast does for his four.
       Without this, the first suite section that called only() put all
       three of these to sleep for the rest of the run and every later
       assertion about them measured a shop they were not in. */
    ch.asleep = false;
    ch.step = 0;
    ch.cool = range(Math.random, 16, 34);
    ch.atDoor = false;
    ch.awake = false;
    ch.holdT = 0;
    ch.doorT = 0;
    ch.pose = "idle";
    syncChar(ch);
  });
}

/* which of them are in tonight. None on night one — the first night is
   his four and nothing else, so that when one of these turns up on
   night two she already knows what the shop is supposed to sound like */
function soldActive(def) {
  /* Custom Night is her shop and her rules, and a shop with none of the
     four hundred he sold in it is a different game. They come with the
     dials: turn everything down and it is quiet, turn it up and the
     front door is busy. */
  if (G.mode === "custom") {
    const d = G.cfg && G.cfg.dials;
    if (!d) return false;
    const top = Math.max(d.cogsworth, d.chime, d.marabelle, d.jax);
    return top >= (def.from + 1) * 5;
  }
  if (G.mode !== "story") return false;
  if (G.night < 2) return false;
  return G.night >= def.from + 1;
}

function stepSold(ch, dt) {
  if (!ch || G.blackout) return;
  if (ch.asleep) return;                 // held asleep by a test
  if (!soldActive(ch.def)) return;
  if (!ch.awake) {
    /* they let themselves in some time after midnight */
    ch.cool -= dt;
    if (ch.cool > 0) return;
    ch.awake = true;
    ch.cool = range(Math.random, 5, 12);
    SFX.postDrag(TUNE.pan[ch.def.door]);
    tapeTrigger("firstParcel");
    say(fmt(NS.sys.unknown, ch.def.door === "left" ? "WEST DOOR" : "EAST DOOR"), true);
    return;
  }

  if (ch.atDoor) {
    const shut = G.doors[ch.def.door] && !G.blackout;
    if (shut) {
      /* the handle, over and over. It costs her the door and nothing
         else — they do not knock, and they do not bargain */
      ch.holdT -= dt;
      ch.knockT = (ch.knockT || 0) - dt;
      if (ch.knockT <= 0) { ch.knockT = range(Math.random, 1.4, 2.6); SFX.handle(TUNE.pan[ch.def.door]); }
      if (ch.holdT <= 0) soldRetreat(ch);
      return;
    }
    ch.doorT -= dt;
    if (ch.doorT <= 0) {
      /* the whole story, in one branch: if any of his four is still
         wound, one of them gets there first */
      const keeper = guardFor(ch.def.door);
      if (keeper) intercept(ch, keeper);
      else kill(ch);
      return;
    }
    return;
  }

  /* never seen moving: one room closer than it was, and only ever
     between looks */
  ch.cool -= dt;
  if (ch.cool > 0) return;
  const agg = ramp() * cozyK("aggression");
  ch.cool = SOLD_TUNE.step / Math.max(0.35, agg);
  if (Math.random() > SOLD_TUNE.chance * agg) return;
  ch.step = clamp(ch.step + 1, 0, ch.def.route.length - 1);
  syncChar(ch);
  G.stats.moves++;
  if (ch.atDoor) {
    ch.doorT = SOLD_TUNE.doorGrace * cozyK("doorGrace");
    ch.holdT = SOLD_TUNE.holdFor;
    ch.knockT = 0.6;
    G.stats.arrivals++;
    G.stats.returns++;
    SFX.postSettle(TUNE.pan[ch.def.door]);
    say(fmt(NS.sys.unknown, ch.def.door === "left" ? "WEST DOOR" : "EAST DOOR"), true);
  } else {
    SFX.postDrag(TUNE.pan[ch.def.door], TUNE.cueGain[clamp(stepsLeft(ch), 0, 3)]);
  }
}
function soldRetreat(ch) {
  ch.step = 0;
  ch.atDoor = false;
  ch.cool = SOLD_TUNE.retreat;
  ch.holdT = 0;
  syncChar(ch);
  SFX.postDrag(TUNE.pan[ch.def.door], 0.4);
}

function buildCast() {
  CAST.forEach((def) => {
    const g = MODELS[def.id]();
    g.visible = false;
    scene.add(g);
    cast[def.id] = {
      def, group: g, joints: g.userData.joints || {},
      room: def.home, anchor: "s0",
      step: 0,          // index along `route`
      phase: 0,         // animation phase
      pose: "idle",
      cool: 0,          // seconds before it may move again
      atDoor: false,    // standing in the office doorway
      knockCool: 0,
      awake: false,
      seen: 0,          // seconds it has been on camera this look
    };
  });
}

/* the world position of a room anchor */
function anchorAt(roomId, name) {
  const rec = rooms[roomId];
  if (!rec) return null;
  const a = rec.anchors[name] || rec.anchors.s0 || { x: 0, y: 0, z: 0, ry: 0 };
  return { x: a.x + rec.index * SPACING, y: a.y, z: a.z, ry: a.ry };
}

/* a walker gets its own standing spot in a room so two of them never
   share one, chosen by name rather than at random so it is stable */
const SPOT_FOR = { cogsworth: "s0", chime: "s2", marabelle: "s1", jax: "s2" };

function putChar(ch, roomId, anchorName) {
  const a = anchorAt(roomId, anchorName || SPOT_FOR[ch.def.id] || "s0");
  if (!a) return;
  ch.room = roomId;
  ch.anchor = anchorName || SPOT_FOR[ch.def.id] || "s0";
  ch.group.position.set(a.x, a.y, a.z);
  ch.group.rotation.set(0, a.ry, 0);
  ch.group.updateMatrix();
}

/* only the figures in the room being looked at are drawn */
function syncCastVisibility() {
  for (const id in cast) {
    const ch = cast[id];
    ch.group.visible = !!(ch.awake && ch.room === shownRoom);
  }
}

/* --- posing ---------------------------------------------------------
   Small, cheap, and different per character: a march, a wingbeat and a
   swinging pendulum, a slow turn on a plinth, and a lot of twitching.
   Only the visible one is posed. */
function poseCast(dt, t) {
  for (const id in cast) {
    const ch = cast[id];
    if (!ch.group.visible) continue;
    ch.phase += dt;
    const j = ch.joints;
    const p = ch.phase;
    if (id === "cogsworth") {
      const m = ch.pose === "walk" ? 1 : 0.14;
      const sw = Math.sin(p * 3.4) * 0.5 * m;
      if (j.legL) j.legL.rotation.x = sw;
      if (j.legR) j.legR.rotation.x = -sw;
      if (j.armL) j.armL.rotation.x = -sw * 0.7;
      if (j.armR) j.armR.rotation.x = sw * 0.7;
      if (j.key) j.key.rotation.z = p * 2.2;
      if (j.gear) j.gear.rotation.y = -p * 1.1;
      if (j.head) j.head.rotation.y = Math.sin(p * 0.7) * 0.12 * (ch.pose === "idle" ? 1 : 0.3);
      if (j.jaw) j.jaw.rotation.x = ch.pose === "scare" ? -0.6 : 0;
    } else if (id === "chime") {
      const beat = ch.pose === "walk" ? 1 : 0.2;
      if (j.wingL) j.wingL.rotation.z = 0.1 + Math.sin(p * 5.5) * 0.35 * beat;
      if (j.wingR) j.wingR.rotation.z = -0.1 - Math.sin(p * 5.5) * 0.35 * beat;
      if (j.head) {
        /* an owl's head turn: held, then snapped */
        const q = (p * 0.5) % 1;
        j.head.rotation.y = (q < 0.82 ? 0 : smooth((q - 0.82) / 0.18)) * 1.1 - 0.55;
      }
      if (j.pendulum) j.pendulum.rotation.z = Math.sin(p * 3.1) * 0.4;
      if (j.escape) j.escape.rotation.z = p * 1.6;
    } else if (id === "marabelle") {
      /* she only turns while nobody is looking; when watched she is
         a porcelain figure and completely still */
      if (ch.pose !== "frozen") {
        if (j.fig) j.fig.rotation.y = p * 0.9;
        if (j.wind) j.wind.rotation.x = -p * 3.0;
        if (j.armL) j.armL.rotation.z = Math.sin(p * 0.9) * 0.12;
        if (j.armR) j.armR.rotation.z = -Math.sin(p * 0.9) * 0.12;
        if (j.head) j.head.rotation.z = Math.sin(p * 0.45) * 0.14;
      }
    } else if (id === "jax") {
      const tw = ch.pose === "walk" ? 1 : 0.35;
      const sw = Math.sin(p * 4.6) * 0.55 * tw;
      if (j.legL) j.legL.rotation.x = sw;
      if (j.legR) j.legR.rotation.x = -sw;
      if (j.armL) j.armL.rotation.z = -0.12 + Math.sin(p * 3.1) * 0.22 * tw;
      if (j.armR) j.armR.rotation.z = 0.12 - Math.sin(p * 3.1 + 1) * 0.22 * tw;
      if (j.torso) j.torso.rotation.y = Math.sin(p * 1.7) * 0.16;
      if (j.head) {
        j.head.rotation.z = Math.sin(p * 2.3) * 0.18;
        j.head.rotation.y = Math.sin(p * 1.1) * 0.3;
      }
      ["horn0", "horn1", "horn2"].forEach((k, i) => {
        if (j[k]) j[k].rotation.x = (j[k].userData.rx0 === undefined
          ? (j[k].userData.rx0 = j[k].rotation.x) : j[k].userData.rx0) + Math.sin(p * 3.4 + i * 2) * 0.14;
      });
    }
    ch.group.updateMatrix();
  }
}

/* =========================================================
   15e. THE SHOP NOT STAYING STILL

   A handful of toys that are in one place, and then are in another.
   Both places are built at boot, both are frozen, and the shift is one
   `visible` flag going off and another going on — no transform is ever
   recomputed, so this cannot become the drift bug it looks like.

   The rule that makes it a fright rather than a magic trick: never move
   one in the room she is looking at. It has to happen behind her back.
   ========================================================= */
const SHIFTIES = [
  { room:"hall",     a:[-1.5, 0, -2.2], b:[ 1.5, 0, -3.4] },
  { room:"hall",     a:[ 0.7, 0,  2.7], b:[-1.3, 0,  3.7] },
  { room:"party",    a:[-2.7, 0, -1.3], b:[ 2.5, 0, -0.5] },
  { room:"party",    a:[ 0.5, 0,  2.7], b:[-1.7, 0,  2.3] },
  { room:"arcade",   a:[-0.7, 0, -2.9], b:[ 0.9, 0, -1.1] },
  { room:"arcade",   a:[-1.0, 0,  2.5], b:[ 1.2, 0,  1.7] },
  { room:"stage",    a:[-2.9, 0,  2.7], b:[ 2.7, 0,  3.3] },
  { room:"stage",    a:[-1.0, 0.88, -2.95], b:[ 1.0, 0.88, -2.05] },
  { room:"foyer",    a:[-2.5, 0,  1.9], b:[ 2.3, 0, -0.7] },
  { room:"workshop", a:[-1.7, 0,  1.7], b:[ 1.4, 0,  1.2] },
  { room:"closet",   a:[-1.0, 0,  1.5], b:[ 0.9, 0,  0.9] },
];
const shifties = [];

function buildShifties() {
  SHIFTIES.forEach((def, i) => {
    const rec = rooms[def.room];
    if (!rec) return;
    const rnd = rngFor("shifty" + i);
    const pair = { room: def.room, at: 0, poses: [] };
    [def.a, def.b].forEach((pos, k) => {
      const t = KIT.toy((i + k * 3) % 6, rnd);
      const g = new T.Group();
      g.add(t);
      at(t, 0, 0, 0, 0, range(rnd, 0, TAU), 0);
      g.position.set(pos[0], pos[1], pos[2]);
      g.scale.setScalar(1.25);
      g.updateMatrixWorld(true);
      const sh = contactShadow(g, { y: pos[1], opacity: 0.55 });
      const holder = new T.Group();
      holder.add(g);
      if (sh) holder.add(sh);
      holder.visible = k === 0;
      rec.live.add(holder);
      freeze(holder);
      holder.matrixWorldAutoUpdate = false;
      pair.poses.push(holder);
    });
    shifties.push(pair);
  });
}

/* move one, somewhere she is not looking */
function shiftSomething() {
  const pool = shifties.filter((p) => p.room !== shownRoom);
  if (!pool.length) return;
  const p = pick(Math.random, pool);
  p.poses[p.at].visible = false;
  p.at = 1 - p.at;
  p.poses[p.at].visible = true;
  G.stats.shifts++;
}

function resetShifties() {
  shifties.forEach((p) => {
    p.poses[0].visible = true;
    p.poses[1].visible = false;
    p.at = 0;
  });
}

/* =========================================================
   16. BOOT

   One renderer, one scene, one camera, six lights. Rooms are built at
   their addresses and then left alone; only the one being looked at is
   visible, so the draw call count is a room's worth and not a shop's.
   ========================================================= */
const BUILDERS = {
  office:   buildOffice,
  hall:     buildHall,
  stage:    buildStage,
  arcade:   buildArcade,
  party:    buildParty,
  foyer:    buildFoyer,
  closet:   buildCloset,
  ducts:    buildDucts,
  workshop: buildWorkshop,
};

let built = false, noWebGL = false;
let officeParts = null, officeDoors = null, officeHands = null, ouissy = null;
let stageEl = null, canvasEl = null;
let pixelCap = 1.5;

function buildWorld(cvs) {
  if (built) return;
  canvasEl = cvs;

  /* A browser with WebGL switched off is a real thing — some corporate
     builds, some privacy settings, an old machine with a blocklisted
     driver. It should say so and offer the way back rather than throwing
     and leaving her on a black screen with no button. */
  try {
    renderer = new T.WebGLRenderer({
      canvas: cvs, antialias: true, alpha: false,
      powerPreference: "high-performance", stencil: false,
    });
  } catch (e) {
    renderer = null;
  }
  if (!renderer || !renderer.getContext || !renderer.getContext()) {
    noWebGL = true;
    return;
  }
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(new T.Color("#05060a"), 1);

  scene = new T.Scene();
  scene.fog = new T.Fog(new T.Color("#05060a"), 3, 20);

  view = new T.PerspectiveCamera(70, 16 / 9, 0.06, 70);

  rigAmbient = new T.AmbientLight(new T.Color("#20242e"), 0.5);
  rigAmbient.userData.base = 0.5;
  scene.add(rigAmbient);
  for (let i = 0; i < RIG_N; i++) {
    const l = new T.PointLight(new T.Color("#ffffff"), 0, 9, 1.6);
    l.userData.base = 0;
    scene.add(l);
    rig.push(l);
  }

  buildTextures();

  ROOMS.forEach((r, i) => {
    const rec = makeRoomRecord(r.id, i);
    scene.add(rec.group);
    rec.group.updateMatrixWorld(true);   // so props freeze at the right address
    const api = roomAPI(rec);
    const b = BUILDERS[r.id];
    if (b) rec.parts = b(api) || {};
    rec.group.visible = false;
  });

  /* the office's moving parts are built after its shell so they can sit
     in the doorways the shell cut */
  officeParts = rooms.office.parts;
  officeDoors = buildOfficeDoors(roomAPI(rooms.office));
  buildCast();
  buildSold();

  /* her hands on the desk, and her standing in the left-hand doorway on
     the title screen — the one place in the whole chapter you see her
     from the outside */
  buildShifties();
  findEgg();
  buildFinds();

  officeHands = buildHands();
  rooms.office.live.add(officeHands.group);
  ouissy = MODELS.ouissy();
  ouissy.position.set(-OFFICE.W / 2 - 0.55, 0, OFFICE.doorZ + 0.1);
  ouissy.rotation.y = Math.PI / 2 - 0.35;
  ouissy.visible = false;
  scene.add(ouissy);
  ouissy.updateMatrix();

  built = true;
}

function sizeRenderer() {
  if (!renderer || !stageEl || noWebGL) return;
  const w = stageEl.clientWidth || 960;
  const h = stageEl.clientHeight || 540;
  const dpr = Math.min(window.devicePixelRatio || 1, pixelCap);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  view.aspect = w / Math.max(1, h);
  view.updateProjectionMatrix();
}

/* only one room is ever visible, so a frame costs one room */
let shownRoom = null;
function showRoom(id) {
  if (shownRoom === id) return;
  if (shownRoom && rooms[shownRoom]) rooms[shownRoom].group.visible = false;
  shownRoom = id;
  if (rooms[id]) rooms[id].group.visible = true;
}

/* =========================================================
   17. SOUND

   Synthesised, like everything else in this repo. Four voices that have
   to be told apart with your eyes shut, over a bed that never goes
   quiet — silence in a game like this reads as a bug, not as tension.

   Every cue is built from the same three ideas: a noise burst shaped by
   a filter, a small stack of detuned oscillators, and an envelope. What
   makes Cogsworth sound like Cogsworth and Chime sound like Chime is
   the shape of those three, not a sample.
   ========================================================= */
let AC = null, master = null, bedGain = null, cueGain = null, duckGain = null, sideGain = null;
let bedNodes = [], creakTimer = 0, audioOn = false, muted = false;

function noiseBuffer(sec) {
  const n = (AC.sampleRate * sec) | 0;
  const b = AC.createBuffer(1, n, AC.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;      // brown-ish, not white: it sits under
    d[i] = last * 3.2;
  }
  return b;
}
let NB = null;

function audioInit() {
  if (AC) return;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;

  /* On an iPhone, Web Audio obeys the ring/silent switch unless the page
     says what it is for. A game that goes silent because the switch on
     the side of the phone is down is a game that "has no sound", and
     nobody would ever guess why. iOS 16.4 and up take this; everything
     else ignores it. */
  try {
    if (navigator.audioSession) navigator.audioSession.type = "playback";
  } catch (e) {}

  AC = new C();
  master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination);
  duckGain = AC.createGain(); duckGain.gain.value = 1; duckGain.connect(master);
  /* Everything that is not a cue goes through here, and it steps out of
     the way whenever a cue fires.

     Without it the room tone and the score between them were already
     sitting at the top of the master bus, and a door shutting on top of
     that moved the meter by less than one percent — the effects were
     all being played and none of them were being heard, which is a
     thing you can only find out by putting a meter on it. */
  sideGain = AC.createGain(); sideGain.gain.value = 1; sideGain.connect(duckGain);
  bedGain = AC.createGain(); bedGain.gain.value = 0.0; bedGain.connect(sideGain);
  cueGain = AC.createGain(); cueGain.gain.value = 1.0; cueGain.connect(duckGain);
  NB = noiseBuffer(3);

  /* The site keeps a watchdog for exactly this — see wakeAudio() in
     script.js — and this chapter was the one thing not using it, doing
     its own `state === "suspended"` check in three places instead.

     iOS does not use "suspended" when the system takes the audio
     session away. A call, the lock screen, another app, the tab going
     to the background: the state is "interrupted", which is not in the
     spec, and a check for "suspended" reads it as healthy. So the sound
     stopped the first time she looked at a message and never came back
     for the rest of the night, with every node in the graph reporting
     itself perfectly fine. */
  if (window.registerAudio) window.registerAudio(() => AC);
}
/* resume, and only then do the thing that needs the clock: a context
   that is not running has a frozen clock, so anything scheduled against
   currentTime while it is asleep is scheduled against a time that is
   not moving. */
function audioWake(then) {
  audioInit();
  if (!AC) return;
  if (AC.state === "running") { if (then) then(); return; }
  if (window.wakeAudio) { window.wakeAudio(AC, then); return; }
  try {
    const pr = AC.resume();
    if (pr && pr.then) pr.then(() => { if (then) then(); }, () => {});
    else if (then) then();
  } catch (e) {}
}
function ac() { audioInit(); return AC; }
function now() { return AC ? AC.currentTime : 0; }

/* the room tone: a filtered rumble, a mains hum, and a very slow
   breathing on top of both so it never sits still */
function bedStart() {
  if (!ac() || audioOn) return;
  audioOn = true;
  /* the fade-in is two and a half seconds of ramp against the audio
     clock, and a context that is not running has a clock that is not
     moving, so starting the room tone before the resume lands starts it
     into a silence that never ends */
  audioWake(() => { if (audioOn) bedBuild(); });
}
function bedBuild() {
  const t = now();
  const src = AC.createBufferSource(); src.buffer = NB; src.loop = true;
  const lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 240; lp.Q.value = 0.7;
  const g1 = AC.createGain(); g1.gain.value = 0.5;
  src.connect(lp); lp.connect(g1); g1.connect(bedGain); src.start();

  const hum = AC.createOscillator(); hum.type = "sine"; hum.frequency.value = 51;
  const hum2 = AC.createOscillator(); hum2.type = "sine"; hum2.frequency.value = 102.6;
  const hg = AC.createGain(); hg.gain.value = 0.075;
  hum.connect(hg); hum2.connect(hg); hg.connect(bedGain);
  hum.start(); hum2.start();

  /* the breathing */
  const lfo = AC.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.07;
  const lg = AC.createGain(); lg.gain.value = 90;
  lfo.connect(lg); lg.connect(lp.frequency); lfo.start();

  bedGain.gain.cancelScheduledValues(t);
  bedGain.gain.setValueAtTime(0.0001, t);
  bedGain.gain.linearRampToValueAtTime(0.32, t + 2.5);
  bedNodes = [src, hum, hum2, lfo];
}
function bedStop() {
  if (!AC || !audioOn) return;
  audioOn = false;
  const t = now();
  bedGain.gain.cancelScheduledValues(t);
  bedGain.gain.setValueAtTime(bedGain.gain.value, t);
  bedGain.gain.linearRampToValueAtTime(0.0001, t + 0.5);
  const dead = bedNodes.slice();
  bedNodes = [];
  setTimeout(() => dead.forEach((n) => { try { n.stop(); } catch (e) {} }), 700);
}
/* a cue just fired: get everything else out of its way for a moment.
   Rate-limited, because one cue is three or four nodes and they must
   not each take their own bite out of the room. */
let sideT = 0;
function cueDuck(depth) {
  if (!AC || !sideGain) return;
  const t = now();
  if (t - sideT < 0.07) return;
  sideT = t;
  const d = depth === undefined ? 0.5 : depth;
  sideGain.gain.cancelScheduledValues(t);
  sideGain.gain.setValueAtTime(sideGain.gain.value, t);
  sideGain.gain.linearRampToValueAtTime(d, t + 0.035);
  sideGain.gain.linearRampToValueAtTime(1, t + 0.42);
}
function audioDuck(v, ms) {
  if (!AC) return;
  const t = now();
  duckGain.gain.cancelScheduledValues(t);
  duckGain.gain.setValueAtTime(duckGain.gain.value, t);
  duckGain.gain.linearRampToValueAtTime(v, t + (ms || 120) / 1000);
}

/* --- the two primitives everything else is made of ---------------- */
/* Where a sound is coming from. Every cue carries the pan of the side
   its owner attacks from, so on headphones the soldier is always in your
   left ear and the ballerina always in your right, all the way down
   their routes — which is most of the information the game gives you
   when the hall lights are out. */
/* HOW LONG EVERY CUE WAITS BEFORE IT STARTS, AND WHY IT HAS TO.

   Every sound in this chapter is an envelope: a gain that goes from
   nothing to its peak in four milliseconds and back down over the
   length of the sound. All of them were scheduled at `now()`, meaning
   AudioContext.currentTime, meaning the beginning of the block the
   audio thread is working on this instant.

   By the time that thread reaches the envelope, the four milliseconds
   are already behind it. The attack never happens. The gain is picked
   up somewhere down the far side of the curve and the whole cue plays
   at a fraction of the level it was written at.

   Measured, live, against the same cue rendered offline: a door
   shutting came out at 0.0097 instead of 0.3077. Thirty times too
   quiet. A bare noise buffer through the same bus was correct, and a
   bare oscillator was correct, and putting an envelope on either of
   them broke it — and the same burst scheduled a hundred and fifty
   milliseconds ahead was twenty-four times louder than the one
   scheduled now.

   An OfflineAudioContext starts at zero with the whole render ahead of
   it, so nothing scheduled "now" is ever late in one. Which is why
   every measurement of these cues ever taken in this repository was of
   a sound nobody had heard: the tools rendered offline, and the game
   did not.

   Twenty-five milliseconds. Longer than a render quantum, longer than
   the base and output latency a browser reports, and short enough that
   no one will ever know it is there.

   One honest caveat, because it would be easy to overclaim this. The
   sweep that found it was run in a headless container against a null
   audio device, and there the level kept climbing all the way out to a
   two hundred millisecond lead — far past any latency the context
   reports. That gradual climb is this container's audio thread running
   ahead in large batches, not something a phone does. So: scheduling
   an envelope at currentTime is a real bug and this is the standard
   fix for it, but how much of the thirty-fold gap was the bug and how
   much was the container is not a thing this repository can answer.
   The levels below are set from offline renders, where every cue is
   measured on identical terms. */
const CUE_LEAD = 0.025;

function panned(o) {
  if (!o.bus) cueDuck(o.duck);
  const g = AC.createGain();
  if (o.pan !== undefined && AC.createStereoPanner) {
    const p = AC.createStereoPanner();
    p.pan.value = clamp(o.pan, -1, 1);
    g.connect(p);
    p.connect(o.bus || cueGain);
  } else {
    g.connect(o.bus || cueGain);
  }
  return g;
}

function burst(o) {
  if (!ac() || muted) return;
  const t = now() + CUE_LEAD + (o.at || 0);
  const src = AC.createBufferSource(); src.buffer = NB;
  src.playbackRate.value = o.rate || 1;
  const f = AC.createBiquadFilter();
  f.type = o.filter || "bandpass";
  f.frequency.setValueAtTime(o.f0 || 800, t);
  if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f1), t + (o.dur || 0.2));
  f.Q.value = o.q === undefined ? 1.2 : o.q;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain || 0.2), t + (o.attack || 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.2));
  src.connect(f); f.connect(g); g.connect(panned(o));
  src.start(t); src.stop(t + (o.dur || 0.2) + 0.05);
}
function tone(o) {
  if (!ac() || muted) return;
  const t = now() + CUE_LEAD + (o.at || 0);
  const osc = AC.createOscillator();
  osc.type = o.type || "sine";
  osc.frequency.setValueAtTime(o.f0 || 440, t);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + (o.dur || 0.3));
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain || 0.15), t + (o.attack || 0.006));
  g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.3));
  let node = osc;
  if (o.filter) {
    const f = AC.createBiquadFilter();
    f.type = o.filter; f.frequency.value = o.ff || 1200; f.Q.value = o.q || 1;
    osc.connect(f); node = f;
  }
  node.connect(g); g.connect(panned(o));
  osc.start(t); osc.stop(t + (o.dur || 0.3) + 0.05);
}

/* --- the voices ---------------------------------------------------- */
const SFX = {
  /* THE ONES HE SOLD — no melody, ever. His four have voices; these
     have the sound of something wrapped being moved by something that
     is not being careful. If you can hum it, it is one of his. */
  /* Measured with tools/nightsound.js, which exists because telling
     these from his four by ear is a rule of the game and nobody had
     ever heard either. Measured honestly — as the cues are actually
     played, rather than one synth function out of the two or three
     that make up a cue — a tried doorknob sat at 1030Hz and
     Cogsworth's boots at 940. The same sound. These are duller now,
     and the ring in his foot is loud enough to be the thing she hears,
     so the bands are disjoint on every roll of a noisy die. */
  postDrag(pan, gain) {
    const v = gain === undefined ? 1 : gain;
    burst({ f0: 520, f1: 195, dur: 0.46, gain: 0.54 * v, q: 0.5, filter: "lowpass", pan });
    burst({ f0: 1250, f1: 700, dur: 0.20, gain: 0.007 * v, q: 0.8, filter: "highpass", at: 0.08, pan });
    tone({ type: "triangle", f0: 58, f1: 44, dur: 0.55, gain: 0.19 * v, filter: "lowpass", ff: 180, at: 0.05, pan });
  },
  /* it has arrived, and it has put itself down */
  postSettle(pan) {
    burst({ f0: 220, f1: 70, dur: 0.34, gain: 0.52, q: 0.7, filter: "lowpass", pan });
    burst({ f0: 1350, f1: 680, dur: 0.18, gain: 0.011, q: 0.7, filter: "highpass", at: 0.03, pan });
    tone({ type: "triangle", f0: 41, f1: 31, dur: 0.7, gain: 0.15, filter: "lowpass", ff: 140, pan });
  },
  /* and the handle, tried, and tried again */
  handle(pan) {
    burst({ f0: 300, f1: 135, dur: 0.10, gain: 0.68, q: 2.2, filter: "lowpass", pan });
    burst({ f0: 240, f1: 120, dur: 0.14, gain: 0.46, q: 1.8, filter: "lowpass", at: 0.09, pan });
    tone({ type: "square", f0: 112, f1: 84, dur: 0.13, gain: 0.17, filter: "lowpass", ff: 260, at: 0.04, pan });
  },

  /* picking a piece of paper up off a shelf. Two short scrapes and a
     fold, so it reads as paper rather than as a pickup chime */
  paper() {
    burst({ f0: 3200, f1: 1500, dur: 0.12, gain: 0.10, q: 0.6, filter: "highpass" });
    burst({ f0: 2400, f1: 900, dur: 0.16, gain: 0.075, q: 0.5, filter: "highpass", at: 0.10 });
    tone({ type: "triangle", f0: 720, f1: 540, dur: 0.16, gain: 0.035, at: 0.06 });
  },

  /* COGSWORTH — a boot on a board, and the metal in it ringing after */
  step(gain, pan) {
    const v = gain === undefined ? 0.5 : gain;
    burst({ f0: 180, f1: 70, dur: 0.16, gain: 0.5 * v, q: 0.8, filter: "lowpass", pan });
    tone({ type: "square", f0: 96, f1: 62, dur: 0.13, gain: 0.11 * v, filter: "lowpass", ff: 500, pan });
    /* the ring the foot leaves behind. He is a clock that walks, and at
       the gain these two started on he was only ever a boot: the metal
       in him is what tells her, in the dark, that the thing in the hall
       is one of his and not a parcel. */
    tone({ type: "triangle", f0: 1420, dur: 0.26, gain: 0.085 * v, at: 0.012, pan });
    tone({ type: "triangle", f0: 2130, dur: 0.21, gain: 0.062 * v, at: 0.012, pan });
  },
  tick(gain, pan) {
    const v = gain === undefined ? 0.4 : gain;
    burst({ f0: 3200, dur: 0.03, gain: 0.16 * v, q: 3, pan });
    tone({ type: "square", f0: 1800, dur: 0.02, gain: 0.03 * v, pan });
  },
  wind(gain, pan) {                     // his key, turning
    const v = gain === undefined ? 0.4 : gain;
    for (let i = 0; i < 7; i++) burst({ f0: 1600 + i * 90, dur: 0.035, gain: 0.09 * v, q: 4, at: i * 0.062, pan });
  },

  /* CHIME — a hoot with a mechanical wobble in it, and feathers of tin */
  hoot(gain, pan) {
    const v = gain === undefined ? 0.5 : gain;
    [0, 0.34].forEach((d, k) => {
      tone({ type: "sine", f0: k ? 300 : 340, f1: k ? 250 : 286, dur: 0.42, gain: 0.16 * v, at: d, attack: 0.05, pan });
      tone({ type: "sine", f0: k ? 601 : 681, f1: k ? 500 : 572, dur: 0.34, gain: 0.05 * v, at: d, attack: 0.05, pan });
    });
    for (let i = 0; i < 6; i++) burst({ f0: 2400, dur: 0.02, gain: 0.05 * v, q: 6, at: 0.02 + i * 0.052, pan });
  },
  flutter(gain, pan) {
    const v = gain === undefined ? 0.4 : gain;
    for (let i = 0; i < 5; i++) {
      burst({ f0: 480 - i * 40, f1: 200, dur: 0.11, gain: 0.13 * v, q: 0.7, at: i * 0.1, filter: "bandpass", pan });
      burst({ f0: 3000, dur: 0.02, gain: 0.04 * v, q: 8, at: i * 0.1 + 0.01, pan });
    }
  },

  /* MARABELLE — a music box. Her tune, eight notes, hers alone. */
  boxNote(f, gain, at, dur, pan) {
    const v = gain === undefined ? 0.4 : gain;
    tone({ type: "sine", f0: f, dur: dur || 0.9, gain: 0.15 * v, at: at || 0, attack: 0.004, pan });
    tone({ type: "sine", f0: f * 2, dur: (dur || 0.9) * 0.5, gain: 0.06 * v, at: at || 0, attack: 0.003, pan });
    tone({ type: "sine", f0: f * 3.01, dur: (dur || 0.9) * 0.28, gain: 0.03 * v, at: at || 0, attack: 0.002, pan });
    burst({ f0: 5200, dur: 0.012, gain: 0.03 * v, q: 8, at: at || 0, pan });
  },
  /* B, G#, E, F#, G#, E, B(low), E — a small turning phrase that does
     not resolve, which is the point of it */
  tune(gain, speed, pan) {
    const sp = speed || 1;
    const seq = [493.9, 415.3, 329.6, 370.0, 415.3, 329.6, 246.9, 329.6];
    seq.forEach((f, i) => SFX.boxNote(f, gain, i * 0.34 * sp, 0.85 * sp, pan));
  },
  /* the same phrase, but it goes on and lands. Only ever played once,
     at the very end of the last night. */
  tuneWhole(gain) {
    const seq = [493.9, 415.3, 329.6, 370.0, 415.3, 329.6, 246.9, 329.6,
                 293.7, 369.99, 440.0, 493.9, 415.3, 369.99, 329.6, 246.9, 164.8];
    const hold = [1, 1, 1, 1, 1, 1, 1, 1.4, 1, 1, 1, 1, 1, 1, 1.2, 1.6, 3];
    let at = 0;
    seq.forEach((f, i) => { SFX.boxNote(f, gain, at, 0.9 * hold[i]); at += 0.4 * hold[i]; });
    return at + 2.4;
  },

  /* JAX — a crank that will not stop, and something laughing under it */
  crank(gain, pan) {
    const v = gain === undefined ? 0.5 : gain;
    const seq = [392, 440, 494, 523, 587, 494, 392];
    seq.forEach((f, i) => {
      tone({ type: "triangle", f0: f, dur: 0.2, gain: 0.30 * v, at: i * 0.17, filter: "lowpass", ff: 1600, pan });
      burst({ f0: 2600, dur: 0.02, gain: 0.11 * v, q: 7, at: i * 0.17, pan });
    });
  },
  laugh(gain, pan) {
    const v = gain === undefined ? 0.5 : gain;
    for (let i = 0; i < 6; i++) {
      const f = 210 - i * 12;
      tone({ type: "sawtooth", f0: f, f1: f * 0.82, dur: 0.11, gain: 0.1 * v, at: i * 0.115, filter: "bandpass", ff: 900, q: 3, pan });
      tone({ type: "square", f0: f * 2.51, f1: f * 2.1, dur: 0.09, gain: 0.035 * v, at: i * 0.115, pan });
    }
  },
  bells(gain, pan) {
    const v = gain === undefined ? 0.4 : gain;
    [1180, 1560, 2040].forEach((f, i) => tone({ type: "triangle", f0: f, dur: 0.5, gain: 0.13 * v, at: i * 0.03, pan }));
  },

  /* --- the ones that are nothing ------------------------------------
     A shut building settles. None of these is one of the four voices —
     a player who has learned what the four sound like is never fooled
     into a wrong move by them, only into looking. Which is the point. */
  falseBang(pan) {
    burst({ f0: 210, f1: 80, dur: 0.34, gain: 0.42, q: 0.7, filter: "lowpass", pan });
    tone({ type: "sine", f0: 62, f1: 40, dur: 0.5, gain: 0.1, pan });
  },
  falseSettle(pan) {
    const f = 140 + Math.random() * 260;
    tone({ type: "sawtooth", f0: f, f1: f * 0.6, dur: 1.1, gain: 0.07, filter: "bandpass", ff: 500, q: 7, pan });
    burst({ f0: 900, dur: 0.4, gain: 0.05, q: 2, pan });
  },
  falseSkitter(pan) {
    for (let i = 0; i < 7; i++) burst({ f0: 1800 + Math.random() * 900, dur: 0.03, gain: 0.09, q: 5, at: i * 0.055, pan });
  },
  falseBurst(pan) {
    burst({ f0: 3200, dur: 0.3, gain: 0.2, q: 0.4, filter: "highpass", pan });
    tone({ type: "square", f0: 420, f1: 180, dur: 0.12, gain: 0.05, pan });
  },

  /* the room and the desk */
  doorClose() {
    burst({ f0: 900, f1: 120, dur: 0.5, gain: 0.5, q: 0.6, filter: "lowpass" });
    tone({ type: "square", f0: 130, f1: 48, dur: 0.34, gain: 0.2, filter: "lowpass", ff: 400 });
    burst({ f0: 2600, dur: 0.06, gain: 0.12, q: 3, at: 0.26 });
  },
  doorOpen() {
    burst({ f0: 500, f1: 1500, dur: 0.34, gain: 0.3, q: 0.8 });
    tone({ type: "square", f0: 70, f1: 120, dur: 0.3, gain: 0.09, filter: "lowpass", ff: 400 });
  },
  /* A steel latch, which is three sounds: the clack, the body of the
     plate it lands on, and the weight of the thing dropping into the
     frame. It used to be one narrow bandpass, which threw away most of
     the noise it was made of and left the control she uses more than
     any other as the quietest thing in the shop. */
  hatch() {
    burst({ f0: 2600, f1: 1500, dur: 0.05, gain: 0.34, q: 0.9, filter: "highpass" });
    burst({ f0: 1500, f1: 600, dur: 0.24, gain: 0.40, q: 0.8, filter: "lowpass", at: 0.008 });
    tone({ type: "triangle", f0: 320, f1: 180, dur: 0.22, gain: 0.16, at: 0.01 });
    tone({ type: "triangle", f0: 88, f1: 62, dur: 0.30, gain: 0.13, filter: "lowpass", ff: 260, at: 0.02 });
  },
  /* Steel coming down and hitting the floor, and the lock going in
     after it. It is the sound of the terms, so it is the biggest thing
     in the chapter. */
  shutter() {
    burst({ f0: 3200, f1: 900, dur: 0.10, gain: 0.30, q: 0.8, filter: "highpass" });
    burst({ f0: 900, f1: 120, dur: 1.20, gain: 0.60, q: 0.5, filter: "lowpass" });
    tone({ type: "sawtooth", f0: 128, f1: 44, dur: 1.10, gain: 0.24, filter: "lowpass", ff: 520 });
    tone({ type: "triangle", f0: 47, f1: 33, dur: 1.60, gain: 0.26, filter: "lowpass", ff: 150 });
    /* the floor, and then the bolt */
    burst({ f0: 320, f1: 70, dur: 0.55, gain: 0.55, q: 0.6, filter: "lowpass", at: 0.95 });
    burst({ f0: 2400, f1: 1100, dur: 0.07, gain: 0.22, q: 3, at: 1.45 });
    tone({ type: "square", f0: 96, f1: 62, dur: 0.30, gain: 0.16, filter: "lowpass", ff: 400, at: 1.45 });
  },

  /* the tube swinging down on its arm, and the picture striking */
  monitor(up) {
    burst({ f0: up ? 1200 : 700, f1: up ? 400 : 1400, dur: 0.18, gain: 0.46, q: 0.7,
            filter: up ? "lowpass" : "bandpass" });
    tone({ type: "square", f0: up ? 140 : 110, dur: 0.10, gain: 0.17, filter: "lowpass", ff: 500 });
    tone({ type: "triangle", f0: up ? 74 : 96, f1: up ? 55 : 70, dur: 0.22, gain: 0.12,
           filter: "lowpass", ff: 300, at: 0.015 });
  },
  hiss(gain) { burst({ f0: 2600, dur: 0.22, gain: 0.16 * (gain || 1), q: 0.5, filter: "highpass" }); },
  camSwitch() {
    burst({ f0: 3000, dur: 0.09, gain: 0.16, q: 0.4, filter: "highpass" });
    tone({ type: "square", f0: 900, dur: 0.03, gain: 0.04 });
  },
  beep(hi) { tone({ type: "square", f0: hi ? 1300 : 880, dur: 0.09, gain: 0.09, filter: "lowpass", ff: 2600 }); },
  knock() {
    burst({ f0: 260, f1: 90, dur: 0.22, gain: 0.55, q: 0.7, filter: "lowpass" });
    tone({ type: "square", f0: 88, f1: 55, dur: 0.2, gain: 0.16, filter: "lowpass", ff: 300 });
  },
  surge() {
    tone({ type: "sawtooth", f0: 300, f1: 60, dur: 0.5, gain: 0.18, filter: "lowpass", ff: 1400 });
    burst({ f0: 2200, f1: 300, dur: 0.4, gain: 0.24, q: 0.6 });
    tone({ type: "square", f0: 120, f1: 70, dur: 0.3, gain: 0.09, filter: "lowpass", ff: 600 });
  },
  powerDown() {
    tone({ type: "sawtooth", f0: 180, f1: 22, dur: 2.2, gain: 0.16, filter: "lowpass", ff: 900 });
    tone({ type: "sine", f0: 90, f1: 18, dur: 2.4, gain: 0.12 });
    burst({ f0: 1400, f1: 90, dur: 1.6, gain: 0.2, q: 0.5, filter: "lowpass" });
  },
  sixAM() {
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
      tone({ type: "sine", f0: f, dur: 2.4, gain: 0.13, at: i * 0.42, attack: 0.01 });
      tone({ type: "sine", f0: f * 2.76, dur: 1.2, gain: 0.035, at: i * 0.42 });
    });
  },
  creak() {
    const f = 90 + Math.random() * 200;
    tone({ type: "sawtooth", f0: f, f1: f * (0.7 + Math.random() * 0.5), dur: 0.9 + Math.random(), gain: 0.035, filter: "bandpass", ff: 420, q: 5 });
  },

  /* the four ways it ends. Sharp, loud, short — and different enough
     that you know which one got you before the screen tells you. */
  scare(id, soft) {
    const k = soft === undefined ? 1 : soft;
    audioDuck(0.25 + (1 - k) * 0.5, 40);
    /* cozy mode still has a scare — it is just a short soft one, a thud
       and the thing's own voice once, instead of the full stack */
    if (k < 0.6) {
      burst({ f0: 400, f1: 110, dur: 0.5, gain: 0.3, q: 0.6, filter: "lowpass" });
      tone({ type: "sine", f0: 180, f1: 70, dur: 0.7, gain: 0.14 });
      if (id === "cogsworth") SFX.step(0.6);
      else if (id === "chime") SFX.hoot(0.55);
      else if (id === "marabelle") SFX.boxNote(246.9, 0.6, 0, 1.2);
      else SFX.bells(0.6);
      setTimeout(() => audioDuck(1, 700), 900);
      return;
    }
    if (id === "cogsworth") {
      burst({ f0: 2600, f1: 300, dur: 0.9, gain: 0.85, q: 0.6, filter: "bandpass" });
      for (let i = 0; i < 5; i++) tone({ type: "square", f0: 180 + i * 37, f1: 60, dur: 0.7, gain: 0.14, at: i * 0.012, filter: "lowpass", ff: 2200 });
      tone({ type: "sawtooth", f0: 1400, f1: 90, dur: 1.1, gain: 0.2, filter: "bandpass", ff: 1600, q: 2 });
    } else if (id === "chime") {
      tone({ type: "sawtooth", f0: 2400, f1: 700, dur: 0.5, gain: 0.4, filter: "bandpass", ff: 2600, q: 3 });
      tone({ type: "sawtooth", f0: 2860, f1: 820, dur: 0.5, gain: 0.3, at: 0.02, filter: "bandpass", ff: 3000, q: 3 });
      burst({ f0: 5200, f1: 900, dur: 0.7, gain: 0.5, q: 1.2, filter: "highpass" });
      for (let i = 0; i < 8; i++) burst({ f0: 3400, dur: 0.02, gain: 0.14, q: 8, at: 0.06 * i });
    } else if (id === "marabelle") {
      /* porcelain: a cluster of high partials, then the box winding down */
      [1860, 2340, 2790, 3520, 4180].forEach((f, i) => tone({ type: "sine", f0: f, dur: 0.9, gain: 0.16, at: i * 0.006 }));
      burst({ f0: 6000, dur: 0.45, gain: 0.45, q: 0.6, filter: "highpass" });
      const seq = [493.9, 415.3, 329.6, 246.9];
      seq.forEach((f, i) => SFX.boxNote(f * 0.5, 1.1, 0.3 + i * 0.2, 1.0));
    } else {
      /* Jax: the spring, then the whole box */
      burst({ f0: 900, f1: 3200, dur: 0.2, gain: 0.4, q: 1 });
      for (let i = 0; i < 9; i++) tone({ type: "square", f0: 260 + i * 130, f1: 120, dur: 0.5, gain: 0.09, at: i * 0.008, filter: "bandpass", ff: 1200, q: 2 });
      tone({ type: "sawtooth", f0: 150, f1: 40, dur: 1.2, gain: 0.25, filter: "lowpass", ff: 1400 });
      SFX.laugh(1.1);
    }
    setTimeout(() => audioDuck(1, 700), 900);
  },
};

/* =========================================================
   17b. THE ANNUNCIATOR

   The building talks. It is not a person and it is not company: it is
   the security system reading its own state out, in the flat way an
   old lift or a station board does, and it never says anything that
   is not a reading. No reassurance, no commentary, no name.

   The voice is synthesised the same way everything else here is. A
   formant pair — two bandpass filters over a buzzing sawtooth — makes
   a vowel; the syllable count of the line drives how many of them get
   played; a ring-modulated square underneath is what makes it read as
   a machine rather than a person humming. The words themselves arrive
   as a caption on the panel, because a vocoder cannot be understood
   and is not supposed to be.
   ========================================================= */
const FORMANTS = [
  [ 730, 1090],   // a
  [ 530, 1840],   // e
  [ 270, 2290],   // i
  [ 570,  840],   // o
  [ 300,  870],   // u
];

function syllablesOf(text) {
  let n = 0;
  text.toLowerCase().split(/[^a-z]+/).forEach((w) => {
    if (!w) return;
    const m = w.match(/[aeiouy]+/g);
    n += m ? m.length : 1;
  });
  return clamp(n, 1, 22);
}

function annunciate(text, urgent) {
  if (!ac() || muted) return;
  const t0 = now() + CUE_LEAD;
  const gain = urgent ? 0.85 : 0.6;
  /* the two-tone attention chime every announcement opens with */
  tone({ type: "square", f0: urgent ? 880 : 660, dur: 0.09, gain: 0.075 * gain, filter: "lowpass", ff: 2400 });
  tone({ type: "square", f0: urgent ? 1170 : 880, dur: 0.11, gain: 0.075 * gain, at: 0.1, filter: "lowpass", ff: 2400 });

  /* and the building says the words as well. It is a machine and it is
     meant to sound like one, but a status line she cannot hear is a
     status line she has to read, and the whole point of a public
     address is that it reaches you while you are looking elsewhere.
     Flat, fast, and as close to no pitch as the platform allows. */
  const spoke = speechSay(text, voxPlan(text), { sys: true });
  const n = syllablesOf(text);
  const rnd = mulberry(seedOf(text));
  const step = 0.108;
  for (let i = 0; i < n; i++) {
    const at = 0.26 + i * step;
    const f = FORMANTS[(rnd() * FORMANTS.length) | 0];
    /* the carrier: a low buzz, deliberately monotone apart from a
       downward step at the end of the line */
    const carrier = i === n - 1 ? 96 : 112;
    /* Harder than it was, and deliberately. He has a voice now — folds
       that wobble, a throat, breath, a sentence that falls — and this
       is the thing he is not. So it goes the other way: a fixed
       carrier, a third partial an octave and a fifth up, and no air in
       it anywhere. Two voices in one shop that sound alike is one voice
       and a waste of the better one. */
    [0, 1, 2].forEach((k) => {
      const osc = AC.createOscillator();
      osc.type = k === 0 ? "sawtooth" : "square";
      const mult = k === 0 ? 1 : k === 1 ? 2 : 3;
      osc.frequency.setValueAtTime(carrier * mult, t0 + at);
      const bp = AC.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = k === 2 ? 3200 : f[k];
      bp.Q.value = k === 0 ? 6 : k === 1 ? 9 : 12;
      const lvl = 0.055 * gain * (k === 0 ? 1 : k === 1 ? 0.5 : 0.34)
                * (spoke ? 0.34 : 1);
      const g = AC.createGain();
      /* square corners: a machine does not fade in */
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(lvl, t0 + at + 0.004);
      g.gain.setValueAtTime(lvl, t0 + at + step * 0.72);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + step * 0.88);
      osc.connect(bp); bp.connect(g); g.connect(cueGain);
      osc.start(t0 + at); osc.stop(t0 + at + step);
    });
    /* the consonant edge between syllables */
    burst({ f0: 3400, dur: 0.014, gain: 0.032 * gain, q: 7, at: at - 0.012 });
  }
  return 0.26 + n * step + 0.2;
}

/* one line at a time, and never over a jumpscare */
let sayQueue = [], sayUntil = 0;
/* =========================================================
   17d. THE VOICE THAT READS HIS STATEMENT

   The annunciator above is a buzzer that says door and vent. This is a
   different instrument doing a different job: a machine reading a dead
   man's words aloud, badly, the way an old terminal with a speech card
   would have. It has to be understandable enough that the subtitles
   feel like a transcript rather than a translation.

   Three things make it read as speech rather than as morse:

     the vowels are real       — the formant pair for each syllable is
                                 picked from the letters actually in it,
                                 so "shop" and "she" do not sound alike
     the pitch has a shape     — it drifts down across a sentence and
                                 falls off a cliff on the last syllable
                                 of a full stop, which is the single
                                 biggest difference between a voice and
                                 a tone generator
     the consonants are edges  — s and f hiss, t and k click, m and n
                                 barely interrupt at all

   And every word comes back with the time it will be spoken at, which
   is the whole point: the caption is not timed to the line, it is timed
   to the syllable, so the word lights up as the machine says it.
   ========================================================= */
const VOWEL_OF = { a: 0, e: 1, i: 2, o: 3, u: 4, y: 2 };

/* ANWAR'S VOICE, which is not the building's.

   The annunciator up there is a machine reading out states and it is
   meant to sound like one. This is a man, on a recording, and for a
   long time it was the same two-formant buzz with a different pitch —
   which is why he read as a second machine rather than as her husband.

   Five things separate a voice from a tone generator, and it had none
   of them:

     a glottal source   Vocal folds are a pulse that opens fast and
                        closes slowly, not a sawtooth. Two of them,
                        very slightly apart, because one perfectly
                        periodic oscillator is the sound of a synth.

     jitter and shimmer Real folds are about one percent irregular in
                        period. That irregularity is most of what the
                        ear uses to decide something is alive. Take it
                        away and you have a robot; that is the whole
                        difference.

     a third formant    Two formants are enough to tell an "ah" from an
                        "ee". The third one is what says the sound came
                        out of a throat.

     transitions        We hear the glide between two vowels more than
                        we hear either vowel. His formants move into
                        each syllable rather than stepping to it.

     breath             There is air in a person. A little noise under
                        the tone, louder on the consonants that are
                        made of air, and the last of it left hanging at
                        the end of a sentence.

   And then it is put through a preamp and a tape: bandlimited, a
   little compressed at the top, with the faintest ring on it. He is a
   recording — she is listening to a man who is not there any more, and
   it should sound like a machine is doing the remembering. */
const VOX = {
  syl: 0.152, gap: 0.058,
  pause: { ",": 0.22, ";": 0.28, ":": 0.28, "—": 0.34, ".": 0.50, "!": 0.48, "?": 0.48 },
  base: 96,            // a man's speaking pitch, not a buzzer's
  jitter: 0.012,       // how irregular the folds are, period to period
  vibRate: 4.6, vibDepth: 0.011,
  decl: 0.17,          // how far the pitch falls across one sentence
  accent: 0.085,       // how much a stressed syllable lifts
  breath: 0.030,
};
/* F1 F2 F3 for each vowel, and how loud each one is relative to the
   first. The third is the throat. */
const FORMANT3 = [
  [ 730, 1090, 2440],   // a
  [ 530, 1840, 2480],   // e
  [ 270, 2290, 3010],   // i
  [ 570,  840, 2410],   // o
  [ 300,  870, 2240],   // u
];
const FORMANT_GAIN = [1, 0.44, 0.14];

/* split a word into syllable-ish chunks, each with its vowel and its
   opening consonant */
function voxSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z']/g, "");
  if (!w) return [];
  const out = [];
  const re = /[^aeiouy]*[aeiouy]+(?:[^aeiouy]*$|[^aeiouy](?=[^aeiouy]))?/g;
  let m;
  while ((m = re.exec(w))) {
    const chunk = m[0];
    const v = chunk.match(/[aeiouy]/);
    out.push({ on: chunk[0], v: v ? (VOWEL_OF[v[0]] === undefined ? 0 : VOWEL_OF[v[0]]) : 0 });
    if (out.length > 5) break;
  }
  if (!out.length) out.push({ on: w[0], v: 0 });
  return out;
}

/* Work out when every word is spoken, before a note of it is played.
   Returns the words with their times, and how long the whole line is. */
function voxPlan(text) {
  const words = [];
  let t = 0;
  const raw = String(text).split(/\s+/).filter(Boolean);
  raw.forEach((wRaw, i) => {
    const tail = wRaw.slice(-1);
    const syls = voxSyllables(wRaw);
    const dur = Math.max(VOX.syl, syls.length * VOX.syl);
    words.push({ text: wRaw, at: t, dur, syls, end: i === raw.length - 1 });
    t += dur + VOX.gap + (VOX.pause[tail] || 0);
  });
  return { words, dur: t + 0.25 };
}

/* the tape he is on: bandlimited the way a small speaker in a desk is,
   with a breath of ring on it so the machine doing the playing is
   audible under the man doing the talking */
function voxBus(gain) {
  const out = AC.createGain(); out.gain.value = gain;
  const hp = AC.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 118; hp.Q.value = 0.7;
  const lp = AC.createBiquadFilter(); lp.type = "lowpass";  lp.frequency.value = 3600; lp.Q.value = 0.6;
  out.connect(hp); hp.connect(lp); lp.connect(cueGain);
  /* the ring: a 74Hz carrier at a level you notice only when it stops */
  const ring = AC.createGain(); ring.gain.value = 0;
  const rc = AC.createOscillator(); rc.type = "sine"; rc.frequency.value = 74;
  const rg = AC.createGain(); rg.gain.value = 0.055;
  rc.connect(rg); rg.connect(ring.gain); rc.start();
  hp.connect(ring); ring.connect(lp);
  return { input: out, stop: (at) => { try { rc.stop(at); } catch (e) {} } };
}

/* one syllable: a glottis, three formants, and some air.
   `from` is the vowel before it, so the formants glide in rather than
   jumping — which is the part the ear actually reads as speech. */
function voxSyl(bus, at, dur, f0, vowel, from, gain, stressed) {
  const F = FORMANT3[vowel] || FORMANT3[0];
  const P = FORMANT3[from === undefined || from === null ? vowel : from] || F;
  const glide = Math.min(0.055, dur * 0.42);

  /* --- the glottis: two saws a hair apart, jittered ---------------- */
  const src = AC.createGain(); src.gain.value = 1;
  [0, 1].forEach((k) => {
    const o = AC.createOscillator();
    o.type = "sawtooth";
    /* jitter: four small random steps across the syllable. A perfectly
       steady period is the single loudest robot tell there is. */
    const j = () => 1 + (Math.random() * 2 - 1) * VOX.jitter;
    o.frequency.setValueAtTime(f0 * j() * (k ? 1.006 : 1), at);
    for (let n = 1; n <= 4; n++) {
      const tt = at + (dur * n) / 4;
      /* the pitch also falls a little inside every syllable, the way a
         held note does when nobody is trying to hold it */
      o.frequency.linearRampToValueAtTime(f0 * j() * (k ? 1.006 : 1) * (1 - n * 0.006), tt);
    }
    /* vibrato, small enough to be felt rather than heard */
    const lfo = AC.createOscillator(); lfo.type = "sine"; lfo.frequency.value = VOX.vibRate;
    const lg = AC.createGain(); lg.gain.value = f0 * VOX.vibDepth;
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(at); lfo.stop(at + dur + 0.06);
    const g = AC.createGain(); g.gain.value = k ? 0.42 : 1;
    o.connect(g); g.connect(src);
    o.start(at); o.stop(at + dur + 0.06);
  });
  /* the closing slope of the fold, which is why a voice is not a buzz */
  const tilt = AC.createBiquadFilter();
  tilt.type = "lowpass"; tilt.frequency.value = Math.min(5200, f0 * 34); tilt.Q.value = 0.4;
  src.connect(tilt);

  /* --- the throat: three formants, gliding out of the last vowel --- */
  const sum = AC.createGain(); sum.gain.value = 1;
  for (let k = 0; k < 3; k++) {
    const bp = AC.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(P[k], at);
    bp.frequency.linearRampToValueAtTime(F[k], at + glide);
    bp.Q.value = k === 0 ? 6 : k === 1 ? 8 : 11;
    const g = AC.createGain(); g.gain.value = FORMANT_GAIN[k];
    tilt.connect(bp); bp.connect(g); g.connect(sum);
  }

  /* --- the air ----------------------------------------------------- */
  const br = AC.createBufferSource(); br.buffer = NB; br.loop = true;
  const bf = AC.createBiquadFilter(); bf.type = "bandpass";
  bf.frequency.value = F[1] * 0.9; bf.Q.value = 0.8;
  const bg = AC.createGain(); bg.gain.value = VOX.breath * (stressed ? 1.35 : 1);
  br.connect(bf); bf.connect(bg); bg.connect(sum);
  br.start(at); br.stop(at + dur + 0.06);

  /* --- and the shape of it ----------------------------------------- */
  const env = AC.createGain();
  const peak = Math.max(0.0002, 0.27 * gain * (stressed ? 1.18 : 1));
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(peak, at + 0.016);
  env.gain.setValueAtTime(peak, at + dur * 0.72);
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur * 1.02);
  sum.connect(env); env.connect(bus.input);
}

/* =========================================================
   HIM, ACTUALLY SAYING IT

   The formant synth below is a good impression of a man's voice and a
   bad impression of English. It has three formants, jitter, breath and
   a falling sentence, and none of that adds up to a word: you can hear
   that somebody is speaking and you cannot hear what. Which is fine for
   a building reading out states, and no good at all for a husband
   explaining what he did — the subtitles ended up doing all the work
   and the sound underneath them was noise.

   So the browser says it. Every phone and every desktop has a real
   speech synthesiser in it, and it says the words that are on the
   screen, because they are the same string.

   Three things make it his rather than a screen reader's:

     the voice     an English one, pitched down and slowed a little
     the tape      a hum, a hiss and a little ring underneath it, in
                   Web Audio, running for exactly as long as he talks.
                   The speech cannot be routed through the graph, so
                   the machine is played around it instead.
     the sync      the caption lights on the synthesiser's own word
                   boundaries, so it is the truth rather than an
                   estimate. voxPlan's timings stay as the fallback.

   And when there is no voice at all — a locked-down browser, a
   container, an iOS that has not woken it yet — the formant synth is
   still there and still does what it always did. */
const SPEECH = {
  ok: null,          // null until asked, then true/false
  primed: false,
  voice: null, sys: null,
  mark: -1,          // the word he is on right now, -1 if not speaking
  live: false,
  done: true,
};

function speechVoices() {
  if (!window.speechSynthesis) return [];
  let v = [];
  try { v = window.speechSynthesis.getVoices() || []; } catch (e) { return []; }
  return v;
}
/* pick once: a real English voice for him, and a different one for the
   building if there is a second to be had */
/* WHICH VOICE, AND WHY IT MATTERS MORE THAN THE SETTINGS.

   The first go at this took the first name in the list containing
   "male", which on a Mac means Fred — a 1984 novelty voice — and then
   dropped the pitch to 0.65 to make it sound like a man. Both were
   wrong in the same direction. Every speech engine is a recording of a
   real person cut into pieces, and pitch-shifting it away from where
   that person actually spoke is what produces the growl and the metal:
   the further from 1.0 you push it, the more it sounds like a monster
   and the less like anybody.

   So: pick a good voice and then barely touch it. Modern platforms
   ship neural voices that are genuinely somebody reading — those are
   worth ten of any setting. The old formant ones (Fred, Albert,
   Zarvox and the rest of the 1984 set, and anything marked "compact")
   are worth avoiding at any price.

   And he is narrating, not announcing: a shade under natural pace,
   natural pitch, which is what a man telling you something in a film
   sounds like. */
const VOICE_GOOD = /natural|neural|enhanced|premium|siri|google (uk|us) english/i;
const VOICE_JUNK = /compact|fred|albert|zarvox|trinoids|whisper|wobble|bahh|bells|boing|bubbles|cellos|deranged|jester|junior|organ|superstar|good news|bad news|pipe|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley/i;
const VOICE_MALE = /\bmale\b|daniel|arthur|oliver|george|james|david|guy|ryan|aaron|alex|christopher|brian|matthew|rishi|tom\b|liam|nathan/i;

function voiceScore(v) {
  const name = v.name || "", lang = v.lang || "";
  if (VOICE_JUNK.test(name)) return -100;
  let n = 0;
  if (VOICE_GOOD.test(name)) n += 40;             // a real reading, not a stitch
  if (/^en-GB/i.test(lang)) n += 12;              // the shop is English
  else if (/^en/i.test(lang)) n += 8;
  if (VOICE_MALE.test(name) && !/female/i.test(name)) n += 20;
  if (v.localService) n += 4;                     // no round trip, no cut-off
  if (v.default) n += 2;
  return n;
}

function speechPick() {
  const all = speechVoices();
  if (!all.length) return false;
  const en = all.filter((v) => /^en(-|_|$)/i.test(v.lang || ""));
  const pool = (en.length ? en : all).slice();
  pool.sort((a, b) => voiceScore(b) - voiceScore(a));
  SPEECH.voice = pool[0];
  /* the building wants a different one, and would rather have a plain
     one than the best one — it is a public address, not a narrator */
  const others = pool.filter((v) => v !== SPEECH.voice && !VOICE_JUNK.test(v.name || ""));
  SPEECH.sys = others[others.length - 1] || others[0] || SPEECH.voice;
  return true;
}
function speechReady() {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { SPEECH.ok = false; return false; }
  if (SPEECH.ok === null || !SPEECH.voice) SPEECH.ok = speechPick();
  return !!SPEECH.ok;
}
if (window.speechSynthesis) {
  /* the list arrives late on most browsers, and empty before it does */
  try { window.speechSynthesis.addEventListener("voiceschanged", () => { SPEECH.ok = speechPick(); }); }
  catch (e) {}

  /* THE THREE WAYS A PHONE BREAKS THIS, none of which a container can
     be made to reproduce.

     1. iOS will not speak at all until speak() has been called once
        inside a real user gesture. The film's first line is inside one
        — it comes off the tap that starts the chapter — but every line
        after it comes off the frame loop, and the tapes come off a
        clock. If the first one ever slips out of a gesture the whole
        chapter is silent for the rest of the visit. So the very first
        touch anywhere primes it with an empty utterance, before
        anything has anything to say.

     2. iOS pauses the speech queue when the tab goes away and does not
        resume it on its own, so she looks at a message and he never
        speaks again — the same failure the audio context had, in a
        different subsystem, and it needs the same watchdog.

     3. Chrome on Android drops the queue if an utterance runs long.
        Nothing here is long, but resume() on the same events costs
        nothing and covers it. */
  const primeSpeech = () => {
    try {
      if (!window.SpeechSynthesisUtterance) return;
      const u = new window.SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch (e) {}
    SPEECH.primed = true;
    document.removeEventListener("pointerdown", primeSpeech, true);
    document.removeEventListener("touchstart", primeSpeech, true);
    document.removeEventListener("keydown", primeSpeech, true);
  };
  document.addEventListener("pointerdown", primeSpeech, true);
  document.addEventListener("touchstart", primeSpeech, true);
  document.addEventListener("keydown", primeSpeech, true);

  const wakeSpeech = () => {
    try { if (window.speechSynthesis.paused) window.speechSynthesis.resume(); } catch (e) {}
  };
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wakeSpeech(); });
  window.addEventListener("focus", wakeSpeech);
  window.addEventListener("pageshow", wakeSpeech);
}

/* the machine the tape is playing on, since the speech itself cannot be
   put through the audio graph */
function voxTape(dur, gain) {
  if (!ac() || muted) return;
  const t = now() + CUE_LEAD;
  const g = gain === undefined ? 1 : gain;
  const hum = AC.createOscillator(); hum.type = "sine"; hum.frequency.value = 61;
  const hum2 = AC.createOscillator(); hum2.type = "sine"; hum2.frequency.value = 122;
  const hg = AC.createGain(); hg.gain.value = 0.0001;
  hum.connect(hg); hum2.connect(hg); hg.connect(cueGain);
  const hiss = AC.createBufferSource(); hiss.buffer = NB; hiss.loop = true;
  const hf = AC.createBiquadFilter(); hf.type = "highpass"; hf.frequency.value = 2600; hf.Q.value = 0.5;
  const hgn = AC.createGain(); hgn.gain.value = 0.0001;
  hiss.connect(hf); hf.connect(hgn); hgn.connect(cueGain);
  [hg, hgn].forEach((n, i) => {
    /* under him, not over him: this is the machine he is being
       played on and it should be the last thing she notices */
    const peak = (i ? 0.005 : 0.014) * g;
    n.gain.setValueAtTime(0.0001, t);
    n.gain.exponentialRampToValueAtTime(peak, t + 0.25);
    n.gain.setValueAtTime(peak, t + dur);
    n.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
  });
  [hum, hum2, hiss].forEach((n) => { n.start(t); n.stop(t + dur + 0.6); });
  /* the click of the machine starting and the click of it stopping */
  burst({ f0: 1500, f1: 600, dur: 0.05, gain: 0.035 * g, q: 2 });
  burst({ f0: 1200, f1: 500, dur: 0.06, gain: 0.028 * g, q: 2, at: dur + 0.12 });
}

/* say it out loud, with the real words. Returns false if the platform
   has nothing to say them with. */
function speechSay(text, plan, opts) {
  if (!speechReady()) return false;
  const o = opts || {};
  let u;
  try { u = new window.SpeechSynthesisUtterance(text); } catch (e) { return false; }
  u.voice = o.sys ? SPEECH.sys : SPEECH.voice;
  u.lang = (u.voice && u.voice.lang) || "en-GB";
  /* Him: a man telling you something, unhurried, at the pitch the
     person in the recording actually spoke at. 0.65 was the mistake —
     it is far enough from natural that the engine has to stretch the
     samples, and stretched samples are the growl.

     The building is allowed to be ugly. It is a machine and a flat,
     slightly quick, slightly low read is what a station announcement
     sounds like — but 0.1 was gargling rather than announcing. */
  u.pitch = o.sys ? 0.55 : 0.96;
  u.rate  = o.sys ? 1.08 : 0.86;
  u.volume = o.volume === undefined ? 1 : o.volume;

  /* the caption follows the synthesiser rather than a guess: charIndex
     is where in the string it has got to, so the word is whichever one
     that index lands in */
  const starts = [];
  let at = 0;
  (plan ? plan.words : []).forEach((w) => {
    const i = text.indexOf(w.text, at);
    starts.push(i < 0 ? at : i);
    at = (i < 0 ? at : i) + w.text.length;
  });
  SPEECH.mark = -1; SPEECH.live = true; SPEECH.done = false;
  u.onboundary = (e) => {
    if (e.name && e.name !== "word") return;
    let k = 0;
    for (let i = 0; i < starts.length; i++) if (starts[i] <= e.charIndex) k = i;
    SPEECH.mark = k;
  };
  const finish = () => { SPEECH.live = false; SPEECH.done = true; SPEECH.mark = -1; };
  u.onend = finish;
  u.onerror = finish;
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) { finish(); return false; }
  return true;
}

/* how far through the line the voice has actually got, as a word index,
   or -1 when nothing is being spoken aloud and the caller should fall
   back to voxPlan's timings */
function voxMark() { return SPEECH.live ? SPEECH.mark : -1; }
function voxTalking() { return SPEECH.live; }

/* and say it. `plan` comes from voxPlan so the caller already knows the
   timings it is about to hear. */
function voxSpeak(plan, opts) {
  opts = opts || {};
  const total = plan.dur;
  /* the real words first, if the platform has any */
  const text = plan.words.map((w) => w.text).join(" ");
  if (!muted && speechSay(text, plan, opts)) {
    voxTape(total, opts.gain === undefined ? 1 : opts.gain);
    return total;
  }
  if (!ac() || muted) return 0;

  /* And if there is no voice on this device, he does not fall back to
     the formant synth. It says nothing you can understand, and a man
     making word-shaped noise over the top of the words he is supposed
     to be saying is worse than a man on a bad tape: the caption is
     doing the talking either way, and the second one at least sounds
     like a reason. The building keeps the synth — its lines are four
     words long and it is a buzzer on purpose. */
  if (!opts.sys && !opts.forceSynth && window.speechSynthesis) {
    voxTape(total, (opts.gain === undefined ? 1 : opts.gain) * 1.25);
    return total;
  }
  const t0 = now() + CUE_LEAD + (opts.at || 0);
  const gain = opts.gain === undefined ? 1 : opts.gain;
  const bus = voxBus(1);

  let prevVowel = null;
  plan.words.forEach((w) => {
    w.syls.forEach((s, si) => {
      const at = t0 + w.at + si * VOX.syl;
      /* Declination: a sentence starts high and ends low, and it is
         the fall rather than the pitch that makes it a sentence. On
         top of that, one accent per word, on its first syllable. */
      const through = clamp((w.at + si * VOX.syl) / Math.max(0.001, total), 0, 1);
      const stressed = si === 0 && (w.syls.length > 1 || w.text.length > 3);
      let f = VOX.base * (1 + VOX.decl * 0.5 - through * VOX.decl)
                       * (stressed ? 1 + VOX.accent : 1);
      const tail = w.text.slice(-1);
      /* and the last syllable of the sentence drops off the end of it */
      if (w.end || tail === "." || tail === "!") {
        if (si === w.syls.length - 1) f = VOX.base * 0.78;
      } else if (tail === "?") {
        if (si === w.syls.length - 1) f = VOX.base * 1.26;
      } else if (tail === ",") {
        if (si === w.syls.length - 1) f = VOX.base * 1.06;
      }
      voxSyl(bus, at, VOX.syl * 0.96, f, s.v, prevVowel, gain, stressed);
      prevVowel = s.v;

      /* the consonant that opens the syllable, with the aspiration
         after a plosive that a mouth actually makes */
      const c = s.on;
      const rel = at - t0 + (opts.at || 0);
      if (/[szf]/.test(c))         burst({ f0: 3800, f1: 2400, dur: 0.075, gain: 0.020 * gain, q: 0.9, filter: "bandpass", at: rel - 0.045 });
      else if (/[h]/.test(c))      burst({ f0: 1900, f1: 1100, dur: 0.075, gain: 0.022 * gain, q: 0.5, at: rel - 0.045 });
      else if (/[tdk]/.test(c))  { burst({ f0: 2100, f1: 1000, dur: 0.016, gain: 0.045 * gain, q: 3, at: rel - 0.03 });
                                   burst({ f0: 1700, f1: 900,  dur: 0.032, gain: 0.014 * gain, q: 0.7, at: rel - 0.016 }); }
      else if (/[gpb]/.test(c))    burst({ f0: 1100, f1: 480,  dur: 0.020, gain: 0.045 * gain, q: 2.4, at: rel - 0.03 });
      else if (/[c]/.test(c))      burst({ f0: 2600, f1: 1400, dur: 0.030, gain: 0.022 * gain, q: 1.4, at: rel - 0.035 });
      else if (/[rwl]/.test(c))    burst({ f0: 640,  f1: 400,  dur: 0.036, gain: 0.017 * gain, q: 2, at: rel - 0.02 });
      else if (/[mn]/.test(c))     burst({ f0: 260,  f1: 200,  dur: 0.040, gain: 0.020 * gain, q: 2.6, filter: "lowpass", at: rel - 0.02 });
    });
  });
  /* the breath he lets out at the end of it */
  burst({ f0: 900, f1: 420, dur: 0.30, gain: 0.020 * gain, q: 0.5,
          filter: "lowpass", at: (opts.at || 0) + total - 0.1 });
  bus.stop(t0 + total + 0.6);
  return total;
}

function say(line, urgent) {
  if (!line) return;
  sayQueue.push({ line, urgent });
  if (sayQueue.length > 3) sayQueue.shift();
}
function sayTick(dt) {
  if (G.t < sayUntil || !sayQueue.length) return;
  const it = sayQueue.shift();
  const dur = annunciate(it.line, it.urgent) || 1.2;
  sayUntil = G.t + dur + 0.25;
  G.caption = it.line;
  G.captionT = dur + 0.6;
}
function fmt(t, a) { return (t || "").replace("$1", a); }
/* and the off switch. The system has nothing to say about a finished
   shift, a daylight walk-through or a title screen, so it stops mid
   sentence rather than trailing a status line over the ending. */
function sayClear() {
  sayQueue.length = 0;
  sayUntil = 0;
  G.caption = "";
  G.captionT = 0;
  if (EL["ns-say"]) { EL["ns-say"].hidden = true; EL["ns-say"].textContent = ""; }
}

/* the creaks that keep the bed from ever being flat */
/* =========================================================
   17c. THE SCORE

   Not tracks — layers. There is one continuous piece of music all
   night and it never restarts, never cuts and never loops audibly;
   what changes is how many of its layers you can hear, and how fast
   its pulse is. That is the whole trick, and it is the reason the
   music can be ahead of the game instead of behind it.

   `dread` is a number from zero to one built out of things the player
   cannot see yet: how far along its route each awake performer is,
   whether one is standing at a door, how much meter is left. Because
   a performer's route position climbs while it is still three rooms
   away, the pulse is already quickening before there is anything on
   the camera to see. The scare is late. The music is early. That gap
   is where the fear lives.

   Six layers, in the order they arrive:

     sub      a 41Hz floor you feel rather than hear.       always
     pulse    a heartbeat. 46bpm at rest, 104 at the door.  0.10
     box      a music box, playing the shop's own figure.   0.22
     air      breath on the high end.                       0.30
     grind    a minor second held against the root.         0.45
     bow      the top string, bowed and shaking.            0.62

   Everything is scheduled ahead of the clock, not on the frame, so a
   dropped frame moves nothing — which matters, because on a phone
   under a heavy room the frame rate is the one thing not guaranteed.
   ========================================================= */
const MUS = {
  ready: false, mode: "none", want: "none",
  bus: null, lay: {}, nodes: [],
  dread: 0, target: 0, step: 0, next: 0, bar: 0, spb: 0,
};
const MUS_LOOK = 0.65;          // seconds scheduled ahead of the clock
const MUS_LEVEL = 0.42;         // how loud the score sits under the game

/* ONE PIECE OF MUSIC, NINE ROOMS TO PLAY IT IN.

   The score had three settings — a menu, a night, a morning — and
   everything else in the chapter either borrowed one or played nothing
   at all. So the film where a dead man introduces himself had the same
   music as the title screen; the moment one of his toys steps in front
   of her had the same music as the ninety seconds before it; and a
   death cut to silence and stayed there.

   These are the same seven layers and the same music box in the same
   key. Nothing here is a new track and nothing ever restarts — what
   changes is which layers are audible, how fast the grid runs, and
   whether the phrase is in the minor it ended up in or the major it
   was written in. That is what lets one scene become the next one
   without a cut anywhere.

     film     he is talking. Almost nothing, and low, so that the
              thing she is listening to is him.
     brief    the minute before a night. A pulse and not much else:
              the only layer here whose job is her stomach.
     night    the one that watches the game. Six layers arriving in
              order as dread climbs.
     dark     the meter is gone. The heartbeat stops — that is the
              effect. Everything else opens up underneath.
     gone     after a death. A held low ring and the box running down.
     found    she is reading something he wrote. The phrase turns
              major for the first time each night.
     held     one of his got to the door before she did. The biggest
              sound in the chapter, and the only warm one that is loud.
     dawn     six o'clock.
     gallery  the shop in daylight, with nothing in it.
     menu     the title. */
const MODE_MIX = {
  /* he is talking, so almost nothing — but the piano is under him,
     which is what tells her this is a memory and not a briefing */
  film:    { sub: 0.30, pulse: 0,    box: 0.10, air: 0.14, grind: 0.08, bow: 0,    warm: 0.06,
             piano: 0.34, choir: 0,    brass: 0.16, tick: 0 },
  /* THE TERMS: a clock and a swell and nothing else. He is setting a
     deadline, so the only two instruments are the one that counts and
     the one that says something is coming. */
  locked:  { sub: 0.62, pulse: 0,    box: 0,    air: 0.20, grind: 0.24, bow: 0,    warm: 0,
             piano: 0.20, choir: 0,    brass: 0.55, tick: 0.62 },
  /* the minute before a night: her stomach, and a clock she cannot stop */
  brief:   { sub: 0.34, pulse: 0.30, box: 0.10, air: 0.10, grind: 0.06, bow: 0,    warm: 0,
             piano: 0,    choir: 0,    brass: 0.22, tick: 0.50 },
  /* the meter is gone. The heartbeat stops; everything else opens up */
  dark:    { sub: 0.70, pulse: 0,    box: 0,    air: 0.50, grind: 0.60, bow: 0.40, warm: 0,
             piano: 0,    choir: 0.30, brass: 0.62, tick: 0 },
  /* after a death: one held ring, the box two octaves down, no pulse */
  gone:    { sub: 0.50, pulse: 0,    box: 0.10, air: 0.30, grind: 0.30, bow: 0.12, warm: 0,
             piano: 0.34, choir: 0,    brass: 0.20, tick: 0 },
  /* she is reading something he wrote. Piano and the major phrase */
  found:   { sub: 0.20, pulse: 0,    box: 0.40, air: 0.14, grind: 0,    bow: 0,    warm: 0.45,
             piano: 0.55, choir: 0.16, brass: 0,    tick: 0 },
  /* THE TURN. One of his got there first. Everything warm, and the
     only place in the chapter the choir is loud. */
  held:    { sub: 0.44, pulse: 0.18, box: 0.55, air: 0.22, grind: 0,    bow: 0.16, warm: 0.62,
             piano: 0.60, choir: 0.72, brass: 0.34, tick: 0 },
  dawn:    { sub: 0.16, pulse: 0,    box: 0.40, air: 0.12, grind: 0,    bow: 0,    warm: 0.62,
             piano: 0.48, choir: 0.34, brass: 0,    tick: 0 },
  gallery: { sub: 0.14, pulse: 0,    box: 0.45, air: 0.10, grind: 0,    bow: 0,    warm: 0.70,
             piano: 0.34, choir: 0.10, brass: 0,    tick: 0 },
  menu:    { sub: 0.20, pulse: 0,    box: 0.55, air: 0.10, grind: 0,    bow: 0,    warm: 0.34,
             piano: 0.22, choir: 0,    brass: 0,    tick: 0 },
};
/* how fast the grid runs, whether the phrase is the major one, and how
   loud the whole thing sits. `night` works its own out of dread. */
const MODE_FEEL = {
  film:    { spb: 1.95, warm: false, level: 0.26, theme: "memory" },
  locked:  { spb: 1.00, warm: false, level: 0.46, theme: "clock" },
  brief:   { spb: 1.35, warm: false, level: 0.40, theme: "clock" },
  dark:    { spb: 1.15, warm: false, level: 0.42, theme: "void" },
  gone:    { spb: 2.40, warm: false, level: 0.38, theme: "memory" },
  found:   { spb: 1.70, warm: true,  level: 0.40, theme: "letter" },
  held:    { spb: 1.42, warm: true,  level: 0.56, theme: "turn" },
  dawn:    { spb: 1.50, warm: true,  level: 0.42, theme: "morning" },
  gallery: { spb: 1.62, warm: true,  level: 0.38, theme: "morning" },
  menu:    { spb: 1.36, warm: "menu", level: 0.42, theme: "menu" },
};

/* THE THEMES.

   A mix is not a piece of music. Nine scenes sharing one melody with
   the faders moved is one score, and what was asked for is scores that
   are different from each other the way the cues in a film are — the
   ticking one, the one where somebody reads a letter, the one where
   the thing you were dreading turns out to be on your side.

   So each scene has material of its own. They are all still built out
   of the same phrase in the same key, because a chapter should sound
   like one place — but a phrase played on a piano in thirds at half
   speed is not the same music as the same phrase ticking underneath a
   brass swell, and it is not supposed to be.

     clock    THE TERMS and the minute before a night. A tick on every
              beat, a brass swell every four bars that gets no higher,
              and one piano note at the top of each bar. Nothing
              resolves, because he is counting and she cannot stop him.
     memory   the film, and the card after a death. Piano alone,
              wide apart, the phrase slowed until it stops being a
              tune and becomes somebody remembering one.
     letter   a page in her hands. The phrase in the major, in thirds,
              which is the first time in the chapter two notes agree.
     turn     one of his got there first. The same major phrase with
              the choir under it and the piano an octave up: the one
              place the game is allowed to be enormous.
     morning  six o'clock and the shop in daylight. The major phrase
              resolved, finally, with the last note left ringing.
     void     the meter is gone. No phrase at all — a choir on one
              note and a brass swell that never arrives anywhere.
     menu     the title, which keeps the wandering music box it had. */
const THEME_NOTES = {
  /* the phrase, in thirds, warm */
  letter:  (s16, bar) => (s16 % 4 === 0 ? [WARM[s16], WARM[s16] + 4] : null),
  turn:    (s16, bar) => (s16 % 4 === 0 ? [WARM[s16], WARM[s16] + 7, WARM[s16] + 12] : null),
  morning: (s16, bar) => (s16 % 8 === 0 ? [WARM[s16], WARM[s16] + 4, WARM[s16] + 7] : null),
  memory:  (s16, bar) => (s16 === 0 ? [FIG[(bar * 3) % 16]] :
                          s16 === 8 ? [FIG[(bar * 3 + 7) % 16] - 12] : null),
};
/* FOUR MORE INSTRUMENTS, because seven layers of the same three ideas
   is one piece of music with the faders moved and he asked for scores
   that are actually different from each other.

     piano   a struck string with a long tail. The thing that carries a
             melody when the music box is too small to. Grief and love
             both live here; the difference is the interval.
     choir   voices, near enough: a stack of detuned saws through a
             formant, swelling rather than starting. This is the layer
             that does awe, and it is the reason the moment one of his
             steps in front of her can be the biggest sound in the game.
     brass   the low swell. Slow in, slow out, and it never plays a
             melody — it plays the fact that something is coming.
     tick    a clock, one hit per beat, dry and small. On its own it is
             a pulse you can feel in the stomach without hearing any
             music at all, which is what the minute before a night
             wants. */
const MUS_LAYERS = ["sub", "pulse", "box", "air", "grind", "bow", "warm",
                    "piano", "choir", "brass", "tick"];

/* A natural minor on A, which is the key the music box is in, so the
   score and the ballerina are the same instrument in the same room. */
function hz(n) { return 220 * Math.pow(2, n / 12); }
const SCALE = [0, 2, 3, 5, 7, 8, 10, 12];          // A B C D E F G A
/* the shop's figure: the phrase the music box never gets to finish */
const FIG   = [0, 7, 12, 7, 3, 10, 7, 3, 0, 7, 12, 15, 12, 10, 7, 3];
const FIG_B = [0, 5, 12, 5, 3, 8, 5, 0, -2, 5, 10, 12, 10, 7, 3, 0];
/* and the same phrase in the major it was written in, for the morning */
const WARM  = [0, 4, 7, 12, 11, 7, 4, 7, 2, 5, 9, 14, 12, 9, 5, 4];

function musicInit() {
  if (!ac() || MUS.ready) return;
  MUS.ready = true;
  MUS.bus = AC.createGain(); MUS.bus.gain.value = 0; MUS.bus.connect(sideGain);
  MUS_LAYERS.forEach((k) => {
    const g = AC.createGain();
    g.gain.value = 0;
    g.connect(MUS.bus);
    MUS.lay[k] = g;
  });

  /* --- the continuous layers ---------------------------------------
     These three never stop for the life of the page. Starting and
     stopping an oscillator is a click and a scheduling risk; a gain of
     zero is neither. */

  /* sub: the floor. Two sines a beat apart so it breathes on its own */
  [41.2, 41.9].forEach((f) => {
    const o = AC.createOscillator(); o.type = "sine"; o.frequency.value = f;
    const g = AC.createGain(); g.gain.value = 0.5;
    o.connect(g); g.connect(MUS.lay.sub); o.start();
    MUS.nodes.push(o);
  });

  /* grind: the root, and a minor second sitting on top of it. This is
     the layer that makes a room feel wrong without doing anything */
  [110, 116.54, 164.81].forEach((f, i) => {
    const o = AC.createOscillator();
    o.type = i === 1 ? "sawtooth" : "triangle";
    o.frequency.value = f;
    const lp = AC.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.value = 420; lp.Q.value = 0.9;
    const g = AC.createGain(); g.gain.value = i === 1 ? 0.16 : 0.1;
    o.connect(lp); lp.connect(g); g.connect(MUS.lay.grind); o.start();
    /* a slow wobble on the dissonant one, so the beating is never even */
    const lfo = AC.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.11 + i * 0.03;
    const lg = AC.createGain(); lg.gain.value = 1.4;
    lfo.connect(lg); lg.connect(o.frequency); lfo.start();
    MUS.nodes.push(o, lfo);
  });

  /* air: breath. Filtered noise up where a room's silence lives */
  const air = AC.createBufferSource(); air.buffer = NB; air.loop = true;
  air.playbackRate.value = 1.9;
  const bp = AC.createBiquadFilter(); bp.type = "bandpass";
  bp.frequency.value = 2100; bp.Q.value = 0.8;
  const ag = AC.createGain(); ag.gain.value = 0.5;
  air.connect(bp); bp.connect(ag); ag.connect(MUS.lay.air); air.start();
  const alfo = AC.createOscillator(); alfo.type = "sine"; alfo.frequency.value = 0.055;
  const alg = AC.createGain(); alg.gain.value = 900;
  alfo.connect(alg); alg.connect(bp.frequency); alfo.start();
  MUS.nodes.push(air, alfo);

  /* warm: the major chord the morning resolves onto. Silent all night */
  [110, 138.59, 164.81, 220].forEach((f) => {
    const o = AC.createOscillator(); o.type = "triangle"; o.frequency.value = f;
    const g = AC.createGain(); g.gain.value = 0.09;
    o.connect(g); g.connect(MUS.lay.warm); o.start();
    MUS.nodes.push(o);
  });
}

/* the two voices that play notes rather than hold them */
/* a struck string: two partials, a hard start and a long tail */
function pianoNote(t, f, gain, dur, pan) {
  const d = dur || 2.2;
  const o = AC.createOscillator(); o.type = "triangle"; o.frequency.value = f;
  const o2 = AC.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2.005;
  const o3 = AC.createOscillator(); o3.type = "sine"; o3.frequency.value = f * 3.01;
  const lp = AC.createBiquadFilter(); lp.type = "lowpass";
  lp.frequency.setValueAtTime(Math.min(9000, f * 12), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 2.4), t + d * 0.5);
  const g2 = AC.createGain(); g2.gain.value = 0.3;
  const g3 = AC.createGain(); g3.gain.value = 0.09;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0004, gain), t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(lp); o2.connect(g2); g2.connect(lp); o3.connect(g3); g3.connect(lp);
  lp.connect(g);
  g.connect(pan === undefined ? MUS.lay.piano : panned({ pan, bus: MUS.lay.piano }));
  [o, o2, o3].forEach((n) => { n.start(t); n.stop(t + d + 0.05); });
}
/* voices, near enough: detuned saws through a vowel, swelling in */
function choirNote(t, f, gain, dur) {
  const d = dur || 3.4;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(0.0004, gain), t + d * 0.42);
  g.gain.linearRampToValueAtTime(0.0001, t + d);
  const f1 = AC.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 620; f1.Q.value = 4.5;
  const f2 = AC.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.value = 1180; f2.Q.value = 6;
  const m = AC.createGain(); m.gain.value = 0.5;
  f1.connect(g); f2.connect(m); m.connect(g);
  [-7, -3, 0, 4, 7].forEach((c, i) => {
    const o = AC.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f * Math.pow(2, c / 12);
    o.detune.value = (i - 2) * 6;
    const og = AC.createGain(); og.gain.value = i === 2 ? 0.26 : 0.14;
    /* a little movement, or five saws is an organ */
    const lfo = AC.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 4.1 + i * 0.4;
    const lg = AC.createGain(); lg.gain.value = f * 0.004;
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + d + 0.1);
    o.connect(og); og.connect(f1); og.connect(f2);
    o.start(t); o.stop(t + d + 0.1);
  });
  g.connect(MUS.lay.choir);
}
/* the low swell. It does not play a tune, it plays the fact of a thing */
function brassNote(t, f, gain, dur) {
  const d = dur || 4.0;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(0.0004, gain), t + d * 0.55);
  g.gain.linearRampToValueAtTime(0.0001, t + d);
  const lp = AC.createBiquadFilter(); lp.type = "lowpass";
  lp.frequency.setValueAtTime(f * 3, t);
  lp.frequency.linearRampToValueAtTime(f * 9, t + d * 0.55);
  lp.frequency.linearRampToValueAtTime(f * 2.5, t + d);
  lp.Q.value = 1.2;
  [0, 0.5, 1].forEach((c, i) => {
    const o = AC.createOscillator();
    o.type = i === 1 ? "square" : "sawtooth";
    o.frequency.value = f * (i === 2 ? 2 : 1);
    o.detune.value = (i - 1) * 7;
    const og = AC.createGain(); og.gain.value = i === 2 ? 0.12 : 0.3;
    o.connect(og); og.connect(lp);
    o.start(t); o.stop(t + d + 0.1);
  });
  lp.connect(g); g.connect(MUS.lay.brass);
}
/* a clock, dry and small, one hit and no tail */
function tickNote(t, gain, hard) {
  const src = AC.createBufferSource(); src.buffer = NB;
  const bp = AC.createBiquadFilter(); bp.type = "bandpass";
  bp.frequency.value = hard ? 2400 : 1700; bp.Q.value = 7;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0004, gain), t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  src.connect(bp); bp.connect(g); g.connect(MUS.lay.tick);
  src.start(t); src.stop(t + 0.09);
}

function boxNote(t, f, gain, pan, dur) {
  const o = AC.createOscillator(); o.type = "triangle"; o.frequency.value = f;
  const o2 = AC.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2.01;
  const bp = AC.createBiquadFilter(); bp.type = "lowpass";
  bp.frequency.setValueAtTime(f * 7, t);
  bp.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.25);
  const g = AC.createGain();
  const d = dur || 1.1;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0004, gain), t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  const g2 = AC.createGain(); g2.gain.value = 0.22;
  o.connect(bp); o2.connect(g2); g2.connect(bp); bp.connect(g);
  g.connect(pan === undefined ? MUS.lay.box : panned({ pan, bus: MUS.lay.box }));
  o.start(t); o2.start(t); o.stop(t + d + 0.05); o2.stop(t + d + 0.05);
}
function heart(t, f, gain) {
  const o = AC.createOscillator(); o.type = "sine";
  o.frequency.setValueAtTime(f * 1.7, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0004, gain), t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.30);
  o.connect(g); g.connect(MUS.lay.pulse);
  o.start(t); o.stop(t + 0.36);
}
function bowNote(t, f, gain, dur) {
  const o = AC.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
  const o2 = AC.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = f * 1.007;
  const bp = AC.createBiquadFilter(); bp.type = "bandpass";
  bp.frequency.value = f * 2.6; bp.Q.value = 3.2;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(0.0004, gain), t + dur * 0.45);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(bp); o2.connect(bp); bp.connect(g); g.connect(MUS.lay.bow);
  o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}

/* --- how frightened the music is ------------------------------------
   Read from the route rather than from the door, so it is climbing
   while the thing is still two rooms away and there is nothing to see
   on any camera. */
function dreadTarget() {
  if (G.phase !== "play") return 0.12;
  if (G.blackout) return 1;
  let d = 0.06 + Math.min(0.16, G.hour * 0.028);
  const all = CAST.map((c) => c.id).concat(SOLD.map((c) => c.id));
  for (let i = 0; i < all.length; i++) {
    const ch = cast[all[i]];
    if (!ch || !ch.awake) continue;
    const total = routeOf(ch).length - 1;
    const near = total ? clamp(ch.step / total, 0, 1) : 0;
    /* squared, so the last two rooms are worth more than the first four */
    let v = near * near * 0.70;
    if (ch.atDoor) v = G.doors[ch.def.door] ? 0.74 : 0.99;
    /* one of his coming to the door is frightening. One of somebody
       else's is worse, and the score should already know that. */
    if (ch.sold) v = Math.min(1, v * 1.15 + 0.06);
    if (v > d) d = v;
  }
  d += (1 - clamp(G.power / TUNE.power.start, 0, 1)) * 0.20;
  return clamp(d, 0, 1);
}

/* a layer's share of the mix: silent below `a`, full at `b` */
function fadeIn(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }

function musicMode(m) {
  if (!ac()) return;
  MUS.want = m;
  audioWake(() => { if (MUS.want === m) musicSwap(m); });
}
function musicSwap(m) {
  musicInit();
  const t = now();
  /* Not 1. Measured on the master bus, the room tone and the score
     together peaked higher than any cue in the game, which meant the
     score was the loudest thing in the shop at every moment of every
     night and every sound that carries information was underneath it.
     A score you cannot play over is a wall. */
  const feel = MODE_FEEL[m];
  const to = m === "none" ? 0.0001 : (feel ? feel.level : MUS_LEVEL);
  MUS.bus.gain.cancelScheduledValues(t);
  MUS.bus.gain.setValueAtTime(Math.max(0.0001, MUS.bus.gain.value), t);
  MUS.bus.gain.linearRampToValueAtTime(to, t + (m === "none" ? 0.9 : 2.2));
  if (m !== MUS.mode) {
    /* a mode change never restarts the grid — the new material simply
       starts landing on the beat the old one was already keeping */
    MUS.mode = m;
    if (m === "night") { MUS.dread = Math.min(MUS.dread, 0.25); }
    else if (m !== "dark") MUS.dread = 0;
  }
}

function musicTick(dt) {
  if (!MUS.ready || !AC || muted) return;
  /* scheduling ahead of a clock that is not moving schedules everything
     into the same instant, and it all arrives at once when it wakes */
  if (AC.state !== "running") return;
  const mode = MUS.mode;
  if (mode === "none") return;

  /* dread rises quickly and lets go slowly, which is what a person
     does. Anything else and the room feels safe the instant a door
     shuts, which it is not. */
  MUS.target = mode === "night" ? dreadTarget() : 0;
  const rate = MUS.target > MUS.dread ? 1.5 : 0.30;
  MUS.dread += clamp(MUS.target - MUS.dread, -rate * dt, rate * dt);
  const d = MUS.dread;

  const set = (k, v) => {
    const g = MUS.lay[k].gain, t = now();
    if (Math.abs(g.value - v) < 0.002) return;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(v, t + 0.55);
  };
  if (mode === "night") {
    set("sub",   0.34 + d * 0.5);
    set("pulse", fadeIn(d, 0.10, 0.45) * 0.75);
    set("box",   fadeIn(d, 0.20, 0.52) * 0.72);
    set("air",   fadeIn(d, 0.28, 0.70) * 0.30);
    set("grind", fadeIn(d, 0.44, 0.86) * 0.52);
    set("bow",   fadeIn(d, 0.60, 0.95) * 0.34);
    set("warm",  0);
  } else {
    const mix = MODE_MIX[mode] || MODE_MIX.menu;
    MUS_LAYERS.forEach((k) => set(k, mix[k] || 0));
  }

  /* --- the grid ---------------------------------------------------
     One sixteenth-note clock for the whole chapter. At rest the night
     runs at 46 beats a minute; with something at an open door it is
     104, and every layer follows it because they are all on the same
     grid. The menu keeps its own slower, steadier one. */
  const feel = MODE_FEEL[mode] || MODE_FEEL.menu;
  const wantSpb = mode === "night" ? lerp(1.30, 0.575, d) : feel.spb;
  /* Eased, not snapped. Switching scene used to change the tempo
     between one sixteenth and the next, which is a cut — and the whole
     claim of this engine is that it never cuts. Half a second to get
     there is slow enough to be a rallentando and fast enough that the
     new room is the new room by the time she has read its first line. */
  if (!MUS.spb) MUS.spb = wantSpb;
  MUS.spb += clamp(wantSpb - MUS.spb, -1.4 * dt, 1.4 * dt);
  const spb = MUS.spb;
  const stepLen = spb / 4;
  const t0 = now();
  if (!MUS.next || MUS.next < t0 - 1) MUS.next = t0 + 0.06;
  let guard = 0;
  while (MUS.next < t0 + MUS_LOOK && guard++ < 64) {
    const t = MUS.next, s = MUS.step & 15;
    if (s === 0) MUS.bar++;
    if (mode === "night") {
      /* the heart. Two beats, close together, on one and three */
      if (d > 0.08) {
        if (s === 0 || s === 8) heart(t, 52, 0.42 + d * 0.5);
        if (s === 2 || s === 10) heart(t, 44, 0.28 + d * 0.34);
      }
      /* the music box, one note a beat, the figure alternating so the
         phrase never repeats twice running */
      if (d > 0.18 && (s & 1) === 0) {
        const fig = (MUS.bar & 1) ? FIG_B : FIG;
        const n = fig[s];
        boxNote(t, hz(n), 0.11 + d * 0.05, ((MUS.bar + s) % 3 - 1) * 0.5, 1.05);
      }
      /* the top string, once every two bars, and only when it is bad */
      if (d > 0.58 && s === 4 && (MUS.bar & 1) === 0) {
        bowNote(t, hz(12 + (MUS.bar % 3 === 0 ? 8 : 7)), 0.055 + d * 0.05, spb * 3.4);
      }
      /* the meter running out gets its own falling note, once a bar */
      if (G.power < TUNE.power.critical && s === 12) {
        boxNote(t, hz(-12), 0.10, 0, 1.8);
      }
    } else if (feel.theme && feel.theme !== "menu") {
      const th = feel.theme;

      /* --- the two that count: THE TERMS, and the minute before a
         night. A tick on every beat and a swell that never gets
         anywhere, because he is counting and she cannot stop him. --- */
      if (th === "clock") {
        if ((s & 3) === 0) tickNote(t, mode === "locked" ? 0.30 : 0.22, s === 0);
        if ((s & 1) === 0 && mode === "locked") tickNote(t, 0.07, false);
        if (s === 0 && (MUS.bar & 3) === 0) {
          brassNote(t, hz(-24 + ((MUS.bar >> 2) & 1 ? 3 : 0)), 0.085, spb * 6.5);
        }
        if (s === 0) pianoNote(t, hz(FIG[(MUS.bar * 5) % 16] - 12), 0.075, spb * 3.2, 0);
        /* and on the last night of the deal, the clock is not alone */
        if (mode === "brief" && (s === 0 || s === 8)) heart(t, 50, 0.30);
      }

      /* --- somebody remembering a tune rather than playing one ----- */
      else if (th === "memory") {
        const n = THEME_NOTES.memory(s, MUS.bar);
        if (n) pianoNote(t, hz(n[0]), mode === "gone" ? 0.11 : 0.085, spb * 4.2,
                         ((MUS.bar % 3) - 1) * 0.4);
        if (s === 0 && (MUS.bar & 3) === 2) brassNote(t, hz(-24), 0.055, spb * 6);
      }

      /* --- the void: no phrase at all. One voice, one swell -------- */
      else if (th === "void") {
        if (s === 0 && (MUS.bar & 1) === 0) choirNote(t, hz(-12), 0.075, spb * 7);
        if (s === 8) brassNote(t, hz(-24 - (MUS.bar & 1 ? 0 : 5)), 0.10, spb * 5.5);
        if (s === 0) bowNote(t, hz(-5), 0.05, spb * 3.6);
      }

      /* --- and the warm ones, which are the same phrase agreeing
         with itself for the first time -------------------------------- */
      else {
        const n = THEME_NOTES[th] && THEME_NOTES[th](s, MUS.bar);
        if (n) {
          const lead = th === "turn" ? 0.115 : th === "morning" ? 0.085 : 0.10;
          pianoNote(t, hz(n[0] + (th === "turn" ? 12 : 0)), lead, spb * 3.6,
                    ((s % 3) - 1) * 0.35);
          n.slice(1).forEach((x, i) => {
            boxNote(t + stepLen * (i + 1) * 0.5, hz(x), 0.055, -((s % 3) - 1) * 0.35, 2.2);
          });
        }
        if (th === "turn" && s === 0) choirNote(t, hz(WARM[0]), 0.10, spb * 6.5);
        if (th === "turn" && s === 8 && (MUS.bar & 1) === 0) brassNote(t, hz(-24), 0.075, spb * 5);
        if (th === "morning" && s === 0 && (MUS.bar & 1) === 0) choirNote(t, hz(0), 0.05, spb * 6);
        if (th === "letter" && s === 12) boxNote(t, hz(WARM[12] - 12), 0.05, 0, 3.0);
      }
    } else {
      /* --- the menu ------------------------------------------------
         The same music box, in the major it was written in, played
         slowly and never quite the same way twice: the phrase moves a
         step every fourth pass and picks up a second voice a fifth
         above on every other one, so a long sit on the title screen
         does not turn into a loop she can predict. */
      const turn = MUS.bar >> 1;
      /* every lift has to stay inside A major, because the warm pad is
         holding an A major triad underneath the whole time. +3 put the
         phrase in C and set a C natural against the pad's C sharp. */
      const lift = [0, 0, 5, 0, -3, 0, 7, 0][turn & 7];
      if ((s & 1) === 0) {
        const n = WARM[(s + ((turn & 3) === 3 ? 2 : 0)) & 15] + lift;
        boxNote(t, hz(n), 0.115, ((s % 4) - 1.5) * 0.36, 1.7);
        /* the answering voice, a beat behind and quieter, like the
           second comb in a music box */
        if ((turn & 1) === 0 && (s & 3) === 0) {
          boxNote(t + stepLen * 1.5, hz(n + 7), 0.052, -((s % 4) - 1.5) * 0.36, 1.5);
        }
      }
      if (s === 0) boxNote(t, hz(-12 + lift), 0.085, 0, 3.0);
    }
    MUS.step++;
    MUS.next += stepLen;
  }
}

function musicStop() {
  if (!MUS.ready) return;
  musicMode("none");
}

function audioTick(dt) {
  if (!audioOn || muted) return;
  creakTimer -= dt;
  if (creakTimer <= 0) {
    creakTimer = 7 + Math.random() * 13;
    SFX.creak();
  }
}
function audioMute(v) {
  muted = v;
  if (master) master.gain.value = v ? 0 : 0.9;
}

/* =========================================================
   18. THE SHIFT

   All the state of a night, in one object, so that "what is happening"
   is one thing to read rather than eight. Everything that changes
   during a shift changes here; the world does not change at all.
   ========================================================= */
const G = {
  phase: "idle",        // idle | load | title | howto | brief | play | pause | over | shift | finale | custom | badges | gallery | arcade
  mode:  "story",       // story | custom | gallery
  night: 1,
  cfg: NIGHTS[0],
  cozy: false,
  hour: 0,              // 0 = 12 AM ... 6 = out
  hourT: 0,
  power: 100,
  drain: 0,
  monitor: false,
  cam: "hall",
  doors: { left: false, right: false, hatch: false },
  blackout: false,
  blackoutT: 0,
  blackoutLen: 0,
  approaching: null,
  dead: null,
  deadT: 0,
  cardT: 0,
  shake: 0,
  flick: 1,             // the failing ceiling bulb
  flickT: 0,
  hallDark: false,
  lost: {},             // roomId -> seconds of signal left
  lostT: 12,
  t: 0,
  warned: 0,
  /* orientation: -1 is off/done, otherwise the step she is on */
  tutor: -1, tutorT: 0,
  /* winding: which one she is holding a key in, and for how long */
  winding: null, windTarget: null, windT: 0, windT0: 0,
  pumping: false,
  caption: "",
  captionT: 0,

  /* the things that are not the four of them */
  alarmT: 0,
  shiftT: 0,
  surgeT: 0,
  lampOut: 0,           // seconds the office bulb is dead for
  lampT: 0,
  monOut: 0,            // seconds the feed is down for
  monT: 0,

  /* everything the rating and the badges are worked out from. All of it
     is counted anyway to run the night; none of it is a separate
     tracking system bolted on for the summary screen. */
  stats: { doorSec: 0, camSec: 0, knocks: 0, arrivals: 0, closes: 0, surges: 0, shifts: 0, lowest: 100 },
  rating: null,
};

/* --- the numbers a night actually runs on ------------------------- */
function nightCfg(n) { return NIGHTS[clamp(n, 1, NIGHTS.length) - 1]; }

/* Custom Night. The story is six fixed shapes; this is the same shop
   with the dials handed over — one to twenty per performer, the way a
   difficulty slider ought to work, and the shift is built out of them
   rather than out of a table. It is the whole long-tail of the game and
   it needs no new art at all. */
const CUSTOM_KEY = "ns_custom";
function customDials() {
  const d = { cogsworth: 5, chime: 5, marabelle: 5, jax: 5 };
  try {
    const o = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "null");
    if (o) CAST.forEach((c) => { if (typeof o[c.id] === "number") d[c.id] = clamp(o[c.id] | 0, 0, 20); });
  } catch (e) { /* private mode: the dials just start in the middle */ }
  return d;
}
function saveDials(d) {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(d)); } catch (e) {}
}
function customCfg(d) {
  const active = {};
  CAST.forEach((c) => { if (d[c.id] > 0) active[c.id] = 0; });
  const top = Math.max(d.cogsworth, d.chime, d.marabelle, d.jax);
  /* The hour curve is a constant, pitched at the pace night six runs
     at, and every performer's own dial multiplies it in stepCast. It
     used to be derived from the highest dial, which quietly coupled all
     four sliders together: turning Jax up to twenty made Cogsworth two
     and a half times faster at the same setting of five. The hazards
     still read the highest dial, because those belong to the shop
     rather than to anyone in it. */
  const base = 1.4;
  return {
    n: 0,
    name: "CUSTOM NIGHT",
    blurb: "Your shop, your rules. " + CAST.map((c) => c.name.charAt(0) + d[c.id]).join(" · "),
    power: 100,
    active,
    ramp: [base * 0.8, base * 0.88, base * 0.96, base, base * 1.08, base * 1.16],
    hazards: top >= 12 ? ["signalLoss", "surges", "officeDark"] : top >= 7 ? ["signalLoss"] : [],
    dials: d,
  };
}
/* a dial of 10 is the story's own pace; 20 is twice it */
function dialOf(id) {
  const d = G.cfg.dials;
  return d ? clamp(d[id] / 10, 0, 2) : 1;
}

function cozyK(k) { return G.cozy ? TUNE.cozy[k] : 1; }

function ramp() {
  const r = G.cfg.ramp;
  return r[clamp(G.hour, 0, r.length - 1)] * cozyK("aggression");
}
function hazard(name) { return G.cfg.hazards.indexOf(name) >= 0; }

function routeOf(ch) { return ch.def.route; }
function stepsLeft(ch) { return routeOf(ch).length - 1 - ch.step; }

/* is a figure being looked at right now? Marabelle is the only one this
   matters to, but the answer is the same question for all of them and
   the HUD wants it too. */
function observed(ch) {
  /* a monitor that has cut out is not a camera. powerRate has always
     known that; this did not, which meant night six's dropouts froze
     the ballerina exactly as well as a working picture did. */
  if (G.monitor && G.monOut <= 0) return G.cam === ch.room && !isLost(G.cam);
  return ch.room === "office";
}
function isLost(roomId) {
  return (G.lost[roomId] || 0) > 0 || (hazard("deadWorkshop") && roomId === "workshop");
}

/* --- putting a figure at its current station ---------------------- */
function syncChar(ch) {
  const r = routeOf(ch)[clamp(ch.step, 0, routeOf(ch).length - 1)];
  putChar(ch, r[0], r[1]);
  ch.atDoor = r[0] === "office";
}

function resetCast() {
  CAST.forEach((def) => {
    const ch = cast[def.id];
    ch.step = 0;
    ch.cool = range(Math.random, 3, 9);
    ch.pose = "idle";
    ch.atDoor = false;
    ch.doorT = 0;
    ch.knocks = 0;
    ch.knockT = 0;
    ch.awake = false;
    ch.asleep = false;
    ch.phase = Math.random() * 10;
    syncChar(ch);
  });
}

/* --- one figure's turn -------------------------------------------- */
function stepCast(ch, dt) {
  /* the dark belongs to stepBlackout. Leaving this running through it
     decremented the approach timer a second time every frame — and,
     because a blackout forces every door open, anyone already standing
     at one killed on their own clock instead of on the grace. */
  if (G.blackout) return;
  const tune = TUNE.cast[ch.def.id];
  const from = G.cfg.active[ch.def.id];
  if (from === undefined) return;                  // asleep all night
  if (ch.asleep) return;                           // held asleep by a test
  if (!ch.awake) {
    if (G.hour < from) return;
    ch.awake = true;
    /* the moment one of them wakes up is worth hearing */
    cue(ch, 0.55);
  }

  /* at the door: the only place the player's actions matter */
  if (ch.atDoor) {
    const shut = G.doors[ch.def.door] && !G.blackout;
    if (shut) {
      /* A wound one takes no for an answer. It came to the door, the
         door was shut, and it goes back to what it was doing — which
         means keeping them wound literally costs her fewer door
         seconds, and the mechanic pays for itself instead of being a
         tax on top of one. A slack one has nobody telling it that. */
      if (isWound(ch)) ch.doorT -= dt * 0.55;
      if (ch.def.id === "jax") {
        /* Jax does not go away politely. He knocks, and every knock is
           power you do not get back — which is the whole answer to
           "why not just hold both doors all night". */
        ch.knockT -= dt;
        if (ch.knockT <= 0) {
          ch.knockT = 2.0;
          ch.knocks++;
          G.stats.knocks++;
          spendPower(TUNE.power.knock * cozyK("power"));
          SFX.knock();
          G.shake = Math.max(G.shake, 0.5);
          if (ch.knocks >= 3) retreat(ch);
        }
      } else {
        ch.doorT -= dt;
        if (ch.doorT <= 0) retreat(ch);
      }
      return;
    }
    /* the door is open. This is the reaction window. */
    ch.doorT -= dt;
    if (ch.doorT <= 0) { kill(ch); return; }
    return;
  }

  /* Marabelle cannot move while she is watched, and her clock does not
     run either — keeping the camera on her is a real, and expensive,
     defence */
  /* Marabelle stops when she is looked at — but that is a description
     of a wound Marabelle. Let her run down and the thing in the party
     room stops being the one on the card. */
  if (ch.def.id === "marabelle" && isWound(ch)) {
    const watched = observed(ch);
    ch.pose = watched ? "frozen" : "idle";
    if (watched) return;
  }

  ch.cool -= dt;
  if (ch.cool > 0) return;
  /* run down: faster, and without the manners its tag promises */
  const slack = !isWound(ch) ? 1.35 : 1;
  const agg = ramp() * dialOf(ch.def.id) * slack;
  ch.cool = tune.step / Math.max(0.15, agg);
  if (Math.random() > tune.chance * agg) return;

  /* Jax skips, and occasionally doubles back, which is why he is the
     one you cannot plan around */
  let adv = 1;
  if (ch.def.id === "jax") {
    const r = Math.random();
    if (r > 0.82) adv = 2;
    else if (r < 0.12 && ch.step > 0) adv = -1;
  }
  ch.step = clamp(ch.step + adv, 0, routeOf(ch).length - 1);
  syncChar(ch);
  ch.pose = "walk";
  G.stats.moves++;
  if (ch.atDoor) {
    ch.doorT = (tune.doorGrace * cozyK("doorGrace")) / Math.max(0.8, agg * 0.85);
    G.stats.arrivals++;
    ch.knocks = 0;
    ch.knockT = 0.7;
    arriveCue(ch);
  } else {
    cue(ch, TUNE.cueGain[clamp(stepsLeft(ch), 0, 3)]);
  }
}

function retreat(ch) {
  const tune = TUNE.cast[ch.def.id];
  ch.step = Math.max(0, ch.step - (tune.back || 2));
  ch.atDoor = false;
  ch.cool = tune.retreat;
  ch.knocks = 0;
  syncChar(ch);
  cue(ch, 0.3);
}

/* the sound a figure makes when it moves */
function cue(ch, g) {
  const v = clamp(g, 0.08, 1);
  const p = TUNE.pan[ch.def.door];
  if (ch.def.id === "cogsworth") { SFX.step(v, p); setTimeout(() => SFX.step(v * 0.85, p), 260); SFX.tick(v * 0.9, p); }
  else if (ch.def.id === "chime") { SFX.flutter(v * 0.8, p); setTimeout(() => SFX.hoot(v, p), 220); }
  else if (ch.def.id === "marabelle") { SFX.tune(v * 0.8, 1, p); }
  else { SFX.crank(v * 0.7, p); setTimeout(() => SFX.bells(v, p), 300); }
}
/* and the different, closer sound it makes when it is at the door */
function arriveCue(ch) {
  const p = TUNE.pan[ch.def.door];
  if (ch.def.id === "cogsworth") { SFX.step(1, p); SFX.wind(0.9, p); }
  else if (ch.def.id === "chime") { SFX.hoot(1, p); SFX.flutter(0.9, p); }
  else if (ch.def.id === "marabelle") { SFX.tune(1, 0.72, p); }
  else { SFX.laugh(0.9, p); SFX.bells(0.9, p); }
  /* the system notices it too, and says only that it noticed */
  say(fmt(NS.sys.motion, ch.def.door === "hatch" ? "VENT" :
        ch.def.door === "left" ? "WEST DOOR" : "EAST DOOR"), true);
}

/* --- power --------------------------------------------------------- */
function spendPower(v) {
  G.power = Math.max(0, G.power - v);
  if (G.power <= 0 && !G.blackout) startBlackout();
}
function powerRate() {
  const p = TUNE.power;
  let r = p.idle;
  if (G.monitor && G.monOut <= 0) r += p.camera;
  if (G.doors.left) r += p.door;
  /* the failing actuator on the right, from night five: that door is
     slower to answer and it costs half again to hold */
  if (G.doors.right) r += p.door * (hazard("stickyDoor") ? 1.5 : 1);
  if (G.doors.hatch) r += p.hatch;
  /* Jax leaning on a shut door costs extra for as long as he is there */
  const jax = cast.jax;
  if (jax && jax.awake && jax.atDoor && G.doors[jax.def.door]) r += p.jaxDoor;
  /* later nights cost a little more per second, but only a little: the
     late nights are hard because four of them are awake and the doors
     are shut a third of the night, not because the meter was quietly
     shrunk underneath you. */
  return r * (0.94 + ramp() * 0.05) * cozyK("power");
}

function startBlackout() {
  G.blackout = true;
  /* the heartbeat stops. That is the whole cue — six layers open up
     underneath it and the one thing that was keeping time is gone. */
  musicMode("dark");
  say(NS.sys.pwrOut, true);
  G.blackoutT = 0;
  G.blackoutLen = range(Math.random, TUNE.blackout.graceMin, TUNE.blackout.graceMax);
  G.approaching = null;
  G.doors.left = G.doors.right = G.doors.hatch = false;
  G.monitor = false;
  SFX.powerDown();
  bumpUI();
}

/* the dark. Not a game over — a held breath, and whether it ends badly
   depends entirely on how much of the night you had left when the meter
   ran out. Waste nothing and the shutters go up before it reaches you. */
function stepBlackout(dt) {
  G.blackoutT += dt;
  if (!G.approaching && G.blackoutT > G.blackoutLen) {
    const awake = CAST.map((d) => cast[d.id]).filter((c) => c.awake);
    const pick = awake.filter((c) => c.def.id === "jax");
    G.approaching = (pick.length ? pick : awake.length ? awake : [cast.cogsworth])[0];
    G.approaching.step = routeOf(G.approaching).length - 1;
    syncChar(G.approaching);
    G.approaching.atDoor = true;
    SFX.tune(0.8, 1.35);
  }
  if (G.approaching) {
    G.approaching.doorT = (G.approaching.doorT || TUNE.blackout.approach) - dt;
    if (G.approaching.doorT <= 0) kill(G.approaching);
  }
}

/* =========================================================
   18e. ORIENTATION

   The first night of a game like this normally opens on a dark room
   and a person who has never played one wondering what she is supposed
   to be doing. A wall of text on a card before it does not fix that:
   she skips it, and then she is in the dark room anyway.

   So night one starts in the terminal's orientation mode, which is a
   real thing an old security system would have. One instruction at a
   time, and **the shift stops and waits** until she does it — the
   clock does not run, the meter does not drain, nothing walks. She
   cannot fail it and she cannot fall behind it. By the time it hands
   the night over she has raised the monitor, walked the cameras, shut
   a door, opened it again and latched the hatch, all with her own
   hands. Nobody has explained anything.

   It only ever happens once. After night one is in the book it never
   runs again, and the switch on the title screen turns it off for
   somebody who does not want it.
   ========================================================= */
const TUTOR = [
  { line: "ORIENTATION. THE SHIFT WILL WAIT FOR YOU.", hold: 2.6 },
  { line: "MONITOR: RAISE IT.",
    hint: "SPACE, or the CAMS button",
    done: () => G.monitor },
  { line: "GOOD. STEP THROUGH THE ROOMS.",
    hint: "the arrows, the plan, or 1 to 8",
    done: () => tutorSeen() >= 4 },
  { line: "LOOK AT WHAT IS IN THEM. SOMETHING IS ALWAYS OUT OF PLACE.",
    hold: 3.4 },
  { line: "MONITOR: LOWER IT. IT DRAWS WHILE IT IS UP.",
    hint: "SPACE again",
    done: () => !G.monitor },
  { line: "WEST DOOR: CLOSE IT.",
    hint: "A, or the LEFT DOOR button",
    done: () => G.doors.left },
  { line: "A SHUT DOOR HOLDS. IT ALSO DRAWS. OPEN IT.",
    hint: "A again — never leave one shut",
    done: () => !G.doors.left },
  { line: "CEILING HATCH: LATCH IT.",
    hint: "W, or the HATCH button",
    done: () => G.doors.hatch },
  { line: "GOOD. UNLATCH.",
    hint: "W again",
    done: () => !G.doors.hatch },

  /* And the one the whole rest of the game turns on. It was missing
     for a whole pass: she was being taught doors and cameras and left
     to find the most important control in the chapter in a note she
     might skim. The step sets a performer running down on purpose,
     because at midnight all four are still on the wind he left them
     and there would be no key to find. */
  { line: "ONE OF THEM IS RUNNING DOWN.",
    hold: 2.8,
    enter: () => {
      const c = cast.cogsworth;
      if (!c) return;
      c.awake = true;
      c.wound = 0.4;
      c.step = 0;
      c.atDoor = false;
      c.cool = 999;                 // he stays put while she learns this
      syncChar(c);
    } },
  { line: "FIND HIM.",
    hint: "he is on one of the cameras",
    done: () => G.monitor && cast.cogsworth && G.cam === cast.cogsworth.room },
  { line: "THERE IS A KEY IN HIS BACK. HOLD IT.",
    hint: "press and hold until the ring fills",
    done: () => cast.cogsworth && (cast.cogsworth.wound || 0) > 5 },
  { line: "THAT ONE IS YOURS UNTIL DAWN. THE NOTE SAYS ALL FOUR, EVERY NIGHT.",
    hold: 4.0,
    enter: () => { if (cast.cogsworth) cast.cogsworth.cool = 4; } },

  { line: "ORIENTATION COMPLETE. THE SHIFT IS YOURS.", hold: 3.0 },
];

let tutorRooms = {};
function tutorSeen() { return Object.keys(tutorRooms).length; }

function tutorStart() {
  G.tutor = 0;
  G.tutorT = 0;
  tutorRooms = {};
  tutorShow();
}
function tutorOff() {
  G.tutor = -1;
  if (EL["ns-tutor"]) EL["ns-tutor"].hidden = true;
}
function tutorOn() { return G.tutor >= 0 && G.tutor < TUTOR.length; }

function tutorShow() {
  const el = EL["ns-tutor"];
  if (!el) return;
  const step = TUTOR[G.tutor];
  if (!step) { el.hidden = true; return; }
  el.hidden = false;
  if (step.enter) step.enter();
  el.innerHTML = '<b>' + step.line + '</b>' +
                 (step.hint ? '<span>' + step.hint + '</span>' : "");
  el.classList.remove("nudge");
  /* the annunciator reads it out, but straight to the voice rather than
     through say() — the words are already on screen in the box, and the
     caption strip underneath saying the same thing twice reads as a bug */
  annunciate(step.line, false);
}

/* Called from the frame loop before anything else in the night. While a
   step is waiting on her, this returns false and the caller skips the
   whole shift — which is what makes it impossible to lose and
   impossible to rush. */
function tutorStep(dt) {
  if (!tutorOn()) return true;
  const step = TUTOR[G.tutor];
  G.tutorT += dt;
  if (G.monitor) tutorRooms[G.cam] = 1;
  const ready = step.done ? step.done() : G.tutorT >= (step.hold || 2);
  if (ready) {
    G.tutor++;
    G.tutorT = 0;
    SFX.beep(false);
    if (!tutorOn()) {
      tutorOff();
      /* once through is enough. Replaying night one after a bad first
         attempt should not mean sitting through it again. */
      saveNoTutor(true);
      /* the night proper starts here, with the clock still at midnight */
      say(NS.sys.boot, false);
      return true;
    }
    tutorShow();
    return false;
  }
  /* a gentle nudge if she has been looking at it for a while */
  if (step.done && G.tutorT > 9 && EL["ns-tutor"]) {
    EL["ns-tutor"].classList.add("nudge");
  }
  return false;
}

/* =========================================================
   18f. WHAT THE FOUR ARE ACTUALLY FOR

   The whole story turns on one sentence he could not say out loud, so
   the game has to say it in mechanics instead: his four are not the
   threat, they are what is between her and the threat.

   So: when one of the ones he sold gets through an open door, and any
   of his four is still wound, one of his gets there first.

   The returner leaves. The one that stepped in is spent — it goes back
   to where it started and its wind is gone, and it will not do it
   again until she winds it. Which makes the four of them her lives,
   makes his instruction the thing that keeps her alive, and makes the
   moment she works that out the moment the game stops being about
   doors.

   She is never told this will happen. The first time it does, on a
   night she thought she had lost, a soldier she has spent four nights
   shutting out is standing in her doorway with its back to her.
   ========================================================= */
/* THE ONE BEAT THE WHOLE CHAPTER IS BUILT ON, AND IT WAS OPTIONAL.

   The moment one of his four steps in front of her is the answer to
   everything: he did not leave her four monsters, he left her four
   guards made out of the four things he loved about her. And it could
   only ever happen if a parcel reached an OPEN door while one of his
   was still wound — which means a player doing well never saw it, and
   a player doing badly saw it once by accident. The most important
   thing in the story was gated behind playing it wrong.

   So night five stages it. One parcel, at an hour she will be awake
   for, walked to the door on rails; the nearest wound one takes it;
   the card comes up. If she has let all four run down it does not
   happen — that is still her call and it still costs her — but she is
   told at the top of the night to keep them wound, and the tape for
   night five is him asking for exactly that. */
const STAGED = { night: 5, hour: 2, done: false, id: "post1" };

function stageTheTurn(dt) {
  if (G.mode !== "story" || G.night !== STAGED.night) return;
  if (STAGED.done || seenSave()) return;
  if (G.phase !== "play" || G.blackout) return;
  if (G.hour < STAGED.hour) return;
  const ch = cast[STAGED.id];
  if (!ch) return;
  /* it has to be somebody's turn to take it, or there is nothing to show */
  if (!guardFor(ch.def.door)) return;
  STAGED.done = true;
  ch.asleep = false;
  ch.awake = true;
  ch.cool = 0;
  /* put it at the door with the shortest grace it ever gets, so the
     thing she sees is one of his arriving rather than a long wait */
  ch.step = ch.def.route.length - 1;
  ch.atDoor = true;
  ch.doorT = 1.2;
  syncChar(ch);
  SFX.postSettle(TUNE.pan[ch.def.door]);
  say(fmt(NS.sys.unknown, ch.def.door === "left" ? "WEST DOOR" : "EAST DOOR"), true);
}

function guardFor(door) {
  /* whoever is nearest, and wound. Preference to the one that uses this
     door, because that one was already on its way here. */
  let best = null, bestScore = -1;
  CAST.forEach((d) => {
    const ch = cast[d.id];
    if (!ch || !isWound(ch)) return;
    let sc = 1 + ch.step * 0.4;
    if (ch.def.door === door) sc += 3;
    if (ch.awake) sc += 1;
    if (sc > bestScore) { bestScore = sc; best = ch; }
  });
  return best;
}

/* called instead of kill() when one of his is able to get there */
function intercept(threat, keeper) {
  G.stats.saves++;
  /* the returner goes, all the way back, and stays gone a while */
  soldRetreat(threat);
  threat.cool = SOLD_TUNE.retreat * 1.6;
  /* and the one that stepped in has spent itself doing it */
  keeper.wound = 0;
  keeper.step = 0;
  keeper.atDoor = false;
  keeper.cool = 14;
  keeper.awake = true;
  syncChar(keeper);

  SFX.postSettle(TUNE.pan[threat.def.door]);
  cue(keeper, 1);
  G.shake = Math.max(G.shake, 0.55);
  say(fmt(NS.sys.held, threat.def.door === "left" ? "WEST DOOR" : "EAST DOOR"), true);

  /* the first time it happens she gets told what she just saw, once,
     and never again — after that it is simply how the shop works */
  tapeTrigger("firstHeld");
  if (!seenSave() && !G.pumping) heldCard(keeper);
}

/* the card, on its own, because pump() deliberately never stops to tell
   a story and so nothing that only happens on a card could be checked */
function heldCard(keeper) {
  saveSeenSave(true);
  G.phase = "held";
  musicMode("held");
  showHud(false);
  overlay(
    '<div class="ns-card ns-card-held">' +
      '<p class="ns-from">' + NS.held.where + '</p>' +
      '<div class="ns-lines">' +
        NS.held.lines.map((l) => "<p>" + l + "</p>").join("") +
      '</div>' +
      '<p class="ns-pencil">' + fmt(NS.held.who, keeper.def.name) + '</p>' +
      '<div class="ns-btns"><button class="ns-btn ns-btn-go" data-go="heldOut">BACK TO IT</button></div>' +
    '</div>', "ns-ov-held");
}
function closeHeld() {
  if (G.phase !== "held") return;
  G.phase = "play";
  musicMode(G.blackout ? "dark" : "night");
  noOverlay();
  showHud(true);
}
/* HE ASKED HER FOR SIX NIGHTS WITHOUT BEING CAUGHT, so the game has to
   know whether she managed it. Not as a score — as the thing he said he
   wanted, which the last night then answers one way or the other. It is
   never a fail state: getting caught costs her the clean run and
   nothing else, and he says so himself the first time it happens. */
const HURT_KEY = "ns_hurt";
function wasHurt() { try { return localStorage.getItem(HURT_KEY) === "1"; } catch (e) { return false; } }
function markHurt() { try { localStorage.setItem(HURT_KEY, "1"); } catch (e) {} }
function clearHurt() { try { localStorage.removeItem(HURT_KEY); } catch (e) {} }

const SAVE_KEY = "ns_seensave";
function seenSave() {
  try { return localStorage.getItem(SAVE_KEY) === "1"; } catch (e) { return false; }
}
function saveSeenSave(v) { try { localStorage.setItem(SAVE_KEY, v ? "1" : "0"); } catch (e) {} }

/* --- and what they do at six ---------------------------------------
   Every morning the four of them walk back to their places on their
   own. She has watched it happen five times on a monitor without once
   understanding what she was looking at, and on the sixth she reads
   the page that explains it. This is that, in sound: each one that is
   awake goes home, in turn, and then the shop is quiet. */
function walkHome() {
  let n = 0;
  CAST.forEach((d) => {
    const ch = cast[d.id];
    if (!ch || !ch.awake) return;
    const at = 0.35 + n * 0.85;
    n++;
    setTimeout(() => {
      if (G.phase !== "shift" && G.phase !== "finale") return;
      ch.step = 0;
      ch.atDoor = false;
      ch.pose = "idle";
      syncChar(ch);
      cue(ch, 0.5);
    }, at * 1000);
  });
  /* and then nothing at all, which is the point */
  setTimeout(() => {
    if (G.phase === "shift" || G.phase === "finale") SFX.hiss(0.25);
  }, (0.35 + n * 0.85 + 0.9) * 1000);
}

/* --- the end of it ------------------------------------------------- */
function kill(ch) {
  if (G.phase !== "play") return;
  sayClear();
  tapeOff();
  /* the terms, broken. He asked for six clean nights; this was not one. */
  if (G.mode === "story") { G.brokeNow = !wasHurt(); markHurt(); }
  /* the score cuts out from under the scare rather than fading through
     it — the silence is half of what makes the noise land */
  musicMode("none");
  G.phase = "over";
  G.dead = ch.def.id;
  G.deadT = 0;
  G.cardT = 0;
  G.shake = G.cozy ? 0.4 : 1;
  ch.pose = "scare";
  ch.awake = true;
  /* right in the lens, and lit by nothing but the office */
  const base = view.userData.base;
  const dir = new T.Vector3(0, 0, -1).applyQuaternion(view.quaternion);
  ch.group.position.copy(base.pos).addScaledVector(dir, 0.92);
  /* line its eyes up with the lens rather than a fraction of its height:
     the four of them are very different shapes and only the eyes are in
     the same place on all of them */
  ch.group.position.y = base.pos.y - (ch.group.userData.eyeY || 1.5) + 0.1;
  ch.group.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
  ch.group.visible = true;
  ch.group.updateMatrix();
  G.killChar = ch;
  SFX.scare(ch.def.id, cozyK("scare"));
  bedStop();
  showHud(false);
  noOverlay();
}

function winNight() {
  G.phase = "shift";
  G.deadT = 0;
  G.cardT = 0;
  showHud(false);
  /* the strip goes now rather than on the next frame: uiTick does not
     run once the shift is over, so anything left on screen would sit
     under the card until the title */
  sayClear();
  const last = G.mode === "story" && G.night >= NIGHTS.length;
  /* the night goes in the book before it is marked, so that the badge
     for finishing every night can see the one just finished */
  if (G.mode === "story") {
    try {
      const done = JSON.parse(localStorage.getItem("ns_nights") || "{}");
      done[G.night] = true;
      localStorage.setItem("ns_nights", JSON.stringify(done));
      if (last && window.markNightShiftDone) window.markNightShiftDone();
    } catch (e) { /* private mode: the shift still counts, it just won't keep */ }
  }
  G.rating = rateNight();
  G.newBadges = awardBadges();
  walkHome();
  if (last) {
    /* the finale is the only place the room changes character: the
       window goes over to morning, the rig warms up, and the music box
       is allowed to finish the tune it has been cutting short all week */
    G.dawn = true;
    if (officeParts && officeParts.glass && TX.dawn) {
      officeParts.glass.material = new T.MeshBasicMaterial({ map: TX.dawn, fog: true });
    }
    SFX.sixAM();
    setTimeout(() => { if (G.phase === "shift" || G.phase === "finale") SFX.tuneWhole(0.75); }, 2600);
  } else {
    SFX.sixAM();
    /* straight to the annunciator: six o'clock is worth hearing, and the
       caption strip is already gone */
    annunciate(NS.sys.six, false);
  }
  musicMode("dawn");
  syncTrophies();
  bumpUI();
}

/* --- the clock ------------------------------------------------------ */
function stepClock(dt) {
  G.hourT += dt;
  if (G.hourT >= TUNE.hourSeconds) {
    G.hourT -= TUNE.hourSeconds;
    G.hour++;
    if (G.hour >= 6) { winNight(); return; }
    SFX.beep(false);
    say(fmt(NS.sys.hour, ["ZERO ONE", "ZERO TWO", "ZERO THREE", "ZERO FOUR", "ZERO FIVE"][G.hour - 1] || ""));
    bumpUI();
  }
}

/* --- the cameras that give out --------------------------------------- */
function stepSignal(dt) {
  if (!hazard("signalLoss")) return;
  for (const k in G.lost) if (G.lost[k] > 0) G.lost[k] -= dt;
  G.lostT -= dt;
  if (G.lostT <= 0) {
    G.lostT = range(Math.random, 26, 46);
    const pool = ROOMS.filter((r) => r.cam > 0 && r.id !== "workshop");
    const r = pick(Math.random, pool);
    G.lost[r.id] = range(Math.random, 14, 22);
    if (G.monitor && G.cam === r.id) SFX.hiss(1.2);
    say(fmt(NS.sys.camLost, "ZERO " + r.cam), true);
    bumpUI();
  }
}

/* =========================================================
   18g. THE TAPES HE LEFT IN THE SHOP

   The one that answers "why is she still playing this".

   Everything the chapter had to say was said before a night or after
   it — the film, the shift card, a page she might never find. So the
   five and a half minutes she actually spends in the office had no
   story in them at all, only a job. Somebody who plays games will sit
   through that because the job is good. Somebody who does not will put
   the phone down at about four in the morning of night two, and she
   would be right to.

   So he talks to her while she works. One line an hour, plus a handful
   that wait for her to do something rather than for a clock, so the
   shop answers her instead of reciting at her.

   The rules it plays by, all of which matter more than the writing:

     never over a scare       nothing speaks unless the phase is play
     never over the building  the annunciator has the right of way; his
                              line waits for it and then goes
     never twice              every line is fired once and marked
     never in a crisis        it holds while something is at a door,
                              because a man reminiscing over the top of
                              a jack-in-the-box is a joke
     it ducks                 the score steps back for him the way it
                              steps back for a cue, so a voice is a
                              voice and not a texture

   And it is his voice, not the terminal's. That is the whole reason
   the voice was rebuilt: two machines talking is a shop with a fault,
   one machine and one man is a woman being spoken to by her husband.
   ========================================================= */
const TAPE = {
  on: false, said: {}, wait: 0, speakT: 0, line: "", plan: null, t0: 0,
  pending: null, opened: false,
};
const TAPE_GAP = 7.0;          // shortest quiet between two of his lines

function tapeReset() {
  TAPE.on = true;
  TAPE.said = {};
  TAPE.wait = 5.0;             // she gets a moment before he starts
  TAPE.speakT = 0;
  TAPE.line = "";
  TAPE.plan = null;
  TAPE.pending = null;
  TAPE.opened = false;
  if (EL["ns-tape"]) { EL["ns-tape"].hidden = true; EL["ns-tape"].innerHTML = ""; }
}
function tapeOff() {
  TAPE.on = false;
  TAPE.speakT = 0;
  if (EL["ns-tape"]) { EL["ns-tape"].hidden = true; EL["ns-tape"].innerHTML = ""; }
}

/* is this a moment a man could speak into? */
function tapeQuiet() {
  if (G.phase !== "play") return false;
  if (G.blackout) return false;
  if (sayQueue.length || G.t < sayUntil) return false;   // the building first
  if (tutorOn()) return false;
  for (const id in cast) {
    const ch = cast[id];
    if (ch && ch.awake && ch.atDoor) return false;       // not now
  }
  return true;
}

function tapeSay(line) {
  if (!line || TAPE.said[line]) return false;
  TAPE.said[line] = 1;
  TAPE.plan = voxPlan(line);
  TAPE.line = line;
  TAPE.t0 = perf();
  TAPE.speakT = TAPE.plan.dur + 1.1;
  voxSpeak(TAPE.plan, { gain: 0.9 });
  /* he gets the room to himself, the way a cue does but for longer */
  cueDuck(0.42);
  const el = EL["ns-tape"];
  if (el) {
    el.hidden = false;
    el.innerHTML = TAPE.plan.words
      .map((w, i) => '<i data-w="' + i + '">' + w.text + "</i>")
      .join(" ");
  }
  return true;
}

/* the ones that wait for her rather than for the clock */
function tapeTrigger(key) {
  if (!TAPE.on || !NS.tapeWhen) return;
  const line = NS.tapeWhen[key];
  if (!line || TAPE.said[line]) return;
  TAPE.pending = line;
}

function tapeTick(dt) {
  if (!TAPE.on) return;
  const el = EL["ns-tape"];

  /* light the word he is on, the same way the film does */
  if (TAPE.speakT > 0 || voxTalking()) {
    if (!voxTalking()) TAPE.speakT -= dt;
    if (el && TAPE.plan) {
      const mark = voxMark();
      const t = perf() - TAPE.t0;
      const kids = el.children;
      for (let i = 0; i < kids.length; i++) {
        const w = TAPE.plan.words[i];
        kids[i].className = (mark >= 0 ? i <= mark : (w && t >= w.at)) ? "on" : "";
      }
    }
    if (TAPE.speakT <= 0 && !voxTalking() && el) { el.hidden = true; el.innerHTML = ""; }
    return;
  }
  if (el && !el.hidden) { el.hidden = true; el.innerHTML = ""; }

  TAPE.wait -= dt;
  if (TAPE.wait > 0 || !tapeQuiet()) return;

  /* Something she did comes before something the clock did — but not
     before he has introduced himself. A man whose first words to his
     wife are a remark about a doorknob has not said hello. */
  if (TAPE.pending && TAPE.opened) {
    const line = TAPE.pending;
    TAPE.pending = null;
    if (tapeSay(line)) { TAPE.wait = TAPE_GAP; return; }
  }
  const script = NS.tapes && NS.tapes[G.night];
  if (!script) return;
  for (let i = 0; i < script.length; i++) {
    const it = script[i];
    if (it.h > G.hour) break;
    if (TAPE.said[it.t]) continue;
    if (tapeSay(it.t)) { TAPE.opened = true; TAPE.wait = TAPE_GAP; return; }
  }
}

/* =========================================================
   18b. THE THINGS THAT ARE NOT THE FOUR OF THEM

   A false alarm, a toy that moved, a spike off the meter, a bulb that
   gives up, a door that has started to stick, a feed that drops in the
   middle of a look. None of them can kill her; all of them cost her
   the thing this game actually runs on, which is her attention.
   ========================================================= */
function nextIn(range2, k) {
  return range(Math.random, range2[0], range2[1]) * (k || 1);
}

function stepAlarms(dt) {
  G.alarmT -= dt;
  if (G.alarmT > 0) return;
  const shorten = 1 - clamp(G.hour * TUNE.alarm.perHour, 0, 0.55);
  /* and they come roughly twice as often while nothing is actually on
     its way. That is what they are for: the quiet is theirs to fill,
     and the quietest stretch of the whole chapter — midnight on night
     one, with one of them awake and barely moving — is exactly where
     the gaps used to be longest. */
  const lull = 1 - clamp(dreadTarget(), 0, 1);
  G.alarmT = nextIn(TUNE.alarm.every, shorten * lerp(1, 0.5, lull) /
                    Math.max(0.2, cozyK("alarms") > 0.9 ? 1 : 1 / cozyK("alarms")));
  if (G.cozy && Math.random() > TUNE.cozy.alarms) return;
  G.stats.alarms++;
  /* a side to come from, so it reads as a place rather than a noise */
  const pan = pick(Math.random, [-0.8, -0.5, 0, 0.5, 0.8]);
  const kind = (Math.random() * 4) | 0;
  if (kind === 0) { SFX.falseBang(pan); G.shake = Math.max(G.shake, 0.26); }
  else if (kind === 1) SFX.falseSettle(pan);
  else if (kind === 2) SFX.falseSkitter(pan);
  else { SFX.falseBurst(pan); G.flick = 0.2; G.flickT = 0.25; }
}

function stepShifts(dt) {
  G.shiftT -= dt;
  if (G.shiftT > 0) return;
  G.shiftT = nextIn(TUNE.shift.every);
  shiftSomething();
}

/* --- the hazards that belong to particular nights ------------------ */
function stepHazards(dt) {
  if (hazard("surges")) {
    G.surgeT -= dt;
    if (G.surgeT <= 0) {
      G.surgeT = range(Math.random, 70, 130);
      if (!G.blackout) {
        spendPower(TUNE.power.surge * cozyK("power"));
        G.stats.surges++;
        SFX.surge();
        G.shake = Math.max(G.shake, 0.3);
        say(NS.sys.surge, true);
      }
    }
  }
  if (hazard("officeDark")) {
    if (G.lampOut > 0) {
      G.lampOut -= dt;
      if (G.lampOut <= 0) G.lampT = range(Math.random, 30, 62);
    } else {
      G.lampT -= dt;
      if (G.lampT <= 0) {
        G.lampOut = range(Math.random, 3.5, 8);
        SFX.hiss(0.5);
        say(NS.sys.lampFail);
      }
    }
  }
  if (hazard("monitorDrop")) {
    if (G.monOut > 0) {
      G.monOut -= dt;
      if (G.monOut <= 0) { G.monT = range(Math.random, 26, 54); bumpUI(); }
    } else {
      G.monT -= dt;
      if (G.monT <= 0 && G.monitor) {
        G.monOut = range(Math.random, 2.4, 5);
        SFX.hiss(1.3);
        say(NS.sys.monFault, true);
        bumpUI();
      }
    }
  }
}

/* --- how the shop itself gets worse as the clock runs -------------- */
function decayK() { return G.hour * cozyK("decay"); }

/* =========================================================
   18c. HOW THE NIGHT IS SCORED

   Everything here comes out of numbers the shift was already keeping.
   No new tracking, no separate telemetry — just a sentence at the end
   about how it actually went, and six lines she can collect.
   ========================================================= */
const BADGE_KEY = "ns_badges";
function badgesGot() {
  try { return JSON.parse(localStorage.getItem(BADGE_KEY) || "{}") || {}; }
  catch (e) { return {}; }
}
function giveBadge(id) {
  try {
    const b = badgesGot();
    if (b[id]) return false;
    b[id] = true;
    localStorage.setItem(BADGE_KEY, JSON.stringify(b));
    return true;
  } catch (e) { return false; }
}

function rateNight() {
  const st = G.stats;
  /* a clean night is one where nothing ever got as far as needing a
     door in a hurry, and the meter never went near the floor */
  let score = 0;
  if (G.power >= 25) score += 2; else if (G.power >= 10) score += 1;
  if (st.lowest >= 20) score += 2; else if (st.lowest >= 8) score += 1;
  if (st.knocks === 0) score += 1;
  if (!G.blackout) score += 2;
  if (st.camSec >= 25) score += 1;          // she actually looked
  /* and the thing the whole chapter is about: did she look after the
     four he left her? A night scored without this was scoring the
     wrong game. */
  if (woundCount() === 4) score += 2; else if (woundCount() >= 2) score += 1;
  const r = score >= 9 ? 0 : score >= 6 ? 1 : score >= 3 ? 2 : 3;
  return NS.ratings[r];
}

function awardBadges() {
  const got = [];
  const st = G.stats;
  /* the shelf is the record of the story. A custom night with every dial
     at nought is six quiet minutes, and it used to be worth three of
     these. */
  if (G.mode !== "story") return got;
  if (giveBadge("first")) got.push("first");
  /* CLOSING TIME says "finish every night", so it means every night —
     not just the last one reached from the night-select list */
  const done = nightsDone();
  let all = G.mode === "story";
  for (let i = 1; i <= NIGHTS.length && all; i++) if (!done[i]) all = false;
  if (all && giveBadge("story")) got.push("story");
  if (G.power <= 1.2 && giveBadge("onepc")) got.push("onepc");
  if (st.closes === 0 && giveBadge("nodoor")) got.push("nodoor");
  if (st.camSec < 20 && giveBadge("nocam")) got.push("nocam");
  if (woundCount() === 4 && giveBadge("kept")) got.push("kept");
  if (st.saves > 0 && giveBadge("held")) got.push("held");
  return got;
}

/* the shelf by the desk: one small thing for every night cleared and
   every badge earned, and that is the whole progress screen */
function syncTrophies() {
  const parts = officeParts;
  if (!parts || !parts.trophies) return;
  const d = nightsDone();
  let n = 0;
  for (let i = 1; i <= NIGHTS.length; i++) if (d[i]) n++;
  const b = badgesGot();
  NS.badges.forEach((x) => { if (b[x.id]) n++; });
  parts.trophies.forEach((t, i) => {
    const on = i < n;
    t.mesh.visible = on;
    if (t.shadow) t.shadow.visible = on;
  });
}

/* =========================================================
   19. WHAT THE FRAME DOES

   The only writes here are to lights, the two shutters, the needle, the
   lamps, the cast's joints and the camera. No prop, wall, shelf or
   fitting is touched by anything below this line.
   ========================================================= */
const _dir = new T.Vector3();
let panX = 0, panY = 0, panTX = 0, panTY = 0;

function applyLighting(dt) {
  /* the ceiling bulb in the office has been going for weeks */
  G.flickT -= dt;
  if (G.flickT <= 0) {
    const p = clamp(0.45 + decayK() * TUNE.decay.flicker, 0, 0.9) * (G.mode === "gallery" ? 0 : 1);
    G.flickT = G.flick < 0.7 ? range(Math.random, 0.04, 0.12) : range(Math.random, 0.6, 3.4);
    G.flick = G.flick < 0.7 ? range(Math.random, 0.85, 1.05) : (Math.random() < p ? range(Math.random, 0.15, 0.5) : 1);
  }
  const low = G.blackout ? 0.06 : 1;
  const warn = G.power < TUNE.power.critical && !G.blackout ? 0.55 + 0.45 * Math.sin(G.t * 9) : 1;
  /* the office bulb giving up on its own, from night four */
  const lampGone = G.lampOut > 0 ? 0.05 : 1;
  /* and the daylight gallery, which is the same rig turned up and warmed */
  const day = G.mode === "gallery";
  /* six o'clock on the last night: the office warms up and stops
     flickering, once, and stays that way while the card is on screen */
  const dawn = G.dawn ? 1 : 0;
  for (let i = 0; i < RIG_N; i++) {
    const l = rig[i];
    let k = low * warn;
    if (!dawn && (l.userData.tag === "pendant" || l.userData.tag === "desk")) k *= G.flick * lampGone;
    if (G.hallDark && /^strip/.test(l.userData.tag || "")) k *= 0.12;
    if (day) { k *= 3.4; l.color.set("#fff2dd"); }
    if (dawn) {
      k = 1.15;
      if (l.userData.tag === "window") { k = 3.6; l.color.set("#ffd0a0"); }
    }
    if (!day && !dawn && l.userData.baseColor) l.color.set(l.userData.baseColor);
    l.intensity = l.userData.base * k;
  }
  rigAmbient.intensity = rigAmbient.userData.base *
    (G.blackout ? 0.22 : day ? 11 : dawn ? 2.6 : 1 - clamp(decayK() * -TUNE.decay.ambient * 4, 0, 0.34));
  if (dawn) rigAmbient.color.set("#e8cfae");
  /* the gallery is the one time the shop is lit the way a shop is lit:
     warm, flat and from everywhere, with the fog switched off entirely */
  if (day) rigAmbient.color.set("#ffe7c6");
  else if (!dawn && rigAmbient.userData.baseColor) rigAmbient.color.set(rigAmbient.userData.baseColor);
  if (renderer) renderer.toneMappingExposure = day ? 1.5 : 1.05;
  /* the fog closes in as the night goes on, and lifts entirely in the
     gallery — the room itself is part of how frightening the room is */
  if (scene.fog && shownRoom && rooms[shownRoom]) {
    const f = rooms[shownRoom].fog;
    const k = day ? 0 : decayK();
    scene.fog.near = f.near * (1 + TUNE.decay.fogNear * clamp(k / 5, 0, 1)) * (day ? 3 : 1);
    scene.fog.far = f.far * (1 + TUNE.decay.fogFar * clamp(k / 5, 0, 1)) * (day ? 3.2 : 1);
  }
}

function animateOffice(dt) {
  if (!officeDoors) return;
  /* the two shutters and the hatch plate, and nothing else in the room */
  ["left", "right"].forEach((k) => {
    const d = officeDoors[k];
    const target = G.doors[k] ? d.closedY : d.openY;
    const sticky = k === "right" && hazard("stickyDoor") ? 0.44 : 1;
    const sp = (G.doors[k] ? 3.4 : 2.6) * dt * 2.2 * sticky;
    d.y += clamp(target - d.y, -sp, sp);
    d.mesh.position.y = d.y + (G.shake > 0 && Math.abs(d.y - d.closedY) < 0.05 ? Math.sin(G.t * 60) * G.shake * 0.012 : 0);
    d.mesh.updateMatrix();
  });
  const h = officeDoors.hatch;
  const ht = G.doors.hatch ? h.closedX : h.openX;
  h.x += clamp(ht - h.x, -dt * 1.9, dt * 1.9);
  h.mesh.position.x = h.x;
  h.mesh.updateMatrix();

  const parts = officeParts;
  if (!parts) return;
  /* the fan */
  if (parts.blades) { parts.blades.rotation.z -= dt * (G.blackout ? 0.6 : 11); parts.blades.updateMatrix(); }
  /* the needle: it settles towards the reading and overshoots a little,
     because a real moving-iron meter does */
  if (parts.needleHolder) {
    const n = parts.needleHolder.userData.needle;
    /* the dial's ticks were drawn with -a, so the needle turns the other
       way: at a full meter it has to point right, not left */
    const want = -(-1.05 + (G.power / 100) * 2.1);
    n.userData.v = (n.userData.v || 0) * 0.86 + (want - (n.rotation.z || 0)) * 0.34;
    n.rotation.z += n.userData.v;
    n.rotation.z += Math.sin(G.t * 17) * 0.004 * (G.drain / 2);
    n.updateMatrix();
  }
  /* the three lamps */
  if (parts.lampMeshes) {
    parts.lampMeshes.forEach((m) => {
      const k = m.userData.statusLamp;
      const on = G.doors[k];
      const c = G.blackout ? "#231a18" : on ? "#ff5a48" : "#2f6a3c";
      m.material = glow(c, 1);
    });
  }
  if (parts.usFrame) parts.usFrame.visible = G.mode === "gallery";
  /* her hands are on the desk while she is sitting at it, and nowhere
     else — not on the title card, not in the gallery */
  if (officeHands) {
    officeHands.group.visible = (G.phase === "play" || G.phase === "pause") && G.mode !== "gallery";
    if (officeHands.group.visible) {
      ["left", "right"].forEach((k) => {
        const h = officeHands.hands[k];
        if (!h) return;
        const want = G.doors[k] ? 0.03 : 0;
        h.userData.lift = (h.userData.lift || 0) + (want - (h.userData.lift || 0)) * Math.min(1, dt * 7);
        h.position.y = 0.004 + h.userData.lift + Math.sin(G.t * 0.7 + (k === "left" ? 0 : 2)) * 0.0016;
        h.rotation.x = -0.06 - h.userData.lift * 3.5;
      });
    }
  }
  /* the pendant's own bulb dims with the light it stands for */
  if (parts.pend) {
    parts.pend.traverse((o) => {
      if (o.userData.lamp && o.material) {
        o.material = glow(G.blackout ? "#2a2018" : (G.flick < 0.7 ? "#6a5a44" : "#ffe7bd"), 1);
      }
    });
    parts.pend.rotation.z = Math.sin(G.t * 0.8) * 0.012 + (G.shake > 0 ? Math.sin(G.t * 40) * G.shake * 0.05 : 0);
    parts.pend.updateMatrix();
  }
}

/* the seat is not bolted down: a slow drift, plus whatever the player
   is doing with the mouse or a thumb */
function moveView(dt) {
  const base = view.userData.base;
  if (!base) return;
  panX += (panTX - panX) * Math.min(1, dt * 5);
  panY += (panTY - panY) * Math.min(1, dt * 5);
  const idle = G.phase === "play" && !G.monitor;
  const drift = idle ? Math.sin(G.t * 0.31) * 0.012 : 0;
  const sh = G.shake > 0 ? G.shake : 0;
  view.quaternion.copy(base.quat);
  const e = new T.Euler(panY * 0.22 + Math.sin(G.t * 0.23) * 0.004 + (sh ? Math.sin(G.t * 47) * sh * 0.03 : 0),
                        panX * 0.34 + drift + (sh ? Math.sin(G.t * 39) * sh * 0.04 : 0), 0, "YXZ");
  const q = new T.Quaternion().setFromEuler(e);
  view.quaternion.multiply(q);
  view.position.copy(base.pos);
  if (sh) {
    view.position.x += Math.sin(G.t * 51) * sh * 0.02;
    view.position.y += Math.sin(G.t * 61) * sh * 0.02;
  }
  view.updateMatrixWorld(true);
}

let lastT = 0, raf = 0, fpsAcc = 0, fpsN = 0;

function frame(ts) {
  raf = requestAnimationFrame(frame);
  if (noWebGL) return;
  if (!lastT) lastT = ts;
  let dt = (ts - lastT) / 1000;
  lastT = ts;
  if (dt > 0.1) dt = 0.1;                 // a tab coming back must not skip a night
  G.t += dt;

  if (ARC.on) { arcadeStep(dt); }
  if (G.phase === "play") {
    stepEgg(dt);
    stepFind(dt);
    /* orientation holds the whole night still until she has done the
       thing it asked for: no clock, no drain, nobody walking. It is the
       one place in the chapter where the shop waits for her. */
    if (!tutorStep(dt)) {
      /* the shift is held, but the key still has to turn — orientation
         cannot teach a control it has also switched off */
      stepWind(dt);
      uiTick(dt); sayTick(dt); musicTick(dt);
    }
    else {
    stepClock(dt);
    if (G.phase === "play") {
      G.drain = powerRate();
      spendPower(G.drain * dt);
      G.stats.lowest = Math.min(G.stats.lowest, G.power);
      if (G.monitor && G.monOut <= 0) G.stats.camSec += dt;
      const shut = (G.doors.left ? 1 : 0) + (G.doors.right ? 1 : 0) + (G.doors.hatch ? 1 : 0);
      G.stats.doorSec += shut * dt;
      if (G.blackout) stepBlackout(dt);
      CAST.forEach((d) => stepCast(cast[d.id], dt));
      SOLD.forEach((d) => stepSold(cast[d.id], dt));
      stepSignal(dt);
      stepAlarms(dt);
      stepShifts(dt);
      stepHazards(dt);
      stepWind(dt);
      stageTheTurn(dt);
      /* the meter's own warnings, and the system reading them out */
      if (G.power < TUNE.power.critical && G.warned < 2) { G.warned = 2; SFX.beep(true); say(NS.sys.pwr10, true); }
      else if (G.power < TUNE.power.warn && G.warned < 1) { G.warned = 1; SFX.beep(false); say(NS.sys.pwr25); tapeTrigger("lowPower"); }
      audioTick(dt);
      sayTick(dt);
      /* after sayTick, so the building always has the right of way */
      tapeTick(dt);
      uiTick(dt);
    }
    }
  } else if (G.phase === "over") {
    G.deadT += dt;
    /* the card waits for the scare to land. A game over screen arriving
       on the same frame as the thing that caused it reads as a bug. */
    if (G.deadT > 1.15 && !G.cardT) { G.cardT = 1; screenOver(); }
  }

  if (G.phase === "gallery") { sayTick(dt); uiTick(dt); }
  /* the terms run on the wall clock, like the film, because they are a
     scene rather than part of the simulation */
  if (G.phase === "terms") termsTick(dt);
  musicTick(dt);
  G.shake = Math.max(0, G.shake - dt * 1.9);
  applyLighting(dt);
  animateOffice(dt);

  /* which room the one camera is looking at. During the opening the
     room comes from the film and the camera is placed by cineTick, so
     useView only ever sets its lights up. */
  const room = G.phase === "intro" ? CINE.room
             : G.mode === "gallery" ? G.cam
             : (G.phase === "play" && G.monitor) ? G.cam : "office";
  const camName = "main";
  if (room !== shownRoom || useView.__last !== room + camName) {
    showRoom(room);
    useView(room, camName);
    useView.__last = room + camName;
    panX = panY = panTX = panTY = 0;
  }
  /* after the lights are set for the room, but before anything is drawn:
     the film owns the camera while it is running */
  if (G.phase === "intro") cineTick(dt);
  syncCastVisibility();
  if (G.phase === "over" && G.killChar) G.killChar.group.visible = true;
  poseCast(dt, G.t);
  moveView(dt);

  /* the jumpscare pushes the figure at the lens */
  if (G.phase === "over" && G.killChar) {
    const ch = G.killChar;
    const k = Math.min(1, G.deadT * 6);
    _dir.set(0, 0, -1).applyQuaternion(view.userData.base.quat);
    ch.group.position.copy(view.userData.base.pos).addScaledVector(_dir, lerp(1.45, 0.66, k));
    ch.group.position.y = view.userData.base.pos.y - (ch.group.userData.eyeY || 1.5) + lerp(0.22, 0.06, k);
    ch.group.rotation.set(Math.sin(G.t * 30) * 0.05, Math.atan2(-_dir.x, -_dir.z) + Math.sin(G.t * 24) * 0.09, Math.sin(G.t * 27) * 0.06);
    ch.group.updateMatrix();
    G.shake = Math.max(G.shake, 0.8 - G.deadT * 0.5);
  }

  renderer.render(scene, view);
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 2) { G.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
}

/* =========================================================
   20. THE PANEL

   DOM over the canvas, the same way the racer and the platformer do it:
   pixel text drawn into a render buffer and blown up cannot be read, and
   this is a game about reading a number under pressure.

   It is meant to feel like the shop's own equipment — a brass-framed
   meter, a rec light, a plan of the building scratched onto a card —
   rather than a dashboard.
   ========================================================= */
const EL = {};
let uiReady = false, staticCtx = null, staticT = 0;

function el(id) { return document.getElementById(id); }

function buildUI() {
  if (uiReady) return;
  ["ns-stage", "ns-canvas", "ns-mon", "ns-static", "ns-camname", "ns-mon-lost",
   "ns-map", "ns-hud", "ns-power", "ns-bar-f", "ns-usage", "ns-clock", "ns-nightlab",
   "ns-warn", "ns-edge", "ns-pause-btn", "ns-pad", "ns-overlay", "ns-mon-time",
   "ns-say", "ns-egg", "ns-find", "ns-tutor", "ns-cine", "ns-key",
   "ns-tape"].forEach((id) => {
    EL[id] = el(id);
  });
  stageEl = EL["ns-stage"];

  /* the plan of the shop, built from the room list so adding a room
     adds a cell */
  const map = EL["ns-map"];
  if (map) {
    map.innerHTML = "";
    MAP_PLAN.forEach((m) => {
      const r = ROOM[m.id];
      if (!r) return;
      const b = document.createElement("button");
      b.className = "ns-cell";
      b.dataset.room = m.id;
      b.style.left = m.x + "%"; b.style.top = m.y + "%";
      b.style.width = m.w + "%"; b.style.height = m.h + "%";
      b.innerHTML = '<b>' + (r.cam < 10 ? "0" + r.cam : r.cam) + '</b><i>' + r.name + '</i><u></u>';
      b.addEventListener("click", (e) => { e.stopPropagation(); selectCam(m.id); });
      map.appendChild(b);
    });
    /* the office, marked but not selectable — it is where you are */
    const you = document.createElement("span");
    you.className = "ns-you";
    you.innerHTML = "<i>YOU</i>";
    map.appendChild(you);
  }

  if (EL["ns-static"]) {
    EL["ns-static"].width = 176; EL["ns-static"].height = 99;
    staticCtx = EL["ns-static"].getContext("2d");
  }

  /* The buttons answer to pointerdown so a thumb gets the door moving on
     the way down rather than on the way up, and to click as well so a
     keyboard or an assistive device can work them. The guard is what
     stops the pair of them counting as two presses. */
  if (EL["ns-pad"]) {
    EL["ns-pad"].querySelectorAll("[data-k]").forEach((b) => {
      const k = b.dataset.k;
      const go = (e) => {
        e.preventDefault(); e.stopPropagation();
        const t = (window.performance ? performance.now() : Date.now());
        if (t - (b.__wkT || 0) < 320) return;
        b.__wkT = t;
        press(k);
      };
      b.addEventListener("pointerdown", go);
      b.addEventListener("click", go);
    });
  }
  if (EL["ns-pause-btn"]) EL["ns-pause-btn"].addEventListener("click", () => togglePause());
  if (EL["ns-egg"]) {
    EL["ns-egg"].addEventListener("click", (e) => { e.stopPropagation(); arcadeOpen(); });
  }
  if (EL["ns-find"]) {
    EL["ns-find"].addEventListener("click", (e) => { e.stopPropagation(); takeFind(); });
  }
  /* the key is held rather than clicked — winding something is a thing
     you do for a second and a bit, not a thing you tap */
  if (EL["ns-key"]) {
    const k = EL["ns-key"];
    k.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); windStart(); });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
      k.addEventListener(ev, (e) => { e.stopPropagation(); windEnd(); }));
  }

  uiReady = true;
}

/* --- the overlay cards -------------------------------------------- */
function overlay(html, cls) {
  const o = EL["ns-overlay"];
  if (!o) return;
  o.className = "ns-overlay on " + (cls || "");
  o.innerHTML = html;
  o.setAttribute("aria-hidden", "false");
  o.querySelectorAll("[data-go]").forEach((b) => {
    b.addEventListener("click", (e) => { e.stopPropagation(); route(b.dataset.go); });
  });
}
function noOverlay() {
  const o = EL["ns-overlay"];
  if (!o) return;
  o.className = "ns-overlay";
  o.innerHTML = "";
  o.setAttribute("aria-hidden", "true");
}

function nightsDone() {
  try { return JSON.parse(localStorage.getItem("ns_nights") || "{}") || {}; }
  catch (e) { return {}; }
}
function maxUnlocked() {
  const d = nightsDone();
  let n = 1;
  for (let i = 1; i <= NIGHTS.length; i++) if (d[i]) n = Math.min(NIGHTS.length, i + 1);
  return n;
}
function storyDone() { return !!nightsDone()[NIGHTS.length]; }

const NOTUTOR_KEY = "ns_notutor";
function loadNoTutor() {
  try { return localStorage.getItem(NOTUTOR_KEY) === "1"; } catch (e) { return false; }
}
function saveNoTutor(v) { try { localStorage.setItem(NOTUTOR_KEY, v ? "1" : "0"); } catch (e) {} }

const COZY_KEY = "ns_cozy";
function loadCozy() {
  try { return localStorage.getItem(COZY_KEY) === "1"; } catch (e) { return false; }
}
function saveCozy(v) { try { localStorage.setItem(COZY_KEY, v ? "1" : "0"); } catch (e) {} }

function screenTitle() {
  const un = maxUnlocked();
  const done = nightsDone();
  const sel = NIGHTS.slice(0, un).map((n) =>
    '<button class="ns-btn ns-btn-sm' + (done[n.n] ? " ns-done" : "") + '" data-go="night:' + n.n + '">' + n.n + '</button>').join("");
  const extra = storyDone()
    ? '<div class="ns-btns ns-btns-extra">' +
        '<button class="ns-btn" data-go="custom">CUSTOM NIGHT</button>' +
        '<button class="ns-btn" data-go="gallery">THE SHOP IN DAYLIGHT</button>' +
      '</div>'
    : "";
  overlay(
    '<div class="ns-card ns-card-title">' +
      '<p class="ns-sign"><span>' + NS.title + '</span><b>' + NS.title2 + '</b></p>' +
      '<p class="ns-where">' + NS.shop + ' ' + NS.sub + '</p>' +
      '<p class="ns-tag">' + NS.tag + '</p>' +
      '<div class="ns-btns">' +
        '<button class="ns-btn ns-btn-go" data-go="start">BEGIN THE SHIFT</button>' +
        '<button class="ns-btn" data-go="howto">HOW IT WORKS</button>' +
        /* his statement, once she has already heard it once */
        (seenIntro() ? '<button class="ns-btn" data-go="intro">HIS STATEMENT</button>' : "") +
        '<button class="ns-btn" data-go="badges">RECORD</button>' +
        '<button class="ns-btn" data-go="quit">LEAVE</button>' +
      '</div>' +
      extra +
      '<p class="ns-pick">NIGHT ' + sel + '</p>' +
      '<button class="ns-cozy' + (G.cozy ? " on" : "") + '" data-go="cozy">' +
        '<i></i><b>COZY MODE</b><span>' + (G.cozy ? "on — softer everything" : "off — the shop as it is") + '</span></button>' +
    '</div>', "ns-ov-title");
}

function screenHowTo() {
  const rows = NS.howTo.map((r) => '<li><b>' + r[0] + '</b><span>' + r[1] + '</span></li>').join("");
  const who = CAST.map((c) =>
    '<li class="ns-who"><span class="ns-swatch" style="--c:' + c.colour + '"></span>' +
    '<b>' + c.name + '</b><i>' + c.what + '</i><span>' + c.threat + '</span>' +
    '<em>' + c.tell + '</em></li>').join("");
  overlay(
    '<div class="ns-card ns-card-wide">' +
      '<h3>HOW IT WORKS</h3>' +
      '<ul class="ns-rules">' + rows + '</ul>' +
      '<h3>WHO ELSE IS IN</h3>' +
      '<ul class="ns-cast">' + who + '</ul>' +
      '<p class="ns-keys">Keys: <b>A</b>/<b>&larr;</b> left door &middot; <b>D</b>/<b>&rarr;</b> right door &middot; ' +
      '<b>W</b>/<b>&uarr;</b> hatch &middot; <b>SPACE</b> cameras &middot; <b>1&ndash;8</b> pick a camera &middot; <b>ESC</b> pause</p>' +
      '<div class="ns-btns"><button class="ns-btn ns-btn-go" data-go="title">BACK</button></div>' +
    '</div>', "ns-ov-howto");
}

/* Night one is a card she finds on the desk; every night after it is
   whatever paper turned up that day. Nobody says any of it out loud. */
function screenBrief() {
  musicMode("brief");
  const cfg = G.cfg;
  let body = "";
  if (G.night === 1) {
    const c = NS.shiftCard;
    body = '<p class="ns-from">' + c.title + '</p>' +
      '<div class="ns-paper">' + c.lines.map((l, i) =>
        '<p' + (i === 0 ? ' class="ns-paper-head"' : '') + '>' + l + '</p>').join("") + '</div>' +
      '<p class="ns-pencil">' + c.pencil + '</p>';
  } else {
    const beat = NS.beats[G.night];
    if (beat) {
      body = '<p class="ns-from">' + beat.title + '</p><div class="ns-lines">' +
        beat.lines.map((l) => "<p>" + l + "</p>").join("") + "</div>";
    }
  }
  const rule = cfg.hazards.length ? HAZARDS[cfg.hazards[cfg.hazards.length - 1]] : null;
  overlay(
    '<div class="ns-card ns-card-brief">' +
      '<p class="ns-nightno">' + cfg.name + '</p>' +
      '<p class="ns-blurb">' + cfg.blurb + '</p>' +
      (NS.why[G.night] ? '<p class="ns-why">' + NS.why[G.night] + '</p>' : "") +
      body +
      (rule && G.night > 1 ? '<p class="ns-rule">' + rule + '</p>' : "") +
      '<div class="ns-btns"><button class="ns-btn ns-btn-go" data-go="go">12:00 AM</button>' +
      '<button class="ns-btn" data-go="title">BACK</button></div>' +
    '</div>', "ns-ov-brief");
}

function screenPause() {
  overlay(
    '<div class="ns-card">' +
      '<h3>PAUSED</h3>' +
      '<p class="ns-blurb">The shop waits.</p>' +
      '<div class="ns-btns">' +
        '<button class="ns-btn ns-btn-go" data-go="resume">BACK TO IT</button>' +
        '<button class="ns-btn" data-go="restart">RESTART NIGHT</button>' +
        '<button class="ns-btn" data-go="title">TITLE</button>' +
        '<button class="ns-btn" data-go="quit">LEAVE</button>' +
      '</div>' +
    '</div>', "ns-ov-pause");
}

function screenOver() {
  /* the score comes back after the scare, not through it: what is left
     is a low ring and the box winding down two octaves under itself */
  musicMode("gone");
  const c = BY_ID[G.dead] || CAST[0];
  /* He asked for six nights without anything reaching her, so when
     something does, he is the one who says so — a line from him beats
     a scoreboard, and it keeps her going again rather than stopping. */
  const his = G.mode === "story"
    ? (G.brokeNow ? NS.caught.first : NS.caught.later) : "";
  if (his) setTimeout(() => { if (G.phase === "over") voxSpeak(voxPlan(his), { gain: 0.95 }); }, 950);
  overlay(
    '<div class="ns-card ns-card-over">' +
      '<p class="ns-got" style="--c:' + c.colour + '">' + c.name + '</p>' +
      '<p class="ns-blurb">reached the office &middot; ' + G.cfg.name.toLowerCase() + ' &middot; ' + clockLabel() + '</p>' +
      '<p class="ns-lines"><i>' + c.threat + '</i></p>' +
      (his ? '<p class="ns-kept">' + his + '</p>' : "") +
      '<div class="ns-btns">' +
        '<button class="ns-btn ns-btn-go" data-go="restart">TRY THE NIGHT AGAIN</button>' +
        '<button class="ns-btn" data-go="title">TITLE</button>' +
      '</div>' +
    '</div>', "ns-ov-over");
}

/* what the night was actually like, out of numbers it was keeping anyway */
function ratingCard() {
  const r = G.rating || NS.ratings[1];
  const st = G.stats;
  const rows = [
    ["POWER LEFT", Math.max(0, Math.round(G.power)) + "%"],
    ["LOWEST IT GOT", Math.max(0, Math.round(st.lowest)) + "%"],
    ["AT THE DOOR", st.arrivals],
    ["DOORS HELD", Math.round(st.doorSec) + "s"],
    ["ON CAMERA", Math.round(st.camSec) + "s"],
    ["KNOCKS PAID FOR", st.knocks],
  ].map((x) => '<li><b>' + x[0] + '</b><i>' + x[1] + '</i></li>').join("");
  const newB = (G.newBadges || []).map((id) => {
    const b = NS.badges.filter((x) => x.id === id)[0];
    return b ? '<li>' + b.name + '</li>' : "";
  }).join("");
  return '<p class="ns-rating ns-rating-' + r.key + '">' + r.name + '</p>' +
         '<p class="ns-blurb">' + r.note + '</p>' +
         '<ul class="ns-stats">' + rows + '</ul>' +
         (newB ? '<p class="ns-from">NEW</p><ul class="ns-newbadge">' + newB + '</ul>' : "");
}

function screenShift() {
  const last = G.mode === "story" && G.night >= NIGHTS.length;
  if (last) {
    /* six nights of reading somebody else's paper, and then one thing
       that is hers to decide. It is the only choice in the chapter and
       it is deliberately the last one. */
    G.phase = "finale";
    /* the last page is his signature and the ending is meaningless
       without it, so night six hands it over before it asks her
       anything. And the last night answers the terms he set on the
       way in: six nights, and whether anything got to her. */
    const lastPage = handOverMissed();
    overlay(
      '<div class="ns-card ns-card-fin">' +
        '<p class="ns-nightno">' + NS.finale.title + '</p>' +
        '<p class="ns-kept">' + (wasHurt() ? NS.kept.hurt : NS.kept.clean) + '</p>' +
        (lastPage ? '<div class="ns-gave">' +
             '<p class="ns-from">' + NS.gave + '</p>' +
             '<div class="ns-paper">' +
               '<p class="ns-paper-head">' + lastPage.title + '</p>' +
               lastPage.lines.map((l) => "<p>" + l + "</p>").join("") +
             '</div>' +
             '<p class="ns-pencil">' + lastPage.back + '</p>' +
           '</div>' : "") +
        '<div class="ns-lines">' + NS.finale.lines.map((l) => "<p>" + l + "</p>").join("") + '</div>' +
        '<p class="ns-ask">' + NS.ending.ask + '</p>' +
        '<div class="ns-btns">' +
          '<button class="ns-btn ns-btn-go" data-go="endWind">' + NS.ending.wind.label + '</button>' +
          '<button class="ns-btn ns-btn-go" data-go="endLeave">' + NS.ending.leave.label + '</button>' +
        '</div>' +
      '</div>', "ns-ov-fin");
    return;
  }
  const next = G.mode === "custom"
    ? '<button class="ns-btn ns-btn-go" data-go="custom">CHANGE THE DIALS</button>'
    : '<button class="ns-btn ns-btn-go" data-go="next">NIGHT ' + (G.night + 1) + '</button>';
  /* the last line of a night is not a score. It is a door left open —
     and if she walked past the thing hidden in the shop tonight, it says
     so, because that is the sentence that makes her go back in. */
  /* the ones he needed her to read, handed over rather than lost */
  const given = G.mode === "story" ? handOverMissed() : null;
  const missed = !given && G.mode === "story" && tonightsFind() ? NS.missed : "";
  const hook = G.mode === "story" ? (NS.hooks[G.night] || "") : "";
  overlay(
    '<div class="ns-card ns-card-win">' +
      '<p class="ns-six">6:00 AM</p>' +
      '<p class="ns-blurb">' + G.cfg.name.toLowerCase() + ', survived.</p>' +
      ratingCard() +
      (given ? '<div class="ns-gave">' +
                 '<p class="ns-from">' + NS.gave + '</p>' +
                 '<div class="ns-paper">' +
                   '<p class="ns-paper-head">' + given.title + '</p>' +
                   given.lines.map((l) => "<p>" + l + "</p>").join("") +
                 '</div>' +
                 '<p class="ns-pencil">' + given.back + '</p>' +
               '</div>' : "") +
      (missed ? '<p class="ns-missed">' + missed + '</p>' : "") +
      (hook ? '<p class="ns-hook">' + hook + '</p>' : "") +
      '<div class="ns-btns">' + next +
        '<button class="ns-btn" data-go="title">TITLE</button>' +
      '</div>' +
    '</div>', "ns-ov-win");
}

/* THE TWO PAGES THAT ARE NOT ALLOWED TO BE MISSED.

   Four of the six are a reward for looking, and missing one is a good
   reason to go back in — that is what the "you walked past something"
   line is for. But the ledger and the last page are not flavour: they
   are the confession and the signature, and a story whose ending is
   optional does not have an ending. If she gets to six without them,
   the shop puts them in her hand. He wanted her to know. */
const MUST_FIND = { ledger: 1, last: 1 };
function handOverMissed() {
  const f = tonightsFind();
  if (!f || !MUST_FIND[f.id]) return null;
  keepFind(f.id);
  G.stats.finds++;
  return f;
}

/* is tonight's page still out there? (null once she has it) */
function tonightsFind() {
  const f = NS.finds.filter((x) => x.on === G.night)[0];
  if (!f) return null;
  return foundAll()[f.id] ? null : f;
}

/* and the two ways the story is allowed to end */
function screenEnding(which) {
  const e = NS.ending[which];
  G.phase = "finale";
  if (which === "wind") SFX.tuneWhole(0.8);
  overlay(
    '<div class="ns-card ns-card-fin">' +
      '<p class="ns-nightno">' + (which === "wind" ? "SHE WINDS IT" : "SHE LEAVES IT") + '</p>' +
      '<div class="ns-lines">' + e.lines.map((l) => "<p>" + l + "</p>").join("") + '</div>' +
      '<div class="ns-btns">' +
        '<button class="ns-btn ns-btn-go" data-go="galleryOffer">THE SHOP IN DAYLIGHT</button>' +
        '<button class="ns-btn" data-go="title">TITLE</button>' +
        '<button class="ns-btn" data-go="quit">CLOCK OFF</button>' +
      '</div>' +
    '</div>', "ns-ov-fin");
}

/* --- Custom Night ----------------------------------------------------
   Four dials, nought to twenty. Ten is the pace the story runs at, so
   twenty is twice it and nought is asleep. Everything else about the
   shop is unchanged, which is the point: it is the whole of the rest of
   the game's life for the cost of four numbers. */
function screenCustom() {
  const d = customDials();
  const rows = CAST.map((c) =>
    '<li class="ns-dial" data-id="' + c.id + '">' +
      '<span class="ns-swatch" style="--c:' + c.colour + '"></span>' +
      '<b>' + c.name + '</b>' +
      '<button class="ns-step" data-dial="' + c.id + ':-1" aria-label="less">&#8722;</button>' +
      '<input type="range" min="0" max="20" step="1" value="' + d[c.id] + '" data-dial-range="' + c.id + '" aria-label="' + c.name + ' aggression">' +
      '<button class="ns-step" data-dial="' + c.id + ':1" aria-label="more">+</button>' +
      '<i data-dial-val="' + c.id + '">' + d[c.id] + '</i>' +
    '</li>').join("");
  overlay(
    '<div class="ns-card ns-card-wide">' +
      '<h3>CUSTOM NIGHT</h3>' +
      '<p class="ns-blurb">Ten is the pace the story runs at. Twenty is twice it. Nought is asleep.</p>' +
      '<ul class="ns-dials">' + rows + '</ul>' +
      '<div class="ns-btns">' +
        '<button class="ns-btn ns-btn-go" data-go="customGo">RUN IT</button>' +
        '<button class="ns-btn" data-go="preset:5">EVEN</button>' +
        '<button class="ns-btn" data-go="preset:20">ALL TWENTY</button>' +
        '<button class="ns-btn" data-go="title">BACK</button>' +
      '</div>' +
    '</div>', "ns-ov-custom");
  wireDials();
}

function wireDials() {
  const o = EL["ns-overlay"];
  if (!o) return;
  const set = (id, v) => {
    const d = customDials();
    d[id] = clamp(v | 0, 0, 20);
    saveDials(d);
    const r = o.querySelector('[data-dial-range="' + id + '"]');
    const t = o.querySelector('[data-dial-val="' + id + '"]');
    if (r) r.value = d[id];
    if (t) t.textContent = d[id];
    SFX.beep(d[id] > 10);
  };
  o.querySelectorAll("[data-dial]").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const [id, dv] = b.dataset.dial.split(":");
      set(id, customDials()[id] + parseInt(dv, 10));
    });
  });
  o.querySelectorAll("[data-dial-range]").forEach((r) => {
    r.addEventListener("input", (e) => { e.stopPropagation(); set(r.dataset.dialRange, +r.value); });
  });
}

/* --- the record ------------------------------------------------------ */
function screenBadges() {
  const got = badgesGot();
  const d = nightsDone();
  const nights = NIGHTS.map((n) =>
    '<li class="' + (d[n.n] ? "on" : "") + '"><b>' + n.n + '</b><span>' + n.name + '</span></li>').join("");
  const rows = NS.badges.map((b) =>
    '<li class="' + (got[b.id] ? "on" : "") + '"><b>' + b.name + '</b><span>' + b.note + '</span></li>').join("");
  overlay(
    '<div class="ns-card ns-card-wide">' +
      '<h3>THE RECORD</h3>' +
      '<ul class="ns-nights">' + nights + '</ul>' +
      '<ul class="ns-badges">' + rows + '</ul>' +
      '<p class="ns-keys">Every one of these puts something on the shelf by the desk.</p>' +
      '<div class="ns-btns"><button class="ns-btn ns-btn-go" data-go="title">BACK</button></div>' +
    '</div>', "ns-ov-badges");
}

/* --- the shop in daylight -------------------------------------------- */
function screenGallery() {
  const rows = ROOMS.map((r) =>
    '<button class="ns-groom' + (r.id === G.cam ? " on" : "") + '" data-room="' + r.id + '">' +
      '<b>' + (r.cam ? (r.cam < 10 ? "0" + r.cam : r.cam) : "—") + '</b><span>' + r.name + '</span></button>').join("");
  overlay(
    '<div class="ns-gal">' +
      '<p class="ns-gal-title">THE SHOP IN DAYLIGHT</p>' +
      '<p class="ns-gal-note">Nothing is running. Nothing is going to move.</p>' +
      '<div class="ns-grooms">' + rows + '</div>' +
      '<div class="ns-btns"><button class="ns-btn ns-btn-go" data-go="title">BACK</button></div>' +
    '</div>', "ns-ov-gal");
  const o = EL["ns-overlay"];
  if (o) o.querySelectorAll("[data-room]").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      G.cam = b.dataset.room;
      SFX.camSwitch();
      o.querySelectorAll("[data-room]").forEach((x) => x.classList.toggle("on", x === b));
    });
  });
}

/* --- where every button goes -------------------------------------- */
function route(cmd) {
  audioWake();
  if (cmd === "start") {
    /* the very first time, the shop introduces itself before she is
       ever asked to survive it */
    if (!seenIntro() && !nightsDone()[1]) { cineStart(); return; }
    G.mode = "story"; G.night = maxUnlocked(); G.cfg = nightCfg(G.night); G.phase = "brief"; screenBrief();
  }
  else if (cmd === "howto") { G.phase = "howto"; screenHowTo(); }
  else if (cmd === "badges") { G.phase = "badges"; screenBadges(); }
  else if (cmd === "title") {
    G.phase = "title"; G.mode = "story"; G.dawn = false;
    CAST.forEach((d) => { cast[d.id].asleep = false; });
    sayClear();
    if (stageEl) delete stageEl.dataset.day;
    bedStop(); musicMode("menu"); screenTitle(); showHud(false);
    if (officeParts && officeParts.glass && TX.night) {
      officeParts.glass.material = new T.MeshBasicMaterial({ map: TX.night, fog: true });
    }
    syncTrophies();
  }
  else if (cmd === "go") { beginNight(G.night); }
  else if (cmd === "resume") { G.phase = "play"; noOverlay(); showHud(true); bedStart(); musicMode("night"); }
  else if (cmd === "restart") { beginNight(G.night, { mode: G.mode }); }
  else if (cmd === "next") { beginNight(Math.min(NIGHTS.length, G.night + 1)); }
  else if (cmd === "quit") { if (window.leaveNightShift) window.leaveNightShift(); }
  else if (cmd === "cozy") { G.cozy = !G.cozy; saveCozy(G.cozy); SFX.beep(!G.cozy); screenTitle(); }
  else if (cmd === "custom") { G.phase = "custom"; screenCustom(); }
  else if (cmd === "customGo") { beginNight(0, { mode: "custom" }); }
  else if (cmd === "gallery" || cmd === "galleryOffer") { beginGallery(); }
  else if (cmd === "arcadeOut") { arcadeClose(); }
  else if (cmd === "findOut") { closeFind(); }
  else if (cmd === "heldOut") { closeHeld(); }
  else if (cmd === "intro") { cineStart(); }
  else if (cmd === "introDone") { cineStop(true); }
  else if (cmd === "terms") { termsStart(); }
  else if (cmd === "termsDone") { termsDone(); }
  else if (cmd === "termsAgain") { clearHurt(); termsStart(); }
  else if (cmd === "endWind") { screenEnding("wind"); }
  else if (cmd === "endLeave") { screenEnding("leave"); }
  else if (cmd.indexOf("preset:") === 0) {
    const v = parseInt(cmd.slice(7), 10) || 0;
    const d = {}; CAST.forEach((c) => { d[c.id] = v; });
    saveDials(d); screenCustom();
  }
  else if (cmd.indexOf("night:") === 0) {
    G.mode = "story";
    G.night = clamp(parseInt(cmd.slice(6), 10) || 1, 1, NIGHTS.length);
    G.cfg = nightCfg(G.night);
    G.phase = "brief"; screenBrief();
  }
}

function beginNight(n, opts) {
  opts = opts || {};
  G.mode = opts.mode || "story";
  if (G.mode === "custom") {
    G.cfg = customCfg(customDials());
    G.night = 0;
  } else {
    G.night = clamp(n, 1, NIGHTS.length);
    G.cfg = nightCfg(G.night);
  }
  G.dawn = false;
  STAGED.done = false;
  G.brokeNow = false;
  G.rating = null;
  G.newBadges = [];
  G.hour = 0; G.hourT = 0;
  G.power = G.cfg.power;
  G.drain = 0;
  G.monitor = false;
  G.cam = "hall";
  G.doors.left = G.doors.right = G.doors.hatch = false;
  G.blackout = false; G.blackoutT = 0; G.approaching = null;
  G.dead = null; G.deadT = 0; G.killChar = null; G.cardT = 0;
  G.warned = 0; G.shake = 0;
  G.lost = {}; G.lostT = 20;
  G.hallDark = hazard("hallDark");
  G.lampOut = 0; G.lampT = range(Math.random, 30, 60);
  G.monOut = 0; G.monT = range(Math.random, 30, 60);
  G.surgeT = range(Math.random, 40, 70);
  G.alarmT = nextIn(TUNE.alarm.firstAt);
  G.shiftT = nextIn(TUNE.shift.firstAt);
  G.caption = ""; G.captionT = 0;
  sayQueue = []; sayUntil = 0;
  G.stats = { doorSec: 0, camSec: 0, knocks: 0, arrivals: 0, closes: 0, surges: 0, shifts: 0, alarms: 0, moves: 0, finds: 0, winds: 0, slack: 0, returns: 0, saves: 0, lowest: 100 };
  resetCast();
  /* he wound them the night he stopped coming in. She inherits that,
     and it runs out about two thirds of the way through her first. */
  CAST.forEach((d) => { cast[d.id].wound = WIND.hours * 0.62; });
  resetSold();
  G.winding = null; G.windTarget = null; G.windT = 0;
  resetShifties();
  armFind();
  syncTrophies();
  /* orientation: only on night one, only in the story, and only while
     night one is still unfinished */
  if (G.mode === "story" && G.night === 1 && !nightsDone()[1] && !loadNoTutor()) tutorStart();
  else tutorOff();
  if (officeParts && officeParts.glass && TX.night) {
    officeParts.glass.material = new T.MeshBasicMaterial({ map: TX.night, fog: true });
  }
  if (officeDoors) {
    officeDoors.left.y = officeDoors.left.openY;
    officeDoors.right.y = officeDoors.right.openY;
    officeDoors.hatch.x = officeDoors.hatch.openX;
  }
  G.phase = "play";
  noOverlay();
  showHud(true);
  bedStart();
  musicMode("night");
  tapeReset();
  say(NS.sys.boot);
  if (G.cozy) say(NS.sys.cozy);
  if (hazard("stickyDoor")) say(NS.sys.doorFault);
  bumpUI();
}

/* --- the shop in daylight -------------------------------------------
   Unlocked once the story is done. Nothing is running: no clock, no
   meter, no cast, no fog, and the rig turned up and warmed over. Same
   nine rooms, walked at her own pace. It is also the only place the
   photograph of the two of them hangs, because it is the one part of
   this chapter where nothing is ever going to move. */
function beginGallery() {
  musicMode("gallery");
  G.mode = "gallery";
  G.phase = "gallery";
  sayClear();
  /* the vignette that keeps the corners of the office dark is the wrong
     idea entirely in a shop at eleven in the morning */
  if (stageEl) stageEl.dataset.day = "1";
  G.dawn = false;
  G.cam = "hall";
  G.monitor = false;
  G.doors.left = G.doors.right = G.doors.hatch = false;
  G.blackout = false;
  G.dead = null; G.killChar = null;
  CAST.forEach((d) => { cast[d.id].awake = false; cast[d.id].asleep = true; });
  resetShifties();
  syncTrophies();
  noOverlay();
  showHud(false);
  bedStop();
  screenGallery();
  bumpUI();
}

function showHud(on) {
  if (EL["ns-hud"]) EL["ns-hud"].hidden = !on;
  if (EL["ns-pad"]) EL["ns-pad"].hidden = !on;
  if (EL["ns-pause-btn"]) EL["ns-pause-btn"].hidden = !on;
  if (!on && EL["ns-mon"]) EL["ns-mon"].hidden = true;
}

function clockLabel() {
  if (G.hour >= 6) return "6 AM";
  const h = clamp(G.hour, 0, 5);
  return (h === 0 ? "12" : String(h)) + " AM";
}

/* --- what changes only when something happens --------------------- */
function bumpUI() {
  if (!uiReady) return;
  if (EL["ns-clock"]) EL["ns-clock"].textContent = clockLabel();
  if (EL["ns-nightlab"]) EL["ns-nightlab"].textContent = "NIGHT " + G.night;
  if (EL["ns-mon"]) EL["ns-mon"].hidden = !(G.phase === "play" && G.monitor);
  if (EL["ns-mon"]) EL["ns-mon"].dataset.drop = G.monOut > 0 ? "1" : "0";
  const r = ROOM[G.cam];
  if (EL["ns-camname"] && r) EL["ns-camname"].textContent = "CAM " + (r.cam < 10 ? "0" + r.cam : r.cam) + " — " + r.name;
  if (EL["ns-mon-lost"]) {
    const down = G.monOut > 0;
    EL["ns-mon-lost"].hidden = !(isLost(G.cam) || down);
    EL["ns-mon-lost"].textContent = down ? "FEED INTERRUPTED" : "SIGNAL LOST";
  }
  if (EL["ns-map"]) {
    EL["ns-map"].querySelectorAll(".ns-cell").forEach((b) => {
      const id = b.dataset.room;
      b.classList.toggle("on", id === G.cam);
      b.classList.toggle("dead", isLost(id));
      let n = 0;
      for (const k in cast) if (cast[k].awake && cast[k].room === id) n++;
      b.classList.toggle("busy", n > 0 && id === G.cam);
    });
  }
  if (G.phase === "over") screenOver();
  else if (G.phase === "shift") screenShift();
  /* the touch buttons show their own state, so a thumb can read them */
  if (EL["ns-pad"]) {
    EL["ns-pad"].dataset.mon = G.monitor ? "1" : "0";
    EL["ns-pad"].querySelectorAll("[data-k]").forEach((b) => {
      const k = b.dataset.k;
      if (k === "monitor") b.classList.toggle("on", G.monitor);
      else if (k === "prev" || k === "next") b.classList.remove("on");
      else b.classList.toggle("on", !!G.doors[k]);
      b.classList.toggle("dead", G.blackout);
    });
  }
}

/* --- and what changes every frame --------------------------------- */
function uiTick(dt) {
  if (!uiReady) return;
  const p = Math.max(0, Math.round(G.power));
  if (EL["ns-power"]) EL["ns-power"].textContent = p + "%";
  if (EL["ns-bar-f"]) {
    EL["ns-bar-f"].style.width = clamp(G.power, 0, 100) + "%";
    EL["ns-bar-f"].dataset.lvl = G.power < TUNE.power.critical ? "3" : G.power < TUNE.power.warn ? "2" : "1";
  }
  if (EL["ns-usage"]) {
    const bars = clamp(Math.round(G.drain / 0.62), 1, 5);
    EL["ns-usage"].textContent = "▉".repeat(bars) + "░".repeat(5 - bars);
  }
  /* the edge of the screen warms when something is next to the office */
  let near = null;
  for (const k in cast) {
    const ch = cast[k];
    if (ch.awake && ch.atDoor) { near = ch; break; }
  }
  if (EL["ns-edge"]) {
    EL["ns-edge"].dataset.side = near ? near.def.door : "";
    EL["ns-edge"].style.setProperty("--c", near ? near.def.colour : "transparent");
    EL["ns-edge"].style.opacity = near ? (0.5 + 0.5 * Math.sin(G.t * 5)) : 0;
  }
  if (EL["ns-warn"]) {
    let msg = "";
    if (G.blackout) msg = G.approaching ? "" : "POWER OUT";
    else if (G.power < TUNE.power.critical) msg = "POWER CRITICAL";
    EL["ns-warn"].textContent = msg;
    EL["ns-warn"].hidden = !msg;
  }
  if (EL["ns-mon-time"]) EL["ns-mon-time"].textContent = clockLabel();
  eggHotspot();
  findHotspot();
  windHotspot();

  /* the annunciator's caption. A vocoder cannot be understood and is not
     meant to be — the words are here. */
  if (G.captionT > 0) G.captionT -= dt;
  if (EL["ns-say"]) {
    /* the system only talks during a shift. On any card — pause, over,
       dawn, the gallery — the strip is gone, not fading. */
    /* and never during orientation, which has its own box saying its own
       words — the two of them stacked on top of each other read as a bug */
    const on = G.captionT > 0 && !!G.caption && !tutorOn() &&
               (G.phase === "play" || G.phase === "pause");
    EL["ns-say"].hidden = !on;
    if (on) EL["ns-say"].textContent = G.caption;
  }

  /* the static: a real noise field, redrawn a few times a second, so a
     dead camera looks dead rather than grey */
  if (staticCtx && G.monitor) {
    staticT -= dt;
    if (staticT <= 0) {
      staticT = 0.05;
      const w = 176, h = 99;
      const img = staticCtx.createImageData(w, h);
      const d = img.data;
      const heavy = isLost(G.cam) || G.monOut > 0;
      /* a dead camera is nearly all noise; a live one has a little in it,
         because a live one on this system always has a little in it */
      if (EL["ns-static"]) EL["ns-static"].style.opacity = heavy ? 0.94 : 0.5;
      const amt = heavy ? 210 : 34 + decayK() * TUNE.decay.static * 260;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * amt) | 0;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = heavy ? 190 + ((Math.random() * 60) | 0) : 26 + ((Math.random() * 30) | 0);
      }
      staticCtx.putImageData(img, 0, 0);
    }
  }
}

/* =========================================================
   20e. WINDING

   The note he left her says wind the four in the back room every
   night, and for six nights that was flavour text. It is the mechanic
   now, and it is the mechanic the whole story turns on.

   Each of the four carries a key. Find it on a camera, hold it, and
   that one is wound for the night: it keeps its own shape, it goes
   back to its place at six, and it is hers.

   Leave one unwound and it runs down. A run-down one does not stop
   being dangerous — it stops being *his*. It goes quiet, it stops
   answering to the rules its tag describes, and on the nights when
   something is already coming in the front door, a slack toy is one
   more thing in the building with nobody driving it.

   So the instruction in his note is the difficulty setting, the
   collectible and the theme at the same time: she is being asked,
   every night, to look after the four things he made out of her.
   ========================================================= */
const WIND = {
  /* seconds of holding to wind one, and what it costs */
  hold: 1.15,
  cost: 1.0,
  /* How long a full wind lasts, in in-game hours. Nine, so that keeping
     all four going costs about one wind each across a six-hour night —
     four percent of the meter, which is a real cost she can feel and
     not a second job. At seven hours and one-and-a-half percent it came
     to a tenth of the night's power and nights five and six stopped
     being winnable. */
  hours: 9,
};

function windState(id) {
  const ch = cast[id];
  return ch ? (ch.wound || 0) : 0;
}
/* is this one still running on the wind she gave it? */
function isWound(ch) { return (ch.wound || 0) > 0; }

/* the key on its back, found the same way the pages are: by looking */
function windHotspot() {
  const elk = EL["ns-key"];
  if (!elk) return;
  let target = null;
  if (G.phase === "play" && G.monitor && G.monOut <= 0 && !isLost(G.cam)) {
    for (let i = 0; i < CAST.length; i++) {
      const ch = cast[CAST[i].id];
      /* only in the room she is actually looking at, only while it is
         standing still enough to get a key into, and only if it needs it */
      if (ch && ch.awake && ch.room === G.cam && !ch.atDoor && windNeeded(ch)) { target = ch; break; }
    }
  }
  elk.hidden = !target;
  if (!target) { G.winding = null; G.windT = 0; return; }
  G.windTarget = target.def.id;
  _proj.setFromMatrixPosition(target.group.matrixWorld).project(view);
  const x = (_proj.x * 0.5 + 0.5) * 100;
  const y = (-_proj.y * 0.5 + 0.5) * 100;
  if (_proj.z > 1 || x < 3 || x > 97 || y < 3 || y > 97) { elk.hidden = true; return; }
  elk.style.left = x + "%";
  elk.style.top = y + "%";
  elk.style.setProperty("--k", Math.round(clamp(G.windT / WIND.hold, 0, 1) * 100) + "%");
  elk.classList.toggle("winding", G.winding === target.def.id);
  /* say whose key it is. The name was being set and never shown. */
  const lab = elk.firstElementChild;
  if (lab && lab.textContent !== target.def.name) lab.textContent = target.def.name;
  elk.dataset.who = target.def.name;
}
function windNeeded(ch) { return (ch.wound || 0) < WIND.hours * 0.55; }

/* holding the key */
function windStart() {
  if (G.phase !== "play" || !G.windTarget) return;
  G.winding = G.windTarget;
  G.windT = 0;
  /* on a wall clock: a hold is an input, and an input that takes longer
     on a slow machine is a bug rather than a difficulty setting */
  G.windT0 = perf();
}
function windEnd() { G.winding = null; G.windT = 0; }

function stepWind(dt) {
  /* everything runs down, all night, whether she is looking or not */
  const perHour = 1 / Math.max(0.001, TUNE.hourSeconds);
  CAST.forEach((d) => {
    const ch = cast[d.id];
    if (!ch) return;
    if (ch.wound === undefined) ch.wound = 0;
    if (ch.wound > 0) ch.wound = Math.max(0, ch.wound - dt * perHour);
  });
  if (!G.winding) return;
  const ch = cast[G.winding];
  if (!ch || ch.atDoor || ch.room !== G.cam || !G.monitor) { windEnd(); return; }
  G.windT = perf() - (G.windT0 || perf());
  if (G.windT >= WIND.hold) {
    /* Charged once, on completion, not by the frame. Spending it per
       frame made a wind cost less on a slower machine — the hold is on
       a wall clock but the charge was on frame time, so a browser
       running at a third of the rate paid a third of the price. A wind
       costs a wind. */
    spendPower(WIND.cost * cozyK("power"));
    ch.wound = WIND.hours;
    G.stats.winds++;
    tapeTrigger("firstWind");
    windEnd();
    SFX.crank(0.7);
    say(fmt(NS.sys.wound, ch.def.name));
    bumpUI();
  }
}

/* how many of his four are still running on her wind */
function woundCount() {
  let n = 0;
  CAST.forEach((d) => { if (isWound(cast[d.id])) n++; });
  return n;
}

/* =========================================================
   20d. THE OPENING, AS A PIECE OF FILM

   Seven camera moves through seven dark rooms while a terminal reads
   his statement, and a caption that lights up word by word as the
   machine reaches each one — voxPlan hands back the time every word
   will be spoken at, so the caption is not timed to the line, it is
   timed to the syllable.

   It runs once, before the first night, and lives on the title screen
   afterwards so it can be watched again. It is skippable from the
   second second, because a gift that traps somebody in a cutscene is
   not a gift.
   ========================================================= */
/* The film runs on a wall clock, never on frame time.
   The frame loop clamps dt to 0.1s so a backgrounded tab cannot skip a
   night — which means on a slow machine game time runs slower than real
   time, while the speech is scheduled on the audio clock and does not.
   Driving the captions off dt therefore desynchronises them from the
   voice exactly when the machine is struggling, which is the one moment
   it would be noticed. perf() is sampled at the instant voxSpeak is
   called, so the word timings it handed back stay true to the second. */
function perf() { return (window.performance ? performance.now() : Date.now()) / 1000; }
const CINE = {
  on: false, beat: -1, t: 0, t0: 0, lineT0: 0, plan: null, lineAt: 0, line: 0,
  from: new T.Vector3(), to: new T.Vector3(), look: new T.Vector3(),
  fov0: 60, fov1: 60, secs: 8, room: "office", spoke: false, endT: 0,
};
const _cf = new T.Vector3();

function cineStart() {
  if (!NS.intro) return;
  audioWake();
  CINE.on = true;
  CINE.beat = -1;
  CINE.t = 0;
  CINE.t0 = perf();
  CINE.lineT0 = perf();
  CINE.endT = 0;
  G.mode = "story";
  G.phase = "intro";
  G.monitor = false;
  G.doors.left = G.doors.right = G.doors.hatch = false;
  G.blackout = false;
  G.dead = null; G.killChar = null;
  CAST.forEach((d) => { cast[d.id].awake = false; cast[d.id].asleep = true; syncChar(cast[d.id]); });
  sayClear();
  tutorOff();
  noOverlay();
  showHud(false);
  bedStart();
  /* almost nothing, and low, so that the thing she is listening to
     while it plays is him */
  musicMode("film");
  if (stageEl) stageEl.dataset.cine = "1";
  cineCard();
  cineNext();
}

function cineStop(toNight) {
  CINE.on = false;
  CINE.plan = null;
  if (stageEl) delete stageEl.dataset.cine;
  const el = EL["ns-cine"];
  if (el) { el.hidden = true; el.innerHTML = ""; }
  saveSeenIntro(true);
  /* and it hands her to the terms rather than to a shift: being put
     into an office with no explanation is the thing that made the
     first nights feel like nothing */
  if (toNight) { if (termsSeen()) { G.night = 1; G.cfg = nightCfg(1); beginNight(1); } else termsStart(); }
  else { route("title"); }
}

/* =========================================================
   20f. THE TERMS

   The film tells her who he was. This tells her what she is doing
   here, which is the thing that was missing: the shutters come down,
   he sets six nights against everything he knows, and she says yes by
   pressing one button.

   It is the same machinery as the film — his voice, the caption
   lighting a word at a time — with none of the camera work, because
   she is not being shown anything. She is being asked.
   ========================================================= */
const TERMS = { on: false, line: 0, plan: null, t0: 0, waitT: 0 };

function termsSeen() {
  try { return localStorage.getItem("ns_terms") === "1"; } catch (e) { return false; }
}
function termsSave() { try { localStorage.setItem("ns_terms", "1"); } catch (e) {} }

function termsStart() {
  TERMS.on = true;
  TERMS.line = -1;
  TERMS.plan = null;
  TERMS.waitT = 0.6;
  G.phase = "terms";
  G.mode = "story";
  sayClear();
  tapeOff();
  showHud(false);
  bedStart();
  musicMode("locked");
  /* the shutters, once, and they are heavy */
  SFX.shutter();
  overlay(
    '<div class="ns-card ns-card-terms">' +
      '<p class="ns-cine-head"><b>' + NS.terms.head + '</b><span>' + NS.terms.sub + '</span></p>' +
      '<p class="ns-terms-sub" id="ns-terms-sub"></p>' +
      '<div class="ns-btns"><button class="ns-btn ns-btn-go" id="ns-terms-go" data-go="termsDone" hidden>' +
        NS.terms.go + '</button></div>' +
    '</div>', "ns-ov-terms");
}

function termsSpeak() {
  const line = NS.terms.lines[TERMS.line];
  if (!line) return;
  TERMS.plan = voxPlan(line);
  TERMS.t0 = perf();
  voxSpeak(TERMS.plan, { gain: 1 });
}

function termsTick(dt) {
  if (!TERMS.on) return;
  const sub = el("ns-terms-sub");

  /* the caption, on the synthesiser's own boundaries where it has them */
  if (sub && TERMS.plan) {
    const mark = voxMark();
    const at = perf() - TERMS.t0;
    let html = "";
    TERMS.plan.words.forEach((w, i) => {
      html += '<i class="' + ((mark >= 0 ? i <= mark : at >= w.at) ? "on" : "") + '">' + w.text + "</i> ";
    });
    if (sub.innerHTML !== html) sub.innerHTML = html;
  }

  if (TERMS.waitT > 0) { TERMS.waitT -= dt; return; }
  if (voxTalking()) return;
  const spoken = TERMS.plan ? TERMS.plan.dur : 0;
  if (TERMS.plan && perf() - TERMS.t0 < (SPEECH.ok ? Math.min(spoken, 0.8) : spoken) + 0.5) return;

  TERMS.line++;
  if (TERMS.line < NS.terms.lines.length) { termsSpeak(); return; }

  /* and then the one button */
  TERMS.plan = null;
  const go = el("ns-terms-go");
  if (go && go.hidden) { go.hidden = false; SFX.beep(false); }
}

function termsDone() {
  if (!TERMS.on) return;
  TERMS.on = false;
  TERMS.plan = null;
  termsSave();
  noOverlay();
  G.night = 1; G.cfg = nightCfg(1);
  beginNight(1);
}

/* the frame that carries the caption and the head/foot furniture */
function cineCard() {
  const el = EL["ns-cine"];
  if (!el) return;
  el.hidden = false;
  el.innerHTML =
    '<p class="ns-cine-head"><b>' + NS.intro.head + '</b><span>' + NS.intro.sub + '</span></p>' +
    '<p class="ns-cine-sub" id="ns-cine-sub"></p>' +
    '<button class="ns-cine-skip" id="ns-cine-skip">SKIP</button>';
  const sk = el.querySelector("#ns-cine-skip");
  if (sk) sk.addEventListener("click", (e) => { e.stopPropagation(); cineStop(true); });
}

/* move to the next beat, or to the note at the end */
function cineNext() {
  CINE.beat++;
  CINE.t = 0;
  CINE.t0 = perf();
  CINE.line = 0;
  CINE.lineAt = 0;
  CINE.plan = null;
  const b = NS.intro.beats[CINE.beat];
  if (!b) { cineNote(); return; }
  CINE.room = b.room;
  CINE.from.set(b.from[0], b.from[1], b.from[2]);
  CINE.to.set(b.to[0], b.to[1], b.to[2]);
  CINE.look.set(b.look[0], b.look[1], b.look[2]);
  CINE.fov0 = b.fov + 4;
  CINE.fov1 = b.fov;
  CINE.secs = b.secs;
  cineSpeak();
}

/* speak the current line of the current beat and hand the caption its
   word timings */
function cineSpeak() {
  const b = NS.intro.beats[CINE.beat];
  if (!b) return;
  const text = b.lines[CINE.line];
  if (text === undefined) { CINE.plan = null; return; }
  CINE.plan = voxPlan(text);
  voxSpeak(CINE.plan, { gain: 1 });
  CINE.lineT0 = perf();
}

function cineTick(dt) {
  if (!CINE.on) return;
  CINE.t = perf() - CINE.t0;

  /* the camera: an ease over the whole beat, so it is still moving when
     the line lands rather than arriving and sitting there */
  const b = NS.intro.beats[CINE.beat];
  if (b && view) {
    const rec = rooms[CINE.room];
    const ox = rec ? rec.index * SPACING : 0;
    const k = clamp(CINE.t / CINE.secs, 0, 1);
    const e = k * k * (3 - 2 * k);
    _cf.lerpVectors(CINE.from, CINE.to, e);
    view.position.set(_cf.x + ox, _cf.y, _cf.z);
    view.lookAt(CINE.look.x + ox, CINE.look.y, CINE.look.z);
    view.fov = lerp(CINE.fov0, CINE.fov1, e);
    view.updateProjectionMatrix();
  }

  /* the caption, word by word, as the machine reaches each one. (Named
     anything but `el`: there is a function called that, and shadowing it
     with a const threw on every frame of the opening.) */
  const sub = el("ns-cine-sub");
  if (sub && CINE.plan) {
    /* the synthesiser's own word boundaries when it is speaking aloud,
       and voxPlan's estimate when it is not — so the caption is the
       truth rather than a guess wherever the truth is available */
    const mark = voxMark();
    const at = perf() - CINE.lineT0;
    let html = "";
    CINE.plan.words.forEach((w, i) => {
      const on = mark >= 0 ? i <= mark : at >= w.at;
      html += '<i class="' + (on ? "on" : "") + '">' + w.text + "</i> ";
    });
    if (sub.innerHTML !== html) sub.innerHTML = html;
  }

  /* the next line, then the next beat */
  if (b) {
    const spoken = CINE.plan ? CINE.plan.dur : 0;
    /* a real voice takes as long as it takes, so the beat waits for it
       to stop rather than for the estimate to run out — with the
       estimate plus a wide margin as a backstop, because a synthesiser
       that never fires onend would otherwise hang the whole opening */
    const lineDone = voxTalking()
      ? false
      : perf() - CINE.lineT0 >= (SPEECH.ok ? Math.min(spoken, 0.8) : spoken) + 0.35;
    if (CINE.plan && lineDone) {
      CINE.line++;
      if (CINE.line < b.lines.length) cineSpeak();
      else CINE.plan = null;
    }
    if (!CINE.plan && CINE.line >= b.lines.length && CINE.t >= CINE.secs) cineNext();
  } else if (CINE.endT > 0) {
    CINE.endT -= dt;
  }
}

/* the page he actually left her, once the machine has stopped */
function cineNote() {
  const n = NS.intro.note;
  CINE.plan = null;
  const el = EL["ns-cine"];
  if (el) { el.hidden = true; el.innerHTML = ""; }
  if (stageEl) delete stageEl.dataset.cine;
  SFX.paper();
  overlay(
    '<div class="ns-card ns-card-note">' +
      '<p class="ns-from">' + n.head + '</p>' +
      '<div class="ns-paper">' +
        n.lines.map((l) => "<p>" + l + "</p>").join("") +
      '</div>' +
      '<p class="ns-pencil">' + n.sign + '</p>' +
      '<p class="ns-cine-end">' + NS.intro.end + '</p>' +
      '<div class="ns-btns"><button class="ns-btn ns-btn-go" data-go="introDone">TAKE THE KEY</button></div>' +
    '</div>', "ns-ov-note");
}

const SEEN_KEY = "ns_seenintro";
function seenIntro() {
  try { return localStorage.getItem(SEEN_KEY) === "1"; } catch (e) { return false; }
}
function saveSeenIntro(v) { try { localStorage.setItem(SEEN_KEY, v ? "1" : "0"); } catch (e) {} }

/* =========================================================
   20c. THE SIX THINGS HIDDEN IN THE SHOP

   The cameras were always a threat detector. This is what turns them
   into a search: one small object a night, sitting somewhere on the
   eight feeds, catching about as much light as a brass tag catches. It
   is not marked on the map and the system never mentions it. She finds
   it by looking at rooms, which is the thing the game most wants her
   to be doing anyway, and which is exactly what she will not do if the
   only reason to raise the monitor is fear.

   Built once at boot, all six, and shown one at a time. They live in
   the room's `live` branch rather than its frozen body, because the
   only thing about them that moves is whether they exist tonight.
   ========================================================= */
const FIND_AT = new T.Vector3();
let findMesh = null, findRec = null, findGlint = 0, findLit = false;
const findMeshes = {};

/* the small objects themselves. None of them is bigger than a hand. */
function buildFindProp(kind) {
  const g = new T.Group();
  if (kind === "tag") {
    /* a brass maker's tag on a loop of wire */
    g.add(at(new T.Mesh(new T.BoxGeometry(0.11, 0.002, 0.07), mat("brass", 1, 1, "#c9a227")), 0, 0, 0));
    g.add(at(new T.Mesh(new T.TorusGeometry(0.012, 0.0032, 4, 10), flat("#8d7a4a")), 0.045, 0.004, -0.028, Math.PI / 2));
    g.add(at(new T.Mesh(new T.BoxGeometry(0.075, 0.0012, 0.008), flat("#6b5a2e")), -0.004, 0.0022, -0.012));
    g.add(at(new T.Mesh(new T.BoxGeometry(0.06, 0.0012, 0.008), flat("#6b5a2e")), -0.012, 0.0022, 0.008));
  } else if (kind === "card") {
    /* a stiff printed card, gone cream */
    g.add(at(new T.Mesh(new T.BoxGeometry(0.13, 0.0022, 0.085), mat("paper", 1, 1, "#e8dcc0")), 0, 0, 0));
    g.add(at(new T.Mesh(new T.BoxGeometry(0.085, 0.0014, 0.007), flat("#8a7a62")), 0, 0.0022, -0.02));
    g.add(at(new T.Mesh(new T.BoxGeometry(0.1, 0.0014, 0.005), flat("#a5947a")), 0, 0.0022, 0.004));
  } else if (kind === "letter") {
    /* folded twice, so it stands a little proud of whatever it is on */
    g.add(at(new T.Mesh(new T.BoxGeometry(0.115, 0.004, 0.075), mat("paper", 1, 1, "#f2e9d6")), 0, 0, 0));
    g.add(at(new T.Mesh(new T.BoxGeometry(0.115, 0.004, 0.038), mat("paper", 1, 1, "#e6dcc6")), 0, 0.0038, 0.02, 0.16));
    g.add(at(new T.Mesh(new T.BoxGeometry(0.03, 0.0016, 0.03), flat("#b8434e")), 0.03, 0.0062, 0.006, 0, 0.5, 0));
  } else {
    /* a loose page, one corner curled */
    g.add(at(new T.Mesh(new T.BoxGeometry(0.125, 0.0022, 0.095), mat("paper", 1, 1, "#efe4cd")), 0, 0, 0));
    g.add(at(new T.Mesh(new T.BoxGeometry(0.04, 0.0022, 0.04), mat("paper", 1, 1, "#e2d5ba")), 0.045, 0.0018, 0.036, -0.22, 0, 0.3));
    for (let i = 0; i < 4; i++) {
      g.add(at(new T.Mesh(new T.BoxGeometry(0.085 - i * 0.008, 0.0012, 0.005), flat("#5a4a3a")),
               -0.01, 0.0022, -0.028 + i * 0.019));
    }
  }
  /* the glint: a tiny unlit plate that the frame loop turns on and off,
     so the thing catches the light the way metal and paper do rather
     than glowing like a pickup in a platformer */
  const gl = at(new T.Mesh(new T.PlaneGeometry(0.17, 0.12), glow("#fff3d0", 0.0)), 0, 0.007, 0, -Math.PI / 2);
  gl.userData.glint = true;
  g.add(gl);
  /* a shade over life size. At a camera's distance a real eleven
     centimetre tag is four pixels of brown, and a search she cannot win
     is not a search, it is a wall. */
  g.scale.setScalar(1.55);
  return g;
}

/* Where each one hides.

   Hand-picked coordinates were the wrong idea: six guesses, and all six
   landed outside their room's camera frustum, so the object existed and
   was never once visible. Each spot is derived instead — a point along
   the line that room's camera is actually looking down, pushed to one
   side of the picture so it is not dead centre, then dropped straight
   down onto whatever surface is under it. That gets both things at
   once: it is in shot, and it is resting on something. Rule 2 holds,
   and it holds without anyone having to measure a shelf.

   Candidates are tried in order and the first that lands on a surface
   at a sensible height, inside the middle of the frame, wins — so
   moving a camera or a shelf later can never silently hide a page. */
const FIND_TRY = [];
for (let ti = 0; ti < 7; ti++) {
  for (let si = 0; si < 7; si++) {
    FIND_TRY.push({ t: 0.34 + ti * 0.075, side: (si - 3) * 0.28 });
  }
}
const _ray = new T.Raycaster();
const _down = new T.Vector3(0, -1, 0);
const _cp = new T.Vector3(), _lk = new T.Vector3(), _pt = new T.Vector3(), _sd = new T.Vector3();
const FIND_WHY = [];

function findSpot(rec) {
  const cam = rec.cams.main;
  if (!cam) return null;
  const ox = rec.index * SPACING;
  _cp.set(cam.pos[0] + ox, cam.pos[1], cam.pos[2]);
  _lk.set(cam.look[0] + ox, cam.look[1], cam.look[2]);
  /* the camera's own right vector, flattened, so "to one side" means to
     one side of the picture rather than of the world */
  _sd.subVectors(_lk, _cp); _sd.y = 0; _sd.normalize();
  _sd.set(-_sd.z, 0, _sd.x);

  /* a probe camera matching the real one, to check the result is in shot */
  const probe = new T.PerspectiveCamera(cam.fov || 60, 16 / 9, 0.1, 200);
  probe.position.copy(_cp);
  probe.lookAt(_lk);
  probe.updateMatrixWorld(true);

  /* Raycaster walks straight past anything invisible, and at boot every
     room but the office is switched off — so without this the six casts
     all found empty air and not one page was ever placed. */
  const wasVisible = rec.group.visible;
  rec.group.visible = true;
  const found = [];
  for (let i = 0; i < FIND_TRY.length && !found.length; i++) {
    const c = FIND_TRY[i];
    _pt.lerpVectors(_cp, _lk, c.t).addScaledVector(_sd, c.side);
    /* Cast from above the tallest thing in any room and then pick the
       first hit that is at a height something could sit on. Taking the
       nearest hit instead meant the ceiling in five rooms and the floor
       between two arcade cabinets in the sixth. */
    _ray.set(new T.Vector3(_pt.x, 3.1, _pt.z), _down);
    _ray.far = 3.1;
    const hit = _ray.intersectObject(rec.group, true)
      .filter((h) => !(h.object.userData && h.object.userData.shadow))
      .filter((h) => h.point.y >= 0.30 && h.point.y <= 1.62)[0];
    if (!hit) continue;
    const y = hit.point.y;
    const at = new T.Vector3(_pt.x, y + 0.004, _pt.z);
    const pr = at.clone().project(probe);
    const px = (pr.x * 0.5 + 0.5) * 100, py = (-pr.y * 0.5 + 0.5) * 100;
    if (pr.z > 1 || px < 20 || px > 80 || py < 20 || py > 78) continue;
    /* handed back in the room's own space, not the world's: it is about
       to be parented under a group that is already parked sixty metres
       out, and adding the offset twice put every page in the next room
       along, off the side of the picture */
    found.push({ at: new T.Vector3(at.x - ox, at.y, at.z),
                 ry: Math.atan2(_sd.x, _sd.z) + 0.4 });
  }
  rec.group.visible = wasVisible;
  return found[0] || null;
}

function buildFinds() {
  NS.finds.forEach((f) => {
    const rec = rooms[f.room];
    if (!rec) return;
    const spot = findSpot(rec);
    if (!spot) { console.warn("night shift: nowhere to hide " + f.id + " in " + f.room); return; }
    const g = buildFindProp(f.kind);
    g.position.copy(spot.at);
    g.rotation.y = spot.ry;
    g.visible = false;
    rec.live.add(g);
    g.updateMatrixWorld(true);
    /* it is sitting on something, so it gets a pool under it like
       everything else in this chapter does */
    const sh = contactShadow(g, { y: 0, opacity: 0.3, spread: 1.3 });
    if (sh) { sh.position.set(0, -0.0025, 0); g.add(sh); }
    findMeshes[f.id] = g;
  });
}

/* the one that belongs to tonight, and only while it is still there */
function armFind() {
  findMesh = null; findRec = null; findLit = false;
  NS.finds.forEach((f) => { if (findMeshes[f.id]) findMeshes[f.id].visible = false; });
  if (G.mode !== "story") return;
  const f = NS.finds.filter((x) => x.on === G.night)[0];
  if (!f || !findMeshes[f.id]) return;
  if (foundAll()[f.id]) return;            // already hers; it is not there again
  findRec = f;
  findMesh = findMeshes[f.id];
  findMesh.visible = true;
  findMesh.getWorldPosition(FIND_AT);
}

function stepFind(dt) {
  if (!findMesh) return;
  findGlint -= dt;
  if (findGlint <= 0) {
    findGlint = findLit ? range(Math.random, 0.9, 1.6) : range(Math.random, 1.3, 2.6);
    findLit = !findLit;
    findMesh.traverse((o) => {
      if (o.userData && o.userData.glint && o.material) {
        o.material = glow("#fff3d0", findLit ? 0.88 : 0.0);
      }
    });
  }
}

function findHotspot() {
  const el = EL["ns-find"];
  if (!el) return;
  const on = findRec && G.phase === "play" && G.monitor &&
             G.cam === findRec.room && G.monOut <= 0 && !isLost(G.cam);
  el.hidden = !on;
  if (!on) return;
  _proj.copy(FIND_AT).project(view);
  const x = (_proj.x * 0.5 + 0.5) * 100;
  const y = (-_proj.y * 0.5 + 0.5) * 100;
  if (_proj.z > 1 || x < 3 || x > 97 || y < 3 || y > 97) { el.hidden = true; return; }
  el.style.left = x + "%";
  el.style.top = y + "%";
  el.classList.toggle("glinting", findLit);
}

/* --- what she has picked up, across every run --------------------- */
const FOUND_KEY = "ns_found";
function foundAll() {
  try { return JSON.parse(localStorage.getItem(FOUND_KEY) || "{}") || {}; }
  catch (e) { return {}; }
}
function keepFind(id) {
  const f = foundAll();
  if (f[id]) return false;
  f[id] = true;
  try { localStorage.setItem(FOUND_KEY, JSON.stringify(f)); } catch (e) {}
  return true;
}
function foundCount() {
  const f = foundAll();
  return NS.finds.filter((x) => f[x.id]).length;
}

/* picking it up. The shift keeps running underneath — she is reading a
   piece of paper in a room with something walking towards her, which is
   the entire point and is why the card can be dismissed in one tap. */
function takeFind() {
  if (!findRec || G.phase !== "play") return;
  const f = findRec;
  keepFind(f.id);
  G.stats.finds++;
  findMesh.visible = false;
  findMesh = null; findRec = null;
  if (EL["ns-find"]) EL["ns-find"].hidden = true;
  SFX.paper();
  G.phase = "found";
  musicMode("found");
  showHud(false);
  overlay(
    '<div class="ns-card ns-card-find">' +
      '<p class="ns-from">' + f.where + '</p>' +
      '<div class="ns-paper">' +
        '<p class="ns-paper-head">' + f.title + '</p>' +
        f.lines.map((l) => "<p>" + l + "</p>").join("") +
      '</div>' +
      '<p class="ns-pencil">' + f.back + '</p>' +
      '<div class="ns-btns"><button class="ns-btn ns-btn-go" data-go="findOut">POCKET IT</button></div>' +
    '</div>', "ns-ov-find");
}
function closeFind() {
  if (G.phase !== "found") return;
  G.phase = "play";
  musicMode(G.blackout ? "dark" : "night");
  noOverlay();
  showHud(true);
}

/* =========================================================
   20b. THE CABINET THAT IS STILL RUNNING

   One machine in Arcade Row never got switched off. It shows up as a
   marquee that blinks on camera three and nothing else — it is not on
   the title screen, it is not in the how-to, and the only way to find
   it is to be looking at that feed when it blinks and to touch it.

   What is behind it is a small original game about a wind-up mouse on
   a shelf: cogs to catch, things falling off the shelf above, and a
   spring that runs down whatever you do.
   ========================================================= */
const EGG_AT = new T.Vector3();
const _proj = new T.Vector3();
let eggMesh = null, eggBlink = 0, eggSeen = 0;

function findEgg() {
  /* the second cabinet down the west side of the arcade — grab its
     screen so the blink is the machine's own light, not an overlay */
  const rec = rooms.arcade;
  if (!rec) return;
  let best = null, bestZ = 99;
  rec.group.traverse((o) => {
    if (o.userData && o.userData.screen && o.isMesh) {
      const p = new T.Vector3();
      o.getWorldPosition(p);
      const d = Math.abs(p.z - (rec.index * 0 + -1.1));
      if (p.x < rec.index * SPACING && d < bestZ) { bestZ = d; best = o; }
    }
  });
  if (!best) return;
  eggMesh = best;
  eggMesh.getWorldPosition(EGG_AT);
}

function stepEgg(dt) {
  if (!eggMesh) return;
  eggBlink -= dt;
  if (eggBlink <= 0) {
    eggBlink = range(Math.random, 2.6, 6.5);
    eggMesh.userData.lit = !eggMesh.userData.lit;
    eggMesh.material = eggMesh.userData.lit ? glow("#eaf6ff") : glow("#2b4a6e");
  }
}

/* where that cabinet is on the screen right now, as a percentage */
function eggHotspot() {
  const el = EL["ns-egg"];
  if (!el) return;
  const on = G.phase === "play" && G.monitor && G.cam === "arcade" && G.monOut <= 0 && !isLost("arcade");
  el.hidden = !on;
  if (!on) return;
  _proj.copy(EGG_AT).project(view);
  const x = (_proj.x * 0.5 + 0.5) * 100;
  const y = (-_proj.y * 0.5 + 0.5) * 100;
  if (_proj.z > 1 || x < 2 || x > 98 || y < 2 || y > 98) { el.hidden = true; return; }
  el.style.left = x + "%";
  el.style.top = y + "%";
  el.classList.toggle("blinking", !!(eggMesh && eggMesh.userData.lit));
}

/* --- the machine itself ---------------------------------------------
   KEYWIND. A wind-up mouse on a shop shelf. Cogs wind you back up,
   everything else knocks you over, and the spring runs down on its own
   however well you play, so a run always ends. */
const ARC = {
  W: 240, H: 180, best: 0, on: false, cvs: null, ctx: null,
  t: 0, x: 120, vx: 0, spring: 1, score: 0, drops: [], spawn: 0, speed: 1, over: false,
  keys: { left: false, right: false },
};

function arcadeOpen() {
  if (ARC.on) return;
  ARC.on = true;
  G.phase = "arcade";
  showHud(false);
  try { ARC.best = parseInt(localStorage.getItem("ns_arcade") || "0", 10) || 0; } catch (e) { ARC.best = 0; }
  if (giveBadge("arcade")) syncTrophies();
  overlay(
    '<div class="ns-card ns-card-arc">' +
      '<p class="ns-arc-title">KEYWIND</p>' +
      '<canvas class="ns-arc-cvs" id="ns-arc-cvs" width="240" height="180"></canvas>' +
      '<p class="ns-arc-help">catch the cogs &middot; the spring runs down anyway</p>' +
      '<div class="ns-arc-pad">' +
        '<button class="ns-btn ns-btn-sm" data-arc="left">&#9664;</button>' +
        '<button class="ns-btn ns-btn-sm" data-arc="right">&#9654;</button>' +
      '</div>' +
      '<div class="ns-btns"><button class="ns-btn ns-btn-go" data-go="arcadeOut">BACK TO THE SHIFT</button></div>' +
    '</div>', "ns-ov-arc");
  ARC.cvs = el("ns-arc-cvs");
  ARC.ctx = ARC.cvs ? ARC.cvs.getContext("2d") : null;
  arcadeReset();
  const o = EL["ns-overlay"];
  if (o) o.querySelectorAll("[data-arc]").forEach((b) => {
    const k = b.dataset.arc;
    const down = (e) => { e.preventDefault(); e.stopPropagation(); ARC.keys[k] = true; };
    const up = (e) => { e.preventDefault(); e.stopPropagation(); ARC.keys[k] = false; };
    b.addEventListener("pointerdown", down);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointerleave", up);
    b.addEventListener("pointercancel", up);
  });
  SFX.crank(0.5);
}

function arcadeClose() {
  ARC.on = false;
  ARC.keys.left = ARC.keys.right = false;
  G.phase = "play";
  noOverlay();
  showHud(true);
}

function arcadeReset() {
  ARC.t = 0; ARC.x = ARC.W / 2; ARC.vx = 0;
  ARC.spring = 1; ARC.score = 0; ARC.drops = []; ARC.spawn = 0; ARC.speed = 1; ARC.over = false;
}

function arcadeStep(dt) {
  if (!ARC.ctx) return;
  const c = ARC.ctx, W = ARC.W, H = ARC.H;
  if (!ARC.over) {
    ARC.t += dt;
    ARC.speed = 1 + ARC.t * 0.055;
    /* the spring runs down whatever you do */
    ARC.spring -= dt * (0.052 + ARC.t * 0.0016);
    const acc = (ARC.keys.right ? 1 : 0) - (ARC.keys.left ? 1 : 0);
    ARC.vx = clamp(ARC.vx + acc * dt * 640, -128, 128) * (1 - dt * 3.4);
    ARC.x = clamp(ARC.x + ARC.vx * dt, 14, W - 14);
    ARC.spawn -= dt;
    if (ARC.spawn <= 0) {
      ARC.spawn = Math.max(0.2, 0.72 / ARC.speed);
      const cog = Math.random() < 0.42;
      ARC.drops.push({ x: range(Math.random, 14, W - 14), y: -8, cog, r: cog ? 6 : 7, spin: 0 });
    }
    for (let i = ARC.drops.length - 1; i >= 0; i--) {
      const d = ARC.drops[i];
      d.y += dt * (52 + ARC.speed * 26);
      d.spin += dt * (d.cog ? 5 : 2);
      if (d.y > H - 26 && Math.abs(d.x - ARC.x) < 15) {
        ARC.drops.splice(i, 1);
        if (d.cog) { ARC.spring = Math.min(1, ARC.spring + 0.19); ARC.score += 10; SFX.beep(true); }
        else { ARC.spring -= 0.3; SFX.knock(); }
      } else if (d.y > H + 12) {
        ARC.drops.splice(i, 1);
        if (!d.cog) ARC.score += 2;
      }
    }
    if (ARC.spring <= 0) {
      ARC.over = true;
      ARC.spring = 0;
      SFX.falseSettle(0);
      if (ARC.score > ARC.best) {
        ARC.best = ARC.score;
        try { localStorage.setItem("ns_arcade", String(ARC.best)); } catch (e) {}
      }
    }
  } else {
    ARC.t += dt;
    if (ARC.t > 1.6 && (ARC.keys.left || ARC.keys.right)) arcadeReset();
  }

  /* --- drawn, not sprited ------------------------------------------ */
  c.fillStyle = "#121a1e"; c.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 3) { c.fillStyle = "rgba(0,0,0,.22)"; c.fillRect(0, y, W, 1); }
  /* the shelf she is standing on */
  c.fillStyle = "#5a4230"; c.fillRect(0, H - 18, W, 18);
  c.fillStyle = "#7a5a40"; c.fillRect(0, H - 18, W, 3);
  /* the spring gauge */
  c.fillStyle = "#26323a"; c.fillRect(8, 8, W - 16, 7);
  c.fillStyle = ARC.spring > 0.4 ? "#7fe4d0" : "#ffb347";
  c.fillRect(9, 9, (W - 18) * clamp(ARC.spring, 0, 1), 5);
  c.fillStyle = "#7fe4d0";
  c.font = "bold 11px ui-monospace, monospace";
  c.textAlign = "left"; c.fillText(String(ARC.score), 9, 30);
  c.textAlign = "right"; c.fillText("BEST " + ARC.best, W - 9, 30);
  /* the falling things */
  ARC.drops.forEach((d) => {
    c.save(); c.translate(d.x, d.y); c.rotate(d.spin);
    if (d.cog) {
      c.fillStyle = "#e0b34e";
      for (let i = 0; i < 6; i++) {
        c.save(); c.rotate((i / 6) * TAU);
        c.fillRect(-1.8, -d.r - 2.4, 3.6, 4.4);
        c.restore();
      }
      c.beginPath(); c.arc(0, 0, d.r, 0, TAU); c.fill();
      c.fillStyle = "#121a1e"; c.beginPath(); c.arc(0, 0, d.r * 0.36, 0, TAU); c.fill();
    } else {
      c.fillStyle = "#b05a62";
      c.fillRect(-d.r, -d.r, d.r * 2, d.r * 2);
      c.fillStyle = "#d8848a";
      c.fillRect(-d.r, -d.r, d.r * 2, 2.4);
    }
    c.restore();
  });
  /* the mouse */
  const mx = ARC.x, my = H - 26;
  c.save(); c.translate(mx, my);
  c.fillStyle = "#c9c2b4"; c.fillRect(-9, -8, 18, 12);
  c.fillStyle = "#e0dbcf"; c.fillRect(-9, -8, 18, 3);
  c.fillStyle = "#c9c2b4"; c.beginPath(); c.arc(9, -3, 5, 0, TAU); c.fill();
  c.fillStyle = "#2a2028"; c.beginPath(); c.arc(11, -4, 1.4, 0, TAU); c.fill();
  c.fillStyle = "#c9c2b4"; c.beginPath(); c.arc(-4, -10, 3.4, 0, TAU); c.fill();
  c.beginPath(); c.arc(3, -10, 3.4, 0, TAU); c.fill();
  /* the key in its back, turning as it moves */
  c.save(); c.translate(-10, -3); c.rotate(ARC.t * 3 + ARC.x * 0.05);
  c.strokeStyle = "#e0b34e"; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-4, 0); c.lineTo(4, 0); c.moveTo(0, -4); c.lineTo(0, 4); c.stroke();
  c.restore();
  c.restore();
  if (ARC.over) {
    c.fillStyle = "rgba(8,12,14,.78)"; c.fillRect(0, 0, W, H);
    c.fillStyle = "#ffb347"; c.textAlign = "center";
    c.font = "bold 15px ui-monospace, monospace";
    c.fillText("WOUND DOWN", W / 2, H / 2 - 6);
    c.font = "10px ui-monospace, monospace";
    c.fillStyle = "#cfe6e0";
    c.fillText(ARC.score + " — press either way to go again", W / 2, H / 2 + 14);
  }
}

/* =========================================================
   21. CONTROLS

   Everything is on a key and on a button, and neither is a second-class
   way to play. The doors are the two outside buttons because that is
   where the doors are.
   ========================================================= */
/* the camera list, in the order the numbers on the monitor run */
const CAM_ORDER = ROOMS.filter((r) => r.cam > 0).sort((a, b) => a.cam - b.cam);

function toggleDoor(k) {
  if (G.phase !== "play") return;
  if (G.blackout) { SFX.beep(false); return; }
  G.doors[k] = !G.doors[k];
  if (G.doors[k]) G.stats.closes++;
  if (k === "hatch") { SFX.hatch(); say(G.doors.hatch ? NS.sys.hatchShut : NS.sys.hatchOpen); }
  else {
    const num = k === "left" ? "ONE" : "TWO";
    if (G.doors[k]) { SFX.doorClose(); G.shake = Math.max(G.shake, 0.35); say(fmt(NS.sys.doorShut, num)); tapeTrigger("firstDoor"); }
    else { SFX.doorOpen(); say(fmt(NS.sys.doorOpen, num)); }
  }
  /* opening a door on something standing behind it gives you a moment,
     and only a moment */
  if (!G.doors[k]) {
    for (const id in cast) {
      const ch = cast[id];
      if (ch.awake && ch.atDoor && ch.def.door === k) ch.doorT = Math.min(ch.doorT, 1.3);
    }
  }
  bumpUI();
}

function toggleMonitor() {
  if (!G.monitor) tapeTrigger("firstCam");
  if (G.phase === "gallery") return;
  if (G.phase !== "play") return;
  if (G.blackout) { SFX.beep(false); return; }
  G.monitor = !G.monitor;
  SFX.monitor(G.monitor);
  if (G.monitor) SFX.hiss(0.7);
  bumpUI();
}

function selectCam(id) {
  if (!ROOM[id] || id === "office") return;
  if (G.cam === id) return;
  G.cam = id;
  SFX.camSwitch();
  bumpUI();
}

function press(k) {
  audioWake();
  if (k === "monitor") toggleMonitor();
  else if (k === "prev" || k === "next") stepCam(k === "next" ? 1 : -1);
  else toggleDoor(k);
}

/* walking the camera list one at a time. On a phone the plan drawn on
   the tube is too small to be the only way to change camera, so the pad
   grows a pair of arrows whenever the monitor is up. */
function stepCam(d) {
  if (G.phase !== "play" || !G.monitor) return;
  let i = 0;
  for (let k = 0; k < CAM_ORDER.length; k++) if (CAM_ORDER[k].id === G.cam) i = k;
  const n = CAM_ORDER.length;
  selectCam(CAM_ORDER[((i + d) % n + n) % n].id);
}

function togglePause() {
  if (G.phase === "play") { G.phase = "pause"; screenPause(); showHud(false); }
  else if (G.phase === "pause") route("resume");
}

/* the only thing in the chapter that holds a key down rather than
   toggling on the press */
function onKeyUp(e) {
  if (!running || !ARC.on) return;
  const k = e.key;
  if (k === "a" || k === "A" || k === "ArrowLeft") ARC.keys.left = false;
  else if (k === "d" || k === "D" || k === "ArrowRight") ARC.keys.right = false;
}

function onKey(e) {
  if (!running) return;
  const k = e.key;
  if (CINE.on) {
    if (k === "Escape" || k === "Enter" || k === " ") { e.preventDefault(); cineStop(true); }
    return;
  }
  if (k === "Escape") { e.preventDefault(); togglePause(); return; }
  /* the cabinet is checked before the phase, because playing it puts the
     chapter in its own phase — asking for "play" first made every key in
     KEYWIND dead and turned the space bar into the exit button */
  if (ARC.on) {
    if (k === "a" || k === "A" || k === "ArrowLeft") { e.preventDefault(); ARC.keys.left = true; }
    else if (k === "d" || k === "D" || k === "ArrowRight") { e.preventDefault(); ARC.keys.right = true; }
    return;
  }
  if (G.phase !== "play") {
    if (k === "Enter" || k === " ") {
      const b = EL["ns-overlay"] && EL["ns-overlay"].querySelector("[data-go].ns-btn-go");
      if (b) { e.preventDefault(); b.click(); }
    }
    return;
  }
  if (k === "a" || k === "A" || k === "ArrowLeft") { e.preventDefault(); toggleDoor("left"); }
  else if (k === "d" || k === "D" || k === "ArrowRight") { e.preventDefault(); toggleDoor("right"); }
  else if (k === "w" || k === "W" || k === "ArrowUp" || k === "s" || k === "S" || k === "ArrowDown") { e.preventDefault(); toggleDoor("hatch"); }
  else if (k === " ") { e.preventDefault(); toggleMonitor(); }
  else if (k >= "1" && k <= "8") {
    const r = CAM_ORDER[parseInt(k, 10) - 1];
    if (r) { if (!G.monitor) toggleMonitor(); selectCam(r.id); }
  }
}

/* look around from the seat: a drag, or the mouse when it is over the
   office. It changes nothing but the view, and it is optional. */
let dragging = false, dragX = 0, dragY = 0;
function onPointerDown(e) {
  if (G.phase !== "play" || G.monitor) return;
  dragging = true; dragX = e.clientX; dragY = e.clientY;
}
function onPointerMove(e) {
  if (G.phase !== "play" || G.monitor) return;
  if (dragging) {
    panTX = clamp(panTX + (e.clientX - dragX) * 0.004, -1, 1);
    panTY = clamp(panTY - (e.clientY - dragY) * 0.004, -0.7, 0.7);
    dragX = e.clientX; dragY = e.clientY;
  } else if (e.pointerType === "mouse" && stageEl) {
    const r = stageEl.getBoundingClientRect();
    panTX = clamp(((e.clientX - r.left) / r.width - 0.5) * -1.5, -1, 1);
    panTY = clamp(((e.clientY - r.top) / r.height - 0.5) * -0.8, -0.7, 0.7);
  }
}
function onPointerUp() { dragging = false; }

/* =========================================================
   22. IN AND OUT

   The chapter owns nothing outside its own screen. start() builds the
   world the first time it is asked and then only ever wakes it up;
   stop() halts the loop and the sound and leaves everything standing,
   so coming back in is instant.
   ========================================================= */
let running = false, boundKeys = false, ro = null;

function onResize() { sizeRenderer(); }

function start() {
  const cvs = el("ns-canvas");
  if (!cvs) return;
  buildUI();
  /* a phone is not asked to draw four million pixels for a room lit by
     one bulb; the quality ladder is one number and it is here */
  const touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  pixelCap = touch ? 1.25 : 1.6;

  /* Building the shop is about half a second of solid work — nine rooms,
     four performers and two dozen painted surfaces — and it is one
     synchronous block, so nothing paints while it runs. Put a card up
     and let it reach the screen before starting. */
  if (!built && !noWebGL) {
    G.phase = "load";
    showHud(false);
    overlay(
      '<div class="ns-card ns-card-load">' +
        '<p class="ns-sign"><span>' + NS.shop + '</span><b>' + NS.sub + '</b></p>' +
        '<p class="ns-tag">unlocking the shop&hellip;</p>' +
      '</div>', "ns-ov-title");
    requestAnimationFrame(() => requestAnimationFrame(() => finishStart(cvs)));
    return;
  }
  finishStart(cvs);
}

function finishStart(cvs) {
  /* she may have gone back to the hub in the frame we waited */
  if (G.phase === "idle") return;
  buildWorld(cvs);
  if (noWebGL) {
    running = true;
    G.phase = "title";
    showHud(false);
    overlay(
      '<div class="ns-card">' +
        '<h3>THE SHOP IS DARK</h3>' +
        '<p class="ns-blurb">This one needs 3D graphics, and this browser has them turned off. ' +
        'Everything else on the site works without them.</p>' +
        '<div class="ns-btns"><button class="ns-btn ns-btn-go" data-go="quit">BACK TO THE HUB</button></div>' +
      '</div>', "ns-ov-title");
    return;
  }
  sizeRenderer();
  useView.__last = null;
  running = true;
  G.cozy = loadCozy();
  G.mode = "story";
  G.phase = "title";
  G.night = maxUnlocked();
  G.cfg = nightCfg(G.night);
  resetCast();
  showRoom("office");
  useView("office", "main");
  showHud(false);
  syncTrophies();
  musicMode("menu");
  screenTitle();
  if (!boundKeys) {
    boundKeys = true;
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", onResize);
    if (window.ResizeObserver && stageEl) { ro = new ResizeObserver(onResize); ro.observe(stageEl); }
    const st = stageEl;
    if (st) {
      st.addEventListener("pointerdown", onPointerDown);
      st.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      st.addEventListener("pointerleave", onPointerUp);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && G.phase === "play") togglePause();
    });
  }
  lastT = 0;
  if (!raf) raf = requestAnimationFrame(frame);
}

function stop() {
  running = false;
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  /* leaving from the gallery used to keep the daylight vignette, and
     leaving with the cabinet open used to leave it open for good —
     arcadeOpen returns early on ARC.on and nothing ever cleared it */
  if (stageEl) delete stageEl.dataset.day;
  ARC.on = false;
  ARC.keys.left = ARC.keys.right = false;
  sayClear();
  bedStop();
  musicStop();
  audioDuck(1, 10);
  G.phase = "idle";
  noOverlay();
  showHud(false);
}

/* --- a still of any room from any of its cameras -------------------
   Used by the offline checks in tools/ to look at the geometry without
   playing a shift. It is also the fastest way to answer "is anything
   floating?", which is the question this build has to keep answering. */
function preview(stage, cvs, roomId, camName, who) {
  stageEl = stage;
  buildWorld(cvs);
  sizeRenderer();
  showRoom(roomId);
  useView(roomId, camName || "main");
  for (const id in cast) { cast[id].awake = false; }
  (who || []).forEach((w) => {
    const ch = cast[w.id];
    if (!ch) return;
    ch.awake = true;
    ch.pose = w.pose || "idle";
    putChar(ch, roomId, w.anchor);
  });
  syncCastVisibility();
  poseCast(0.0001, 0);
  if (rooms.office && officeDoors) {
    officeDoors.left.mesh.updateMatrixWorld(true);
    officeDoors.right.mesh.updateMatrixWorld(true);
  }
  renderer.render(scene, view);
}

/* ---------------------------------------------------------
   Hooks for the offline checks in tools/. Nothing here is used by the
   game itself; they exist so a suite can drive a night in seconds
   instead of waiting six real minutes for one.
   --------------------------------------------------------- */
const testHooks = {
  state: () => G,
  cast: () => cast,
  rooms: () => rooms,
  press,
  cam: selectCam,
  route,
  /* advance the shift by hand, in fixed slices, with no rendering */
  pump(seconds, slice) {
    /* a suite driving a night by hand is not being oriented, and it is
       not being stopped to be told a story either — both of those wait
       for a click that a pumped night will never make */
    if (tutorOn()) tutorOff();
    G.pumping = true;
    const st = slice || 1 / 30;
    let left = seconds;
    while (left > 0 && G.phase === "play") {
      const dt = Math.min(st, left);
      left -= dt;
      G.t += dt;
      stepClock(dt);
      if (G.phase !== "play") break;
      G.drain = powerRate();
      spendPower(G.drain * dt);
      if (G.blackout) stepBlackout(dt);
      CAST.forEach((d) => stepCast(cast[d.id], dt));
      SOLD.forEach((d) => stepSold(cast[d.id], dt));
      stepSignal(dt);
      /* the same list the frame loop runs, so a pumped night costs what
         a played one costs — the surges especially, which are the
         difference between a night four that is hard and one that is
         arithmetically impossible */
      stepAlarms(dt);
      stepShifts(dt);
      stepHazards(dt);
      stepWind(dt);
    }
    G.pumping = false;
    return { phase: G.phase, hour: G.hour, power: G.power, dead: G.dead };
  },
  put(id, step) {
    const ch = cast[id];
    if (!ch) return;
    ch.awake = true;
    ch.step = clamp(step, 0, ch.def.route.length - 1);
    syncChar(ch);
    /* the four have their own grace per performer; the ones he sold all
       share one, and they get a hold timer instead of a knock count */
    if (ch.atDoor) {
      if (ch.sold) { ch.doorT = SOLD_TUNE.doorGrace; ch.holdT = SOLD_TUNE.holdFor; }
      else ch.doorT = TUNE.cast[id].doorGrace;
    }
  },
  /* put the whole cast back in its box and then stand one of them
     somewhere. Setting awake=false by hand is not enough — a figure
     whose hour has come wakes itself up again on the next tick, which
     is correct in a game and confusing in a test. */
  only(id, step) {
    resetCast();
    /* only means only. The ones he sold are not in CAST, so before this
       they carried on walking in through the front of the shop and
       killed the subject of whatever was being measured — which showed
       up as a ballerina that would not move behind a dropped monitor,
       because the night had ended eleven seconds earlier. */
    resetSold();
    SOLD.forEach((d) => { cast[d.id].asleep = true; cast[d.id].awake = false; });
    G.phase = "play";
    G.dead = null; G.killChar = null;
    CAST.forEach((d) => { cast[d.id].asleep = d.id !== id; });
    testHooks.put(id, step === undefined ? cast[id].def.route.length - 1 : step);
  },
  render() { if (renderer) renderer.render(scene, view); },
  silence(v) { audioMute(v !== false); },
  /* the score, so a suite can assert that the music is ahead of the
     game rather than behind it */
  music: () => ({ mode: MUS.mode, dread: MUS.dread, target: MUS.target,
                  spb: MODE_FEEL[MUS.mode] ? MODE_FEEL[MUS.mode].spb : null,
                  theme: MODE_FEEL[MUS.mode] ? MODE_FEEL[MUS.mode].theme : null,
                  bus: MUS.bus ? MUS.bus.gain.value : 0,
                  lay: MUS_LAYERS.reduce((o, k) => {
                    o[k] = MUS.lay[k] ? +MUS.lay[k].gain.value.toFixed(3) : null; return o;
                  }, {}) }),
  musicTick: (dt) => musicTick(dt),
  /* a setter, because `music` above is a getter and a probe that called
     it to switch the score off was quietly measuring the score */
  musicSet: (m) => musicMode(m),
  /* what each scene is written as, rather than what its faders happen
     to be part-way through a half-second ramp */
  score: () => ({ mix: MODE_MIX, feel: MODE_FEEL, layers: MUS_LAYERS }),
  /* Render one cue into an offline context and hand the samples back,
     so a suite can measure what nobody has been able to hear. The
     chapter's synths all hang off the module's own AC and cueGain, so
     this swaps both for offline ones, fires the cue, renders, and puts
     the real ones back exactly as they were. */
  offline(which, secs) {
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OC) return Promise.resolve(null);
    const ctx = new OC(2, Math.ceil(44100 * (secs || 1.5)), 44100);
    const keep = { AC, master, duckGain, sideGain, bedGain, cueGain, NB, muted };
    AC = ctx;
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
    duckGain = ctx.createGain(); duckGain.connect(master);
    sideGain = ctx.createGain(); sideGain.connect(duckGain);
    bedGain = ctx.createGain(); bedGain.connect(sideGain);
    cueGain = ctx.createGain(); cueGain.connect(duckGain);
    NB = noiseBuffer(3);
    muted = false;
    try {
      /* Named by what she actually hears, not by which synth function
         it happens to live in. Measuring SFX.step on its own said
         Cogsworth was a dull thump, because the tick that tells her it
         is him was never in the sample. And a bare SFX[which](1, 0)
         called the parcel cues — whose first argument is the pan —
         hard right at a gain of zero, which burst() then quietly
         replaced with its default. Both were measurement bugs, and
         both flattered the wrong answer. */
      const CUES = {
        vox: () => voxSpeak(voxPlan("I made toys. That part was true."), { gain: 1 }),
        /* the building, for comparison: he has to not sound like it */
        sys: () => annunciate("POWER AT TWENTY PERCENT", false),
        /* the last-resort voice, for a browser with no speech synthesis
           in it at all. Forced, because on anything that has one this
           path is never taken. */
        voxSynth: () => voxSpeak(voxPlan("I made toys. That part was true."),
                                 { gain: 1, forceSynth: true }),
        stepLeft:  () => SFX.step(1, TUNE.pan.left),
        stepRight: () => SFX.step(1, TUNE.pan.right),
        /* his four, exactly as cue() plays them */
        cogsworth: () => { SFX.step(1, 0); SFX.step(0.85, 0); SFX.tick(0.9, 0); },
        chime:     () => { SFX.flutter(0.8, 0); SFX.hoot(1, 0); },
        marabelle: () => SFX.tune(0.8, 1, 0),
        jax:       () => { SFX.crank(0.7, 0); SFX.bells(1, 0); },
        /* and the three the parcels make */
        drag:   () => SFX.postDrag(0, 1),
        settle: () => SFX.postSettle(0),
        handle: () => SFX.handle(0),
        doorClose: () => SFX.doorClose(),
        hatch: () => SFX.hatch(),
        knock: () => SFX.knock(0),
        monitor: () => SFX.monitor(true),
      };
      if (CUES[which]) CUES[which]();
      else if (typeof SFX[which] === "function") SFX[which](1, 0);
    } catch (e) { /* put the real context back whatever happens */ }
    const done = ctx.startRendering();
    Object.assign(
      { }, (function () {
        AC = keep.AC; master = keep.master; duckGain = keep.duckGain;
        sideGain = keep.sideGain;
        bedGain = keep.bedGain; cueGain = keep.cueGain; NB = keep.NB; muted = keep.muted;
        return {};
      })());
    return done.then((buf) => ({
      rate: buf.sampleRate,
      l: Array.from(buf.getChannelData(0)),
      r: Array.from(buf.getChannelData(1)),
    }));
  },
  vox: (t) => { const pl = voxPlan(t);
    return { dur: +pl.dur.toFixed(2),
             words: pl.words.map((w) => w.text + "@" + w.at.toFixed(2)) }; },
  wind: () => { const o = {}; CAST.forEach((d) => {
      o[d.id] = +(cast[d.id].wound || 0).toFixed(2); });
    return { wound: o, count: woundCount(), holding: G.winding,
             target: G.windTarget, t: +G.windT.toFixed(2) }; },
  /* What is actually coming out of the speakers, and why it is not.
     Every other check here runs muted, so "the sound does not work"
     was a report nothing in the repository could confirm or deny. */
  audio: () => ({
    ctx: AC ? AC.state : "none",
    muted, bedRunning: audioOn,
    master: master ? +master.gain.value.toFixed(3) : null,
    bed: bedGain ? +bedGain.gain.value.toFixed(4) : null,
    cue: cueGain ? +cueGain.gain.value.toFixed(3) : null,
    side: sideGain ? +sideGain.gain.value.toFixed(3) : null,
    duck: duckGain ? +duckGain.gain.value.toFixed(3) : null,
    music: { ready: MUS.ready, mode: MUS.mode, want: MUS.want,
             bus: MUS.bus ? +MUS.bus.gain.value.toFixed(4) : null,
             dread: +MUS.dread.toFixed(3),
             lay: MUS_LAYERS.reduce((o, k) => {
               o[k] = MUS.lay[k] ? +MUS.lay[k].gain.value.toFixed(3) : null; return o; }, {}) },
  }),
  /* the room tone off, so a suite can measure what a cue has to be
     heard over */
  bed: (on) => {
    if (!bedGain || !AC) return;
    /* setting .value does not cancel automation that is already on the
       books, and the room tone's fade-in leaves a ramp behind it */
    const t = now();
    bedGain.gain.cancelScheduledValues(t);
    bedGain.gain.setValueAtTime(on ? 0.32 : 0.0001, t);
  },
  /* take the audio session away, the way a phone call does */
  suspend: () => { if (AC && AC.suspend) AC.suspend(); },
  /* A meter on the master bus that misses nothing.

     It was an AnalyserNode being polled from the test, which reads
     whatever 46ms happens to be in its buffer at the moment it is
     asked — and a round trip out to the browser and back costs about
     two hundred milliseconds, so it was sampling at five hertz and
     stepping straight over the transients it existed to catch. A door
     shutting simply never appeared. This keeps the running peak in the
     page, so nothing gets between the sound and the measurement. */
  meter: () => {
    if (!AC) return null;
    if (!G.__meter) {
      const sp = AC.createScriptProcessor
        ? AC.createScriptProcessor(1024, 1, 1)
        : null;
      if (!sp) return null;
      G.__meter = { peak: 0, sum: 0, n: 0, node: sp };
      sp.onaudioprocess = (e) => {
        const d = e.inputBuffer.getChannelData(0);
        const m = G.__meter;
        for (let i = 0; i < d.length; i++) {
          const v = Math.abs(d[i]);
          if (v > m.peak) m.peak = v;
          m.sum += d[i] * d[i];
        }
        m.n += d.length;
      };
      /* it has to reach a destination to be pulled, but it must not be
         heard: a gain of nought on the way out */
      const mute = AC.createGain(); mute.gain.value = 0;
      master.connect(sp); sp.connect(mute); mute.connect(AC.destination);
      return { armed: true, rms: 0, peak: 0 };
    }
    const m = G.__meter;
    const out = { armed: true, peak: +m.peak.toFixed(5),
                  rms: +(m.n ? Math.sqrt(m.sum / m.n) : 0).toFixed(5) };
    m.peak = 0; m.sum = 0; m.n = 0;
    return out;
  },
  /* the shelf by the desk has to have room for everything the game can
     award, and it is the kind of thing that goes wrong silently */
  shelf: () => ({ slots: officeParts && officeParts.trophies ? officeParts.trophies.length : 0,
                  most: NIGHTS.length + NS.badges.length,
                  showing: officeParts && officeParts.trophies
                    ? officeParts.trophies.filter((t) => t.mesh.visible).length : 0 }),
  arcade: () => ({ on: ARC.on, score: ARC.score, best: ARC.best,
                   spring: +ARC.spring.toFixed(3), over: ARC.over,
                   drops: ARC.drops.length }),
  cine: () => ({ on: CINE.on, beat: CINE.beat, room: CINE.room,
                 line: CINE.line, t: +CINE.t.toFixed(1) }),
  tutor: () => ({ step: G.tutor, of: TUTOR.length,
                  line: TUTOR[G.tutor] ? TUTOR[G.tutor].line : null,
                  seen: tutorSeen() }),
  /* the six things hidden in the shop: what got placed, what is armed
     tonight, and where on the screen it currently is */
  finds: () => ({
    placed: Object.keys(findMeshes),
    armed: findRec ? findRec.id : null,
    room: findRec ? findRec.room : null,
    at: findMesh ? FIND_AT.toArray().map((n) => +n.toFixed(2)) : null,
    kept: Object.keys(foundAll()),
    why: FIND_WHY,
  }),
  /* pick tonight's up without having to find it on a camera first */
  takeFind: () => { takeFind(); return G.phase; },
  heldCard: () => { heldCard(cast.cogsworth); return G.phase; },
  /* the terms he sets on the way in */
  terms: () => ({ on: TERMS.on, line: TERMS.line, of: NS.terms.lines.length,
                  said: NS.terms.lines[TERMS.line] || null,
                  ready: TERMS.on && TERMS.line >= NS.terms.lines.length }),
  termsTick: (dt) => { termsTick(dt); return TERMS.line; },
  termsText: () => NS.terms.lines.join(" "),
  /* the tapes: what he has said tonight, and what he is saying now */
  tape: () => ({ on: TAPE.on, said: Object.keys(TAPE.said).length,
                 line: TAPE.speakT > 0 ? TAPE.line : null,
                 pending: TAPE.pending || null,
                 quiet: tapeQuiet(),
                 showing: EL["ns-tape"] ? !EL["ns-tape"].hidden : false }),
  tapeTick: (dt) => { tapeTick(dt); return TAPE.line; },
  say: (line, urgent) => say(line, urgent),
  sayTick: (dt) => sayTick(dt),
  sayClear: () => sayClear(),
  /* the speech path, which this container has no voices for */
  speak: (text) => voxSpeak(voxPlan(text), { gain: 1 }),
  voxMark: () => voxMark(),
  speech: () => ({ ok: SPEECH.ok, primed: SPEECH.primed,
                   voice: SPEECH.voice ? SPEECH.voice.name : null,
                   live: SPEECH.live, mark: SPEECH.mark }),
  pickVoices: () => { speechPick();
                      return { him: SPEECH.voice ? SPEECH.voice.name : null,
                               sys: SPEECH.sys ? SPEECH.sys.name : null }; },
  speechReset: () => { SPEECH.ok = null; SPEECH.voice = null; SPEECH.sys = null;
                       SPEECH.mark = -1; SPEECH.live = false; },
};

return { start, stop, preview, __night: testHooks,
         __three: () => ({ renderer, scene, view }) };
})();
