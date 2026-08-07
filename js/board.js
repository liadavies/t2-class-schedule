/* Rendering the board itself.

   Pure: give it data and it gives you HTML. It never fetches, never reads
   global state, and never measures the DOM. That matters because the PNG
   export renders off-screen, where measurement is not available. Same
   input, same output, on screen and in the image.

   INVARIANTS, please keep these true:
   - Font sizes are fixed. Nothing shrinks to make more sessions fit; if a
     board holds too much, the editor warns and a session moves elsewhere.
   - rowHeight() encodes the padding values in css/board.css. If you change
     cell padding or line-height there, change it here too, or the editor's
     capacity warning goes quietly wrong. This is the one fact written down
     in two places. */

import { esc, mins, hh12, merid, headerDate } from "./util.js";
import { wxHtml } from "./weather.js";

export const BOARD_W = 1080;
export const BOARD_H = 1920;
const ROW_GAP = 18;           // matches .b-rows gap in css/board.css

export const rowHeight = n => Math.round(94 + 42.7 * Math.max(1, n));

/* A class name shown instead of a roster gets sized to fit its box rather
   than wrapped mid-word. Worked out from character counts, not measured. */
export function labelSize(text, wide){
  const boxW = wide ? 694 : 202;                       // content width in px
  const longest = Math.max(...String(text).split(/\s+/).map(w => w.length), 1);
  let size = wide ? 46 : 38;                           // above the 37px names, not a headline
  while(size > 20 && longest * (size * 0.62 + 1.5) > boxW) size -= 2;
  return size;
}

/* Same idea for rosters, applied to the whole column so every name in a
   class matches. One long name shrinks its class a little; it never breaks.
   The 0.61 is an approximation of Barlow's uppercase advance width. If a
   name still clips, that is the number to nudge. */
export function namesSize(names){
  const longest = Math.max(1, ...names.map(n =>
    Math.max(...String(n).split(/\s+/).map(w => w.length))));
  let size = 37;
  while(size > 24 && longest * (size * 0.61 + 0.8) > 202) size -= 1;
  return size;
}

function cellHtml(col, wide){
  if(!col || !col.coach) return `<div class="b-cell empty"></div>`;
  const isLabel = col.label !== undefined && col.label !== null;
  let body;
  if(isLabel){
    body = `<div class="b-label" style="font-size:${labelSize(col.label, wide)}px">${esc(col.label)}</div>`;
  } else {
    const names = col.names || [];
    const sz = namesSize(names);
    body = `<ul class="b-names"${sz < 37 ? ` style="font-size:${sz}px"` : ""}>`
         + names.map(n => `<li>${esc(n)}</li>`).join("") + `</ul>`;
  }
  return `<div class="b-cell filled${wide ? " wide" : ""}">`
       + `<div class="b-coach">COACH ${esc(col.coach)}</div>${body}</div>`;
}

export function boardHtml(data, board, wx, now = new Date()){
  const list  = board.sessions.slice().sort((a, z) => mins(a.time) - mins(z.time));
  const badge = list.length ? merid(list[0].time) : "AM";

  const rows = list.map(s => {
    const filled  = s.columns.filter(c => c && c.coach);
    const groups  = filled.length;
    // One class on its own, shown by name, gets the whole width. A single
    // roster stays in its column: a list is easier to scan down than across.
    const solo    = groups === 1 && filled[0].label !== undefined && filled[0].label !== null;
    const tallest = Math.max(1, ...s.columns.map(c => c && c.names ? c.names.length : 2));
    const body    = solo
      ? cellHtml(filled[0], true)
      : [0,1,2].map(k => cellHtml(s.columns[k], false)).join("");
    return `<div class="b-row" style="flex:${tallest+2} 1 0;min-height:${rowHeight(tallest)}px">
      <div class="b-slot">
        <div><div class="hr">${hh12(s.time)}</div><div class="mer">${merid(s.time)}</div></div>
        <div class="grp">${groups} GROUP${groups === 1 ? "" : "S"}</div>
      </div>${body}
    </div>`;
  }).join("");

  return `
    <div class="b-top">
      <div>
        <div class="b-logo">T2FIT</div>
        <div class="b-sub">${esc(board.name)} SCHEDULE</div>
      </div>
      <div class="b-right">
        <div class="b-meta">${wxHtml(wx)}<div class="b-badge"><i></i>${badge}</div></div>
        <div class="b-site">${esc(data.site)}</div>
        <div class="b-date">${headerDate(now)}</div>
      </div>
    </div>
    <div class="b-rule"></div>
    <div class="b-focus">
      <div class="tag">FOCUS OF THE WEEK</div>
      <div class="val">${esc(data.focus)}</div>
    </div>
    <div class="b-rows">${rows}</div>
    <div class="b-foot">${esc(data.footer)}</div>`;
}

export function renderBoard(target, data, board, wx, now = new Date()){
  target.innerHTML = boardHtml(data, board, wx, now);
}

/* How much room the rows need versus what they have. Rows carry a
   min-height so they keep their size and the container clips, which makes
   this a reliable measurement where scrollHeight is not. */
export function overflowPx(boardEl){
  const rowsEl = boardEl.querySelector(".b-rows");
  if(!rowsEl || !rowsEl.children.length) return 0;
  const kids = [...rowsEl.children];
  const need = kids.reduce((a, el) => a + el.offsetHeight, 0) + (kids.length - 1) * ROW_GAP;
  return need - rowsEl.clientHeight;
}
