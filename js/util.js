/* Small shared helpers. No DOM state, no fetching, safe to import anywhere. */

export const $ = id => document.getElementById(id);

export const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));

/* Times are stored as 24-hour "HH:MM". AM/PM is always derived, never typed,
   so a coach entering 18:30 gets 6:30 PM without thinking about it. */
export const mins  = t => { const [h,m] = t.split(":").map(Number); return h*60 + m; };
export const hh12  = t => { const h = +t.split(":")[0] % 12; return (h || 12) + ":" + t.split(":")[1]; };
export const merid = t => +t.split(":")[0] < 12 ? "AM" : "PM";
export const fmt   = m => {
  m = Math.max(0, Math.min(1439, Math.round(m)));
  return String(Math.floor(m/60)).padStart(2,"0") + ":" + String(m%60).padStart(2,"0");
};

export const ord = d => (d > 3 && d < 21) ? "TH" : (["TH","ST","ND","RD"][d % 10] || "TH");

export function headerDate(now){
  const days = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
  const mons = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const d = now.getDate();
  return `${days[now.getDay()]} ${d}${ord(d)} ${mons[now.getMonth()]}`;
}

export const titleCase = s => String(s).toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());

export function stamp(d = new Date()){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function saveBlob(blob, name){
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
