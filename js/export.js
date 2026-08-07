/* PNG export.

   The board is laid out in 1080x1920 coordinates. Keeping that as the SVG
   viewBox and setting only the pixel size means the browser rasterises the
   text at the target resolution, rather than upscaling a small image. A 4K
   export is genuinely sharp, not a stretched 1080 one.

   Web fonts have to be inlined as base64. Without that, the export silently
   falls back to system fonts and looks nothing like the screen. */

import { boardHtml, BOARD_W, BOARD_H } from "./board.js";
import { saveBlob, stamp, slug } from "./util.js";

const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Barlow:wght@600&display=swap";

let fontCache = null;
let cssCache  = null;

/* The same stylesheet the screen uses, fetched as text so it can be
   embedded in the SVG. One source of truth for the look. */
async function boardCss(){
  if(cssCache !== null) return cssCache;
  cssCache = await (await fetch("./css/board.css")).text();
  return cssCache;
}

async function embeddedFonts(){
  if(fontCache !== null) return fontCache;
  const css = await (await fetch(FONT_CSS_URL)).text();
  const out = [];
  for(const blk of css.split("@font-face")){
    if(!blk.includes("U+0000")) continue;               // latin subset keeps it light
    const m = blk.match(/url\((https:[^)]+\.woff2)\)/);
    if(!m) continue;
    const bytes = new Uint8Array(await (await fetch(m[1])).arrayBuffer());
    let bin = "";
    for(let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    out.push("@font-face" + blk.replace(m[1], "data:font/woff2;base64," + btoa(bin)));
  }
  fontCache = out.join("\n");
  return fontCache;
}

async function pngBlob(data, board, wx, width, fonts, css){
  const W = Math.round(width);
  const H = Math.round(W * BOARD_H / BOARD_W);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${BOARD_W} ${BOARD_H}">` +
    `<foreignObject x="0" y="0" width="${BOARD_W}" height="${BOARD_H}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${BOARD_W}px;height:${BOARD_H}px;position:relative">` +
    `<style>${fonts}${css}</style>` +
    `<div class="board">${boardHtml(data, board, wx)}</div>` +
    `</div></foreignObject></svg>`;

  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await img.decode();

  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#141E28";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  return new Promise(res => c.toBlob(res, "image/png"));
}

/* Exports one or more boards. Returns an error message, or null on success,
   so the caller decides how to tell the user. */
export async function exportBoards(data, boards, wx, onProgress){
  const W = Math.round((data.export && data.export.width) || 2160);
  try{
    let fonts = "";
    try { fonts = await embeddedFonts(); } catch(e){ /* worst case, system fonts */ }
    const css = await boardCss();
    for(const b of boards){
      if(onProgress) onProgress(b);
      const blob = await pngBlob(data, b, wx, W, fonts, css);
      saveBlob(blob, `t2fit-${slug(b.name)}-${stamp()}.png`);
      await new Promise(r => setTimeout(r, 500));   // browsers throttle rapid downloads
    }
    return null;
  } catch(err){
    return `Couldn't make the image at ${W}px on this device. `
         + `Try a smaller size in Settings, or use "Show on screen" and take a screenshot.`;
  }
}

export function exportJson(data){
  saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
           `t2fit-${stamp()}.json`);
}
