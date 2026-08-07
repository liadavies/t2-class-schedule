/* The editor. Everything a coach touches.

   Rule that has bitten us before: sessions and boards are referenced by a
   stable id, never by array position. The list re-sorts itself by time, so
   positions move under your feet and events land on the wrong session. */

import { $, esc, mins, hh12, merid, fmt, titleCase } from "./util.js";
import { DEFAULT_DATA, CAP, normalise } from "./data.js";
import { renderBoard, overflowPx, BOARD_W, BOARD_H } from "./board.js";
import { fetchWeather, geocode } from "./weather.js";
import { exportBoards, exportJson } from "./export.js";
import * as store from "./storage.js";

let DATA = normalise(store.load() || DEFAULT_DATA);
let WX = null;                   // runtime only, never saved
let activeBoard = DATA.boards[0].id;
let pendingFocus = null;
let uid = 0;
const newId = p => p + "_" + Date.now().toString(36) + (++uid);

DATA.boards.forEach(b => b.sessions.forEach(s => { if(!s.id) s.id = newId("s"); }));

const board   = id => DATA.boards.find(b => b.id === id);
const cur     = () => board(activeBoard) || DATA.boards[0];
const sess    = id => { for(const b of DATA.boards){ const s = b.sessions.find(x => x.id === id); if(s) return s; } };
const boardOf = id => DATA.boards.find(b => b.sessions.some(s => s.id === id));

const persist = () => store.save(DATA);

/* ---------- scaling ---------- */
function fitTv(){
  const w = document.documentElement.clientWidth  || innerWidth;
  const h = document.documentElement.clientHeight || innerHeight;
  const s = Math.min(w/BOARD_W, h/BOARD_H);
  $("tvStage").style.transform =
    `translate(${(w-BOARD_W*s)/2}px, ${(h-BOARD_H*s)/2}px) scale(${s})`;
}
function fitPreview(){
  const box = $("preview");
  if(!box || !box.offsetWidth) return;
  const s = box.offsetWidth / BOARD_W;
  box.style.height = (BOARD_H * s) + "px";
  box.querySelector(".stage").style.transform = `scale(${s})`;
}

/* ---------- board tabs ---------- */
function drawBoards(){
  $("boards").innerHTML = DATA.boards.map(b =>
      `<button class="btab ${b.id===activeBoard?"on":""}" data-b="${b.id}">${esc(b.name)}<span class="n">${b.sessions.length}</span></button>`
    ).join("")
    + `<button class="btab" data-newb="1">+ Add board</button>`
    + (DATA.boards.length > 1 ? `<button class="btab" data-delb="${activeBoard}">Delete this board</button>` : "");

  $("bname").value = cur().name;

  // labels follow the selected board, so it's always clear what you'll get
  const name = cur().name || "UNNAMED";
  $("bnameNote").innerHTML =
    `Shown on the TV as <strong>"${esc(name)} SCHEDULE"</strong>. `
    + `Make one board per image you put up during the day.`;

  const one = $("btnPng");
  if(one && !one.disabled) one.textContent = `Download ${titleCase(name)} image`;

  const all = $("btnPngAll");
  if(all && !all.disabled){
    all.style.display = DATA.boards.length > 1 ? "" : "none";
    all.textContent = `Download all ${DATA.boards.length} images`;
  }
}

