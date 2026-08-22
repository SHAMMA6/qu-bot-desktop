# QU Bot

A desktop mascot in the Grok Bot style — a solid vector blob with two expressive
eyes, no mouth, no outline.

It **floats** above your desktop and pays attention to what you are doing. It
drifts near whatever you are pointing at, keeps clear of your cursor, gets out of
the way when you swipe at it, backs off and perches beside your window while you
type, follows you when you move to your other monitor, and reacts when you switch
apps. Poke it, tickle it, pet it, or grab it out of the air and throw it.

![QU Bot](assets/icon.png)

---

## Install

**Windows 10 / 11.** Download the latest build from the
[Releases page](https://github.com/SHAMMA6/qu-bot-desktop/releases/latest):

| File | What it is |
| --- | --- |
| `QU-Bot-<version>-Setup.exe` | Installer — Start-menu and desktop shortcuts, and a normal uninstall entry |
| `QU-Bot-<version>-portable.exe` | One file, no install. Double-click it and the bot appears |

Nothing else is needed — Node and Electron are bundled inside.

The builds are not code-signed, so the first launch shows SmartScreen's
*"Windows protected your PC"*. Click **More info → Run anyway**. Silencing that
permanently needs a paid code-signing certificate.

Once running it lives in the system tray — right-click the tray icon for
settings, or press `Ctrl` + `Alt` + `B` to summon it to your cursor.

## Running from source

Needs [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/SHAMMA6/qu-bot-desktop.git
cd qu-bot-desktop
npm install
npm start
```

Build your own installer and portable build into `dist/`:

```bash
npm run build
```

## What it does

**42 emotions**, each a complete performance rather than just a face — its own eye
geometry, breathing rate, posture, lean, blink rhythm, eyelid droop, gaze
behaviour, jitter and particle effect.

| Group | Emotions |
| --- | --- |
| Everyday | idle, neutral, happy, content, listening, talking |
| Delighted | excited, smitten, laughing, celebrating, proud, smug, wink, shy |
| Attentive | curious, confused, thinking, focused, working, alert |
| Startled | surprised, shocked, scared, dizzy |
| Low | sad, pleading, bored, sleepy, asleep |
| Spiky | annoyed, angry, skeptical, glitched |
| Glances | look left / right / up / down, peeking |
| Physical | held, falling, squished, walking |

![The 42 expressions](assets/emotions.png)

*Eye geometry only — the posture, eyelid droop, motion and effects that carry
most of each emotion do not survive a still frame.*

**18 body shapes** — blob, pebble, bean, egg, squircle, tablet, capsule, cylinder,
hex, gem, crystal, wedge, shield, dome, arch, cloud, teardrop, leaf. Each carries
its own face-fitting transform, so the eyes sit correctly on a narrow capsule and
a wide cloud alike.

**11 coats** plus any custom colour. The eye colour is derived from the coat's
luminance, so a custom colour never produces unreadable eyes.

## Interactions

On the mascot:

| Action | Result |
| --- | --- |
| Click | Poke it — it startles, bounces, and sometimes complains |
| Double-click | Gets it talking |
| Drag | Pick it up; flick to throw it across the screen |
| Hover and wiggle | Tickle it |
| Hover and stroke | Pet it — repeat and it grows fond of you |
| Swipe fast at it | It dodges — approach slowly to catch it |
| Right-click | Full menu: feelings, shape, colour, size, behaviour |
| Scroll | Resize |
| Shift + scroll | Cycle body shape |

Anywhere:

| Shortcut | Result |
| --- | --- |
| `Ctrl` + `Alt` + `B` | Summon it to your cursor |
| `Ctrl` + `Alt` + `H` | Hide / show |
| `Ctrl` + `Alt` + `C` | Celebrate |

It also greets you by time of day, notices when you have been gone a while,
marks the hour, occasionally suggests you take a break, and gets bored if
ignored for long enough. On a multi-monitor desk it will occasionally announce
that it is off to check the other screen, and hop over.

## Watching what you do

This is the part that makes it feel present rather than decorative. It reads
three streams and picks a *stance* from them:

| Stance | When | What it does |
| --- | --- | --- |
| Shoulder | You are using the mouse | Hovers a body-width off where the pointer **landed** — not trailing every sweep |
| Perch | You are typing | Backs off and parks beside the window you are working in |
| Dodge | You swipe fast at it | Gets out of the way |
| Roam | You are idle | Drifts gently around the screen |
| Edge | Typing, with no window info | Tucks against a screen edge |

It tells typing from mousing by noticing that the OS reports input while the
cursor is parked — so while you are writing, it goes quiet and moves aside
instead of hovering over your text.

Two rules always hold, and are enforced together rather than in sequence: **never
sit on top of the cursor**, and **never pick a spot that is off-screen**. Near a
screen edge those two fight, so it searches around the cursor for the spot with
the most clearance that still fits.

It dodges a *fast* swipe but not a slow, deliberate approach — because a slow
approach is you reaching out to pick it up, and that has to work.

### Privacy

If **Notice the app in front** is on, a small PowerShell helper reports which
window is focused and where it sits. The window title is used only to notice that
something changed; only the coarse kind of app is ever surfaced ("your editor",
"the browser"), never the title itself. Nothing is written to disk, nothing is
sent anywhere, and turning the setting off stops the helper entirely. The script
it runs is written in the clear to `%APPDATA%/QU Bot/activity-watch.ps1` so you
can read exactly what it does.

## How it behaves on its own

A small set of slow meters — energy, mood, boredom, affection — decide what it
does when you leave it alone. It might glance around, muse aloud, do a barrel
roll, drift to the other monitor, or doze off. Poking it repeatedly annoys it;
petting it makes it fond of you. Energy drains over a few hours awake and refills
as it sleeps.

Flight has weight: it banks into its turns, leans as it accelerates, overshoots
slightly and settles, and carries a small faint shadow well below it. Catch it
and throw it and the throw is ballistic — it tumbles, bounces off the edges of
the screen, and then recovers into powered flight rather than dropping.

Turn **Gravity** on and it becomes the other thing entirely: a grounded desk pet
that falls, lands with a squash, walks along the bottom of your screen, and sits
above the taskbar.

## Architecture

```
src/
  main/                  Electron main process (CommonJS)
    main.cjs             Overlay window, cursor + idle feeds, tray, shortcuts
    menus.cjs            Tray and right-click menus
    awareness.cjs        Foreground-window watcher (opt-out, local only)
    store.cjs            Debounced JSON settings in userData
    preload.cjs          The mascot window's IPC bridge
    preload-settings.cjs The settings window's IPC bridge
  renderer/              (ES modules)
    mascot.html/css/js   The mascot loop
    settings.html/css/js Settings window with a live preview
    lib/
      mark.js            Body + eye rendering
      emotions.js        The 42-emotion table
      behavior.js        Autonomy: meters and action selection
      attention.js       Where it wants to be, and what it noticed you doing
      physics.js         Flight, drag, throw, gravity, bounce, multi-display
      particles.js       17 canvas effect emitters
      bubble.js          Speech bubbles
      dialogue.js        What it says
      geom.js            Easing, noise, ring maths
  shared/
    mascot-data.js       18 shape paths + 25 expression eye-rings
    themes.js            Coats and luminance-derived eye colour
tools/
  make-icons.cjs         Renders app + tray icons from the shape paths
  make-sheet.cjs         Contact sheets of expressions / shapes / emotions
  validate.mjs           Character-data integrity checks
  test-displays.mjs      Multi-monitor + flight physics simulation
  test-attention.mjs     Attention rules: clearance, dodging, perching
```

### The window

The mascot lives in a transparent, click-through window that covers exactly one
display and follows the body between them. Inside that window nothing moves the
window itself — the body is positioned by CSS transform, which is what keeps a
throw smooth at 60fps.

Covering *every* display with one big window is the obvious design and it is
wrong: a window has a single `devicePixelRatio`. On a desktop that mixes 100%
and 150% scaling, one spanning window renders correctly on one monitor and at
the wrong size and sharpness on the other, and no amount of coordinate maths
fixes it. Confining the window to one display at a time means every monitor gets
its own native pixel density.

Because the window covers a whole display, it is created with
`setIgnoreMouseEvents(true, { forward: true })` and only becomes interactive for
the moments the cursor is actually over the body or a visible speech bubble. It
is also non-focusable, so clicking the mascot never steals focus from whatever
you are working in.

### Multiple monitors

Physics runs in absolute desktop coordinates and knows every display's work
area, so the mascot is not confined to one screen:

- **Throw it across.** A hard flick carries it over the bezel onto the next
  monitor. The window hands over the instant the body's centre crosses, which is
  decided in the renderer rather than the main process so a fast throw does not
  outrun a round trip.
- **It rests on the right floor.** Each monitor has its own work area, so it
  sits on the bottom of whichever screen it is on, above that screen's taskbar —
  even when the monitors are different heights or vertically offset.
- **It never parks across a bezel**, and never comes to rest somewhere you
  cannot see it.
- **Stacked monitors work too.** With one screen above another the desktop is
  continuous top to bottom, so it can be launched up into the screen above and
  will fall back down through the seam.
- **Walking stays on one screen.** Strolling across a bezel would leave the body
  clipped by the screen edge for over a second, so crossings are always a quick
  hop — either from `travelTo`, a throw, or `Ctrl` + `Alt` + `B`.
- **Unplug a monitor** and it walks back onto a screen that still exists;
  change a resolution under it and it re-settles.
- The effects canvas is re-backed at the new pixel density on every crossing, so
  particles stay sharp on a 150% display too.

`npm test` simulates all of this headlessly across six monitor layouts —
side-by-side, mixed-DPI with a vertical offset, second-monitor-on-the-left,
stacked, three-monitor, and single — because these are the cases you cannot
check without physically owning the hardware. The attention rules are simulated
the same way.

### How expressions work

Each expression is two closed rings of 48 points. Because every expression has an
identical point count, any two can be interpolated point-for-point — so changing
emotion is a genuine morph of one eye shape into another rather than a swap. The
eyes are clipped to the body silhouette, which is why expressions that sit near
the edge read as half-lidded glances.

Blinking is separate from expression: a vertical squash about each eye's own
centroid, layered on top of a per-emotion constant droop (`lidBias`). That means
a sleepy blink closes from an already half-shut eye, and one mechanism covers
every expression.

### Rendering cost

The body is a handful of SVG attribute writes per frame. Particles draw into a
bounded 720×720 canvas that rides along with the body, so canvas cost does not
scale with desktop size, and the canvas is skipped entirely when no effects are
alive. The loop drops to 30fps while the mascot is asleep or you are away.

## Development

```bash
npm test                                     # data checks + multi-monitor sim
npm run dev                                  # with devtools
node tools/make-icons.cjs                    # regenerate app + tray icons
node tools/make-sheet.cjs expressions        # contact sheet -> .ref/
```

There is also a headless capture path used to check the art without a human at
the screen:

```bash
npx electron . "--shot=out.png,2500" "--shot-rect=0,90,400,330"
```

Add `--shot-do-file=<path>` to drive it first — the script runs in the mascot
window with `window.__qubot` in scope, e.g.
`window.__qubot.pose({ x: 200, y: 210, emotion: 'love', text: 'hello.' })`.
With `--dev`, display handoffs are logged as the window moves between monitors.

## Credits

The character's geometry — 18 body shapes, 25 expression eye-rings, the
per-shape face-fitting transforms and the gold star — follows the Grok Bot mark
published at [x.ai](https://x.ai). Everything else here (the emotion system,
autonomy, physics, effects, dialogue and app shell) is original.
