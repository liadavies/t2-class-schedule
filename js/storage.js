/* Keeping the coach's work between visits.

   Browser storage, deliberately: it needs no backend, no account and no
   file management. The trade is that it lives on one device in one browser.
   When two people need the same boards, this module is the thing to swap
   for a fetch to a server. Nothing else has to change. */

const KEY = "t2fit.schedule.v1";

export function load(){
  try{
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e){
    return null;                 // private mode, quota, corrupted value
  }
}

let timer = null;
export function save(data){
  clearTimeout(timer);           // typing a roster fires on every keystroke
  timer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch(e){ /* nothing useful to do */ }
  }, 400);
}

export function clear(){
  try { localStorage.removeItem(KEY); } catch(e){ /* nothing useful to do */ }
}