/* ---------- sessions ---------- */
function drawEditor(){
  $("focus").value = DATA.focus;
  const b = cur();
  activeBoard = b.id;
  b.sessions.forEach(s => { if(!s.id) s.id = newId("s"); });
  b.sessions.sort((x, y) => mins(x.time) - mins(y.time));

  drawBoards();

  const moves = DATA.boards.filter(o => o.id !== b.id);
  $("sessions").innerHTML = b.sessions.map(s => {
    const filled = s.columns.filter(c => c && c.coach).length;
    return `<div class="session" data-sid="${s.id}">
      <div class="head">
        <input type="time" data-t="${s.id}" value="${s.time}" aria-label="Start time">
        <span class="pill">${merid(s.time)}</span>
        <span class="pill">${filled} group${filled===1?"":"s"}</span>
        <span class="spacer"></span>
        ${moves.length ? `<select data-mv="${s.id}" aria-label="Move to another board">
          <option value="">Move to&#8230;</option>
          ${moves.map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join("")}
        </select>` : ""}
        <button class="btn tiny" data-ins="${s.id}:before">Add before</button>
        <button class="btn tiny" data-ins="${s.id}:after">Add after</button>
        <button class="btn ghost" data-del="${s.id}">Remove</button>
      </div>
      <div class="cols">${[0,1,2].map(k => colHtml(s.columns[k], s.id, k)).join("")}</div>
    </div>`;
  }).join("") || `<p class="note" style="margin:0 0 14px">No sessions on this board yet.</p>`;

  paint();

  if(pendingFocus){
    const el = $("sessions").querySelector(`[data-sid="${pendingFocus}"]`);
    pendingFocus = null;
    if(el){
      el.classList.add("added");
      el.scrollIntoView({ behavior:"smooth", block:"center" });
      const sel = el.querySelector("select");
      if(sel) sel.focus();
      setTimeout(() => el.classList.remove("added"), 2500);
    }
  }
}

function colHtml(col, sid, k){
  const coach   = col?.coach || "";
  const isLabel = !!(col && col.label !== undefined && col.label !== null);
  const names   = (col?.names || []).join("\n");
  const n       = (col?.names || []).length;
  // include an assigned coach even if they've been taken off the list,
  // so removing someone never silently wipes their sessions
  const list    = coach && !DATA.coaches.includes(coach) ? [...DATA.coaches, coach] : DATA.coaches;
  const opts    = ["", ...list].map(c =>
    `<option value="${esc(c)}"${c===coach?" selected":""}>${c ? esc(c) : "\u2014 no coach \u2014"}</option>`).join("");

  return `<div class="col ${coach?"on":""}">
    <div class="top"><select data-c="${sid}|${k}" aria-label="Coach">${opts}</select></div>
    <div class="${coach?"":"hidden"}">
      ${isLabel
        ? `<label class="fld">Class name shown instead of members</label>
           <input type="text" data-l="${sid}|${k}" value="${esc(col.label)}" placeholder="e.g. HYBRID">`
        : `<label class="fld">One name per line</label>
           <textarea data-n="${sid}|${k}" placeholder="LIAM&#10;ALAN&#10;YASH">${esc(names)}</textarea>`}
      <div class="count ${!isLabel && n>CAP ? "over" : ""}">
        <span>${isLabel ? "Members are not listed" : `${n} of ${CAP}${n>CAP ? ", over capacity" : ""}`}</span>
        <button class="tog" data-tog="${sid}|${k}">${isLabel ? "List members" : "Class name only"}</button>
      </div>
    </div>
  </div>`;
}

function paint(){
  renderBoard($("pvBoard"), DATA, cur(), WX);
  fitPreview();
  checkFit();
  persist();
}

function checkFit(){
  const over = overflowPx($("pvBoard"));
  const w = $("warn");
  if(over > 2){
    const others = DATA.boards.filter(b => b.id !== activeBoard).map(b => b.name);
    w.classList.remove("hide");
    w.innerHTML = `This board needs about ${Math.ceil(over)}px more room than the screen has, `
      + `so the bottom session is being cut off. Move one${others.length ? " to " + others.join(" or ") : " to another board"}, `
      + `or take a name out of the fullest class.`;
  } else {
    w.classList.add("hide");
  }
}

/* ---------- settings ---------- */
function parseCoaches(v){
  const out = [];
  v.split(/[\n,]+/).map(x => x.trim().toUpperCase()).filter(Boolean)
    .forEach(c => { if(!out.includes(c)) out.push(c); });
  return out;
}

function coachUsage(){
  const use = {};
  DATA.boards.forEach(b => b.sessions.forEach(s => s.columns.forEach(c => {
    if(c && c.coach) use[c.coach] = (use[c.coach] || 0) + 1;
  })));
  return use;
}

