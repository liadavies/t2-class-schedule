# Notes for Claude Code

Read `README.md` first, particularly "Things that will bite you".

## What this is

A static site that builds gym schedule boards and exports them as PNGs for a
TV on the wall. No build step, no dependencies, no framework. Keep it that
way unless there is a real reason not to.

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

## Good next tasks

1. Load a board from a server instead of `localStorage`, so several coaches
   share one schedule. `js/storage.js` is the only file that should change.
2. Pull rosters from Mindbody into the same data shape. See README.
3. A day picker, so boards can be prepared ahead rather than only for today.
