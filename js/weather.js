/* Weather for the board header.

   Open-Meteo, no API key needed. Icons are inline SVG on purpose: the PNG
   export serialises the DOM into a canvas, so an external image or an emoji
   would not survive it.

   Today's high rather than the current reading, because the board is a
   static image that stays on the wall for hours. A high stays true; a
   temperature taken at 5am does not. */

const ICONS = {
  clear:  '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.4v2.5M12 19.1v2.5M2.4 12h2.5M19.1 12h2.5M5.2 5.2l1.8 1.8M17 17l1.8 1.8M18.8 5.2L17 7M7 17l-1.8 1.8" stroke-linecap="round"/>',
  partly: '<circle cx="8.6" cy="8" r="3.1"/><path d="M8.6 1.8v1.7M2.4 8H4.1M4.2 3.6l1.2 1.2M13 3.6l-1.2 1.2" stroke-linecap="round"/><path d="M8.4 20.6h9.2a3.5 3.5 0 0 0 .3-7 4.7 4.7 0 0 0-9-1 3.5 3.5 0 0 0-.5 8Z"/>',
  cloud:  '<path d="M7.2 19.4h10.1a3.7 3.7 0 0 0 .3-7.4 5 5 0 0 0-9.6-1.1 3.7 3.7 0 0 0-.8 8.5Z"/>',
  fog:    '<path d="M7.4 14.4h9.6a3.5 3.5 0 0 0 .3-7 4.8 4.8 0 0 0-9.2-1 3.5 3.5 0 0 0-.7 8Z"/><path d="M4.2 18h15.6M6.6 21.2h10.8" stroke-linecap="round"/>',
  rain:   '<path d="M7.4 14.8h9.6a3.5 3.5 0 0 0 .3-7 4.8 4.8 0 0 0-9.2-1 3.5 3.5 0 0 0-.7 8Z"/><path d="M9.2 18.2l-1 3M13 18.2l-1 3M16.8 18.2l-1 3" stroke-linecap="round"/>',
  snow:   '<path d="M7.4 14.8h9.6a3.5 3.5 0 0 0 .3-7 4.8 4.8 0 0 0-9.2-1 3.5 3.5 0 0 0-.7 8Z"/><path d="M9.4 18.8h.01M12.6 20.6h.01M15.8 18.8h.01" stroke-linecap="round" stroke-width="2.8"/>',
  storm:  '<path d="M7.4 14.2h9.6a3.5 3.5 0 0 0 .3-7 4.8 4.8 0 0 0-9.2-1 3.5 3.5 0 0 0-.7 8Z"/><path d="M13.4 16.6l-3.6 3.6h3.1l-1.5 2.6" stroke-linecap="round" stroke-linejoin="round"/>'
};

/* WMO codes, grouped to the level of detail a gym wall actually needs.
   Nobody walking past cares about light versus moderate drizzle. */
export function wxKey(code){
  if(code === 0) return "clear";
  if(code <= 2) return "partly";
  if(code === 3) return "cloud";
  if(code === 45 || code === 48) return "fog";
  if(code >= 95) return "storm";
  if((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  return "rain";
}

/* Returns "" when there's nothing to show, so a failed fetch simply leaves
   the element out rather than putting an error message on the wall. */
export function wxHtml(wx){
  if(!wx) return "";
  return `<div class="b-wx">`
    + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" `
    + `fill="none" stroke="currentColor" stroke-width="1.9">${ICONS[wxKey(wx.code)]}</svg>`
    + `<span class="t">${wx.temp}&#176;</span></div>`;
}

export async function fetchWeather(loc){
  if(!loc || !loc.enabled || loc.lat == null) return null;
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}`
              + `&daily=weather_code,temperature_2m_max&forecast_days=1&timezone=auto`;
    const j = await (await fetch(url)).json();
    return { temp: Math.round(j.daily.temperature_2m_max[0]), code: j.daily.weather_code[0] };
  } catch(e){
    return null;
  }
}

/* Resolves a town name to coordinates. Returns null for "no such place";
   throws if the service itself is unreachable, so the caller can say which. */
export async function geocode(query){
  const url = `https://geocoding-api.open-meteo.com/v1/search`
            + `?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const j = await (await fetch(url)).json();
  const r = j.results && j.results[0];
  return r ? { place: r.name, lat: r.latitude, lon: r.longitude } : null;
}