function drawCoachNote(){
  const use = coachUsage();
  const missing = Object.keys(use).filter(c => !DATA.coaches.includes(c));
  const listed = DATA.coaches.map(c => `${c} ${use[c] || 0}`).join(", ");
  $("coachNote").innerHTML =
    (DATA.coaches.length ? `Sessions each coach is on: ${listed}.`
                         : `No coaches yet, so the dropdowns will be empty.`)
    + (missing.length
      ? `<br><strong style="color:#B3261E">${missing.join(" and ")} ${missing.length>1?"are":"is"} `
        + `no longer on the list but still assigned to sessions. Those keep their coach until you change them.</strong>`
      : "");
}

function drawWeatherSettings(){
  const w = DATA.weather;
  $("wxon").checked = !!w.enabled;
  $("wxplace").value = w.place || "";
  $("wxNote").innerHTML = !w.enabled
    ? "Weather is hidden."
    : (w.lat == null
        ? "Type a town and press Look up."
        : `Showing today's high for <strong>${esc(w.place)}</strong>. `
          + `A high stays true all day, so the image doesn't go stale on the wall.`);
}

function drawSettings(){
  const w = Math.round(DATA.export.width);
  $("coaches").value = DATA.coaches.join("\n");
  drawCoachNote();
  drawWeatherSettings();
  $("site").value = DATA.site;
  $("foot").value = DATA.footer;
  const preset = ["1080","1440","2160"].includes(String(w)) ? String(w) : "custom";
  $("expw").value = preset;
  $("customWrap").classList.toggle("hidden", preset !== "custom");
  $("expc").value = w;
  $("expNote").innerHTML =
    `Images export at <strong>${w} &#215; ${Math.round(w*16/9)}</strong> pixels. Match your TV so it isn't rescaling. `
    + `A 4K screen turned portrait is 2160 &#215; 3840.`
    + (w > 2160 ? ` <br>Above 4K, some phones and tablets run out of memory and the export fails.` : "");
}

function setExportWidth(w){
  DATA.export.width = Math.max(720, Math.min(3840, Math.round(w) || 2160));
  drawSettings();
  persist();
}

/* ---------- events, all resolved by id ---------- */
function ref(v){ const [id,k] = v.split("|"); return { s: sess(id), k: +k }; }
function ensure(s,k){ if(!s.columns[k]) s.columns[k] = { coach:"", names:[] }; return s.columns[k]; }

document.addEventListener("input", e => {
  const t = e.target;
  if(t.id === "focus"){ DATA.focus = t.value.toUpperCase(); paint(); return; }
  if(t.id === "bname"){ cur().name = t.value.toUpperCase(); drawBoards(); paint(); return; }
  if(t.id === "site"){ DATA.site = t.value.toUpperCase(); paint(); return; }
  if(t.id === "foot"){ DATA.footer = t.value.toUpperCase(); paint(); return; }
  if(t.id === "expc"){ setExportWidth(+t.value); return; }
  if(t.id === "coaches"){
    // don't redraw settings here, it would reset the cursor mid-typing
    DATA.coaches = parseCoaches(t.value);
    drawCoachNote();
    drawEditor();
    return;
  }
  if(t.dataset.n){
    const {s,k} = ref(t.dataset.n); if(!s) return;
    const col = ensure(s,k);
    col.names = t.value.split("\n").map(x => x.trim().toUpperCase()).filter(Boolean);
    delete col.label;
    const c = t.closest(".col").querySelector(".count");
    c.classList.toggle("over", col.names.length > CAP);
    c.querySelector("span").textContent =
      `${col.names.length} of ${CAP}${col.names.length>CAP ? ", over capacity" : ""}`;
    paint();
  }
  if(t.dataset.l){
    const {s,k} = ref(t.dataset.l);
    if(s) ensure(s,k).label = t.value.toUpperCase();
    paint();
  }
});

