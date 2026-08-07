# T2FIT schedule board

Builds the class schedule boards for the screen at the gym and exports them
as images. Replaces the Canva template where names were positioned by hand.

A coach fills in sessions, coaches and members, then downloads a PNG per
board and puts it on the TV. Nothing is ever aligned manually.

## Live

https://t2-class-schedule.pages.dev, redeployed automatically on every push
to `main`. Source at https://github.com/liadavies/t2-class-schedule.

## Running it locally

The app uses ES modules and fetches its own stylesheet during export, so it
needs a web server. Opening `index.html` from the file system will not work.

```bash
npx serve .          # then open the URL it prints
```

Any static server does, including the VS Code Live Server extension.

## Deploying

Cloudflare Pages, free tier.

1. Push this folder to a GitHub repo.
2. Cloudflare dashboard, **Workers & Pages**, **Create**, **Pages**,
   **Connect to Git**, pick the repo.
3. Framework preset **None**. Build command **empty**. Output directory `/`.
4. Deploy.

Every push to `main` redeploys. You get a `*.pages.dev` URL to share.

There is no build step and no dependencies, which is the point: nothing to
break, nothing to keep up to date.

## How it fits together

```
index.html          the shell, all the editor markup
css/board.css       the board itself; also embedded into the PNG export
css/editor.css      the coach-facing interface
js/data.js          THE DATA CONTRACT plus the example schedule
js/board.js         renders a board to HTML; pure, no side effects
js/weather.js       Open-Meteo lookup and the inline SVG icons
js/export.js        PNG and JSON export
js/storage.js       keeps work in the browser between visits
js/util.js          shared helpers
js/app.js           the editor
```

The important idea is `js/data.js`. Everything the boards need is one
object. The renderer, the editor and the export all read that shape and
nothing else. Swapping where the data comes from, a server, or Mindbody,
means changing what fills that object and nothing downstream.

## Things that will bite you

**Font sizes on the board are fixed.** Nothing shrinks to make more sessions
fit. If a board holds too much, the editor warns and a session moves to
another board. Four sessions of six names fit with about 15px to spare, so
the padding values are load bearing.

**`rowHeight()` in `js/board.js` encodes padding values from
`css/board.css`.** Change cell padding or line-height in the CSS and you
must change the formula too, or the capacity warning goes quietly wrong.
This is the one fact written down twice.

**Sessions and boards are referenced by id, never by array position.** The
list re-sorts itself by time, so positions move and events land on the wrong
session. This caused a real bug where changing one session rewrote another.

**`js/board.js` must stay synchronous and free of DOM measurement.** The PNG
export renders off-screen where measurement is not available. Text is sized
from character counts for that reason.

**Weather and export both need the network.** Both fail quietly: no weather
element, or an alert offering a smaller size. The board must never show its
own plumbing on the wall.

**Images on the board have to be inlined as base64, not linked by path.** The
PNG export rasterises an SVG built from a `data:` URI, which cannot fetch
external files, the same reason fonts are inlined in `js/export.js`. The
T2FIT logo in `css/board.css` is a base64 `data:image/webp` behind
`.b-logo`, not an `<img src>`. A plain path would show on screen and export
blank.

**Escape only exits full screen once, from the browser's point of view.**
Pressing Escape while genuinely full screen is consumed by the browser to
leave full screen; the keydown never reaches the page. `js/app.js` listens
for `fullscreenchange` as well as `Escape`, so however full screen ends
(button, Escape, F11, the browser's own control) the editor comes back. If a
future change removes that listener, "Show on screen" traps the coach again.

## Storage today

Work is kept in `localStorage` on one device in one browser. Good enough for
a trial and for one coach. When two people need the same boards, replace
`js/storage.js` with calls to a server. Nothing else changes.

## Where this goes next

The gym's rosters live in Mindbody. The endpoints are `GET /class/classes`
for the day's schedule and `GET /class/classvisits` for who is booked in.
Access is free below 5,000 calls per billing cycle. That work fills the same
data object the coach fills in now, so the editor becomes the fallback and
the correction tool rather than the only way in.
