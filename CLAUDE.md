# Notes for Claude Code

Read `README.md` first, particularly "Things that will bite you".

## What this is

A static site that builds gym schedule boards and exports them as PNGs for a
TV on the wall. No build step, no dependencies, no framework. Keep it that
way unless there is a real reason not to.

## Status

As of 2026-08-07: live at https://t2-class-schedule.pages.dev, redeployed
automatically from `main` on every push. Source at
https://github.com/liadavies/t2-class-schedule.

Completed so far: git set up and pushed; Cloudflare Pages configured; the
board's T2FIT text replaced with the logo image, inlined as base64 in
`css/board.css` so the PNG export still carries it; "Show on screen" given a
working way out (button, Escape and the browser's own fullscreen exit all
return to the editor); the Settings panel signposted with a toolbar button
and a restyled, subtitled summary, so a coach with no familiarity with the
app can find where the gym gets configured.

## Rules

- **Never shrink the board's font sizes to make content fit.** Names are
  37px and coaches 36px so they are legible from across a gym floor. If
  something does not fit, the answer is fewer sessions per board or a
  warning, never smaller type.
- **`js/board.js` stays pure.** No fetch, no globals, no `getBoundingClientRect`.
  It renders the same HTML on screen and inside the off-screen PNG export.
  Text is sized from character counts because measurement is unavailable there.
- **Never reference sessions or boards by array index.** Use their `id`.
  The list re-sorts by time.
- **Keep `rowHeight()` in `js/board.js` in step with the padding in
  `css/board.css`.** They encode the same fact.
- **Failures are silent on the board, loud in the editor.** A member reading
  the wall should never see an error state.
- **British English** in user-facing text. No em dashes.

## Conventions

- Times are 24-hour `"HH:MM"` strings. AM/PM is always derived.
- Names and coaches are stored uppercase, as displayed.
- A column is `null`, or `{coach, names[]}`, or `{coach, label}`. A label
  means the class is shown by name with no roster, for large classes like
  Hybrid and Functional Strength.

## Next up

Today or Tomorrow, not a full date picker. The use case is prepping boards
the night before for the next day, so a two-way toggle is enough; do not
build a calendar for this.

Where it hooks in:
- `boardHtml()` and `renderBoard()` in `js/board.js` already take an
  optional `now`, defaulting to `new Date()`, used only for `headerDate()`
  in `js/util.js`. That is where "tomorrow" would flow in.
- `js/export.js`'s `pngBlob()` calls `boardHtml()` without passing `now`, so
  exports always use the real date regardless of what the preview shows.
  That needs wiring through too, or a "Tomorrow" board would export with
  today's date on it.
- `js/weather.js` requests `forecast_days=1`, today's high only. Whether a
  "Tomorrow" board shows tomorrow's forecast, or hides weather, is an open
  product question, not decided yet.

## Good next tasks

1. Load a board from a server instead of `localStorage`, so several coaches
   share one schedule. `js/storage.js` is the only file that should change.
2. Pull rosters from Mindbody into the same data shape. See README.
3. Merge "Open a file" and "Save a copy" into one Open/Save button with a
   popup that explains what each does, for a coach who has never seen the
   toolbar before. Today they are two separate, unexplained handlers in
   `js/app.js`: `btnSave` calls `exportJson(DATA)` from `js/export.js`
   straight off, no confirmation; `btnOpen` just clicks the hidden
   `fileInput`, whose `onchange` parses the JSON and falls back to
   `alert("That file doesn't look like a T2FIT schedule.")` on a bad file.
   The popup is new UI, not a rewrite of that logic; keep the two existing
   handlers and call them from whichever option the coach picks.