document.addEventListener("change", e => {
  const t = e.target;
  if(t.id === "expw"){
    if(t.value === "custom"){ $("customWrap").classList.remove("hidden"); $("expc").focus(); }
    else setExportWidth(+t.value);
    return;
  }
  if(t.id === "wxon"){
    DATA.weather.enabled = t.checked;
    drawWeatherSettings(); persist(); refreshWeather();
    return;
  }
  if(t.dataset.t){ const s = sess(t.dataset.t); if(s){ s.time = t.value; drawEditor(); } }
  if(t.dataset.c){
    const {s,k} = ref(t.dataset.c); if(!s) return;
    if(!t.value) s.columns[k] = null; else ensure(s,k).coach = t.value;
    drawEditor();
  }
  if(t.dataset.mv && t.value){
    const s = sess(t.dataset.mv), from = boardOf(t.dataset.mv), to = board(t.value);
    if(s && from && to){
      from.sessions = from.sessions.filter(x => x.id !== s.id);
      to.sessions.push(s);
      drawEditor();
    }
  }
});

document.addEventListener("click", e => {
  const t = e.target.closest("button");
  if(!t) return;

  if(t.dataset.b){ activeBoard = t.dataset.b; drawEditor(); return; }
  if(t.dataset.newb){
    const b = { id:newId("b"), name:"NEW BOARD", sessions:[] };
    DATA.boards.push(b); activeBoard = b.id; drawEditor();
    $("bname").focus(); $("bname").select();
    return;
  }
  if(t.dataset.delb){
    const b = board(t.dataset.delb);
    if(b && confirm(`Delete the ${b.name} board and its ${b.sessions.length} session(s)?`)){
      DATA.boards = DATA.boards.filter(x => x.id !== b.id);
      activeBoard = DATA.boards[0].id;
      drawEditor();
    }
    return;
  }
  if(t.dataset.ins){ const [id, where] = t.dataset.ins.split(":"); insertSession(id, where); return; }
  if(t.dataset.del){
    const s = sess(t.dataset.del), b = boardOf(t.dataset.del);
    if(s && b && confirm(`Remove the ${hh12(s.time)} ${merid(s.time)} session?`)){
      b.sessions = b.sessions.filter(x => x.id !== s.id);
      drawEditor();
    }
    return;
  }
  if(t.dataset.tog){
    const {s,k} = ref(t.dataset.tog); if(!s) return;
    const col = ensure(s,k);
    if(col.label !== undefined && col.label !== null){ delete col.label; col.names = col.names || []; }
    else col.label = "HYBRID";
    drawEditor();
  }
});

/* preview follows the board you're editing */
document.addEventListener("focusin", e => {
  const el = e.target.closest("[data-t],[data-c],[data-n],[data-l]");
  if(!el) return;
  const key = el.dataset.t ?? el.dataset.c ?? el.dataset.n ?? el.dataset.l;
  const b = boardOf(String(key).split("|")[0]);
  if(b && b.id !== activeBoard){ activeBoard = b.id; drawEditor(); }
});

/* ---------- adding sessions ---------- */
function insertSession(id, where){
  const b = boardOf(id); if(!b) return;
  const list = b.sessions;
  const i = list.findIndex(s => s.id === id); if(i < 0) return;
  const t = mins(list[i].time);
  let nt;
  if(where === "after"){
    const next = list[i+1] ? mins(list[i+1].time) : null;
    nt = (next === null || next > t + 60) ? t + 60 : t + Math.max(5, Math.round((next - t)/2));
  } else {
    const prev = list[i-1] ? mins(list[i-1].time) : null;
    nt = (prev === null || prev < t - 60) ? t - 60 : t - Math.max(5, Math.round((t - prev)/2));
  }
  addSessionAt(b, fmt(nt));
}

function addSessionAt(b, time){
  while(b.sessions.some(s => s.time === time)) time = fmt(mins(time) + 5);
  const s = { id:newId("s"), time, columns:[null,null,null] };
  b.sessions.push(s);
  pendingFocus = s.id;
  drawEditor();
}

/* ---------- weather ---------- */
async function refreshWeather(){
  WX = await fetchWeather(DATA.weather);
  paint();
}

