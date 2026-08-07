/* THE DATA CONTRACT

   Everything the boards need lives in one object. Nothing downstream cares
   where it came from, which is the point: today it is typed in by a coach
   and kept in the browser, tomorrow it can come from Mindbody or a server,
   and the renderer, the editor and the PNG export all stay untouched.

     site       gym location shown in the header
     footer     message along the bottom
     focus      focus of the week
     coaches[]  names offered in the dropdowns
     export     { width } in pixels; height follows at 16:9
     weather    { enabled, place, lat, lon }
     boards[]   { id, name, sessions[] }        one board = one image on the TV
     sessions[] { id, time, columns }           time is 24-hour "HH:MM"
     columns    exactly 3 entries, each one of:
                  null                       nothing running in that group
                  { coach, names: [] }       a normal SGPT roster
                  { coach, label: "HYBRID" } a class shown by name, no roster

   Boards are the coach's decision, not the clock's. Sessions sort themselves
   by time within a board. */

export const CAP = 6;    // people per coach in a normal SGPT column

const S = (time, columns) => ({ time, columns });
const N = (coach, names)  => ({ coach, names });
const L = (coach, label)  => ({ coach, label });

export const DEFAULT_DATA = {
  site: "COULSDON",
  footer: "PLEASE ARRIVE 5 MINUTES EARLY",
  focus: "UPPER - WEEK 7",
  coaches: ["BEN","JT","GEM","SAM"],
  export: { width: 2160 },        // 4K portrait. Height follows at 16:9.
  weather: { enabled: true, place: "Coulsdon", lat: 51.3203, lon: -0.1383 },
  boards: [
    { id:"b1", name:"MORNING", sessions:[
      S("06:00",[ L("JT","HYBRID"),
                  N("BEN",["LIAM","ALAN","YASH","ZOE","THANYIA","RINA"]),
                  N("GEM",["ITHA","DHRUPTI","LISA","ROSHNI","SHARON","SIAN"]) ]),
      S("07:00",[ N("SAM",["SHABBIR","ANDREW","LAURENCE","PETER"]),
                  N("BEN",["JUDITH","PATRICIA","VICKIE","KIRSTY","ROSE"]),
                  N("GEM",["JACQUELINE","JULIE","ELLA","TRACEY"]) ]),
      S("08:00",[ N("SAM",["LAURA","HANNAH","SOPHIE","HELEN","NILA"]),
                  N("BEN",["SUKHI","JAGS","PAUL"]),
                  N("GEM",["AME","BINA","BETH","ASHA","NICOLA"]) ]),
      S("09:30",[ null,
                  N("BEN",["CHRISTINE","JANE","SHIVANI","ANDY","JOSHUA"]),
                  null ])
    ]},
    { id:"b2", name:"MIDDAY", sessions:[
      S("10:30",[ N("SAM",["DAVE","MEERA","TOM"]), N("BEN",["ANNA","PRIYA"]), null ]),
      S("12:00",[ L("JT","HYBRID"),
                  N("BEN",["MO","DANNY","CLAIRE","SAFIA"]),
                  N("GEM",["GEORGE","NINA","RAJ"]) ]),
      S("13:00",[ N("SAM",["ELLIE","MARK"]), N("BEN",["SUE","OMAR","KATIE"]), null ])
    ]},
    { id:"b3", name:"EVENING", sessions:[
      S("16:15",[ N("SAM",["JAMES","AISHA","BEN H"]), N("GEM",["LOUISE","HARRY"]), null ]),
      S("17:15",[ N("SAM",["FIONA","DEV","CHLOE","IAN"]), N("BEN",["NADIA","PAUL","RUTH"]), null ]),
      S("18:15",[ N("SAM",["TARA","JOE","MEL","SIMON","AMY"]), N("BEN",["KIERAN","LUCY"]), null ]),
      S("18:30",[ null, L("JT","FUNCTIONAL STRENGTH"), null ])
    ]}
  ]
};

/* Fills in anything a saved file predates, so an old save never crashes
   the app after a change here. */
export function normalise(data){
  const d = structuredClone(data);
  d.site    = d.site    ?? DEFAULT_DATA.site;
  d.footer  = d.footer  ?? DEFAULT_DATA.footer;
  d.focus   = d.focus   ?? "";
  d.coaches = d.coaches ?? [];
  d.export  = { width: 2160, ...(d.export || {}) };
  d.weather = { enabled: false, ...(d.weather || {}) };
  d.boards  = (d.boards || []).map((b, i) => ({
    id: b.id || `b${i+1}`,
    name: b.name || "UNNAMED",
    sessions: (b.sessions || []).map(s => ({
      id: s.id,
      time: s.time || "06:00",
      columns: [0,1,2].map(k => (s.columns || [])[k] ?? null)
    }))
  }));
  if(!d.boards.length) d.boards = [{ id:"b1", name:"MORNING", sessions:[] }];
  return d;
}