async function lookupPlace(){
  const q = $("wxplace").value.trim();
  if(!q) return;
  $("wxNote").textContent = "Looking up\u2026";
  try{
    const hit = await geocode(q);
    if(!hit){ $("wxNote").textContent = `Couldn't find "${q}". Try a nearby town.`; return; }
    DATA.weather = { enabled:true, ...hit };
    drawWeatherSettings(); persist();
    await refreshWeather();
  } catch(e){
    $("wxNote").textContent = "Couldn't reach the weather service just now.";
  }
}

/* ---------- toolbar ---------- */
$("btnAdd").onclick = () => {
  const b = cur();
  const last = b.sessions[b.sessions.length - 1];
  addSessionAt(b, last ? fmt(mins(last.time) + 60) : "06:00");
};

async function runExport(boards, btn){
  const was = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Making images\u2026";
  const err = await exportBoards(DATA, boards, WX);
  btn.disabled = false;
  btn.textContent = was;
  if(err) alert(err);
}

$("btnPng").onclick    = () => runExport([cur()], $("btnPng"));
$("btnPngAll").onclick = () => runExport(DATA.boards, $("btnPngAll"));
$("btnSave").onclick   = () => exportJson(DATA);
$("wxlook").onclick    = lookupPlace;

$("btnOpen").onclick = () => $("fileInput").click();
$("fileInput").onchange = async e => {
  const f = e.target.files[0];
  if(!f) return;
  try{
    DATA = normalise(JSON.parse(await f.text()));
    DATA.boards.forEach(b => b.sessions.forEach(s => { if(!s.id) s.id = newId("s"); }));
    activeBoard = DATA.boards[0].id;
    drawSettings(); drawEditor(); refreshWeather();
  } catch(err){
    alert("That file doesn't look like a T2FIT schedule.");
  }
  e.target.value = "";
};

$("btnReset").onclick = () => {
  if(!confirm("Start again from the example schedule? Anything you've typed will be lost.")) return;
  store.clear();
  DATA = normalise(DEFAULT_DATA);
  DATA.boards.forEach(b => b.sessions.forEach(s => { if(!s.id) s.id = newId("s"); }));
  activeBoard = DATA.boards[0].id;
  drawSettings(); drawEditor(); refreshWeather();
};

/* Always opens rather than toggles, so a coach who cannot see the panel never
   presses this and watches nothing happen. */
$("btnSettings").onclick = () => {
  const s = $("settings");
  s.open = true;
  s.scrollIntoView({ behavior: "smooth", block: "start" });
};

/* Full screen output.

   display-mode and the browser's own full screen state have to move
   together. Leaving full screen by any route has to bring the editor back,
   or the board keeps filling the window with nothing to click. */
let idleTimer = null;

const inDisplay = () => document.body.classList.contains("display-mode");

/* Show the way out, then let it fade so the wall stays clean. */
function wakeExit(){
  document.body.classList.remove("tv-idle");
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if(inDisplay()) document.body.classList.add("tv-idle"); }, 2600);
}

function exitDisplay(){
  clearTimeout(idleTimer);
  document.body.classList.remove("display-mode", "tv-idle");
  if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}

$("btnDisplay").onclick = () => {
  document.body.classList.add("display-mode");
  renderBoard($("tvBoard"), DATA, cur(), WX);
  fitTv();
  wakeExit();
  if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
};

$("tvExit").onclick = exitDisplay;
addEventListener("keydown", e => { if(e.key === "Escape" && inDisplay()) exitDisplay(); });

/* Escape inside full screen is taken by the browser to leave full screen,
   so the handler above never sees it. Full screen can also be dropped from
   F11 or the browser's own control. Either way, come back to the editor. */
document.addEventListener("fullscreenchange", () => { if(!document.fullscreenElement && inDisplay()) exitDisplay(); });

for(const ev of ["mousemove", "pointerdown", "keydown"])
  addEventListener(ev, () => { if(inDisplay()) wakeExit(); }, { passive: true });

/* ---------- boot ---------- */
addEventListener("resize", () => { fitTv(); fitPreview(); });
if(document.fonts) document.fonts.ready.then(() => { fitPreview(); checkFit(); });

drawSettings();
drawEditor();
refreshWeather();
setInterval(refreshWeather, 20 * 60 * 1000);
