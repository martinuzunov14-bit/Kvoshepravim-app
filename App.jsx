import React, { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient.js";

/* ============================================================================
   "КАКВО ЩЕ ПРАВИМ ТАЯ ВЕЧЕР?" — нощен пътеводител на София
   ------------------------------------------------------------------------
   ВАЖНО ЗА ДАННИТЕ (моля прочети):
   - Заведенията и събитията по-долу са РЕАЛНИ, събрани чрез търсене в
     интернет към 5 септември 2026 г. (eventim.bg, kupibileti.bg, allevents.in,
     songkick, официални сайтове на клубове и медийни публикации).
   - Клубните DJ програми се сменят ежеседмично и рядко се индексират онлайн —
     затова за конкретните дати виж бутона "Социални мрежи" на съответния клуб.
   - Точните адреси/координати на част от местата не са потвърдени на 100% —
     позициите на картата са ориентировъчни, не GPS-точни.
   - Снимките са placeholder изображения (не са реални снимки на местата).
   - Бутоните "Купи билет" водят към билетната платформа или към търсене за
     конкретното събитие, ако нямаме потвърден директен линк.
   ============================================================================ */

/* ---------- design tokens ---------- */
const C = {
  bg: "#0a0a10", surface: "#131320", surface2: "#1c1c2e", line: "#2a2a3d",
  ink: "#f3f2f7", inkDim: "#9490ad", inkFaint: "#615d78",
  brand: "#ff2f7e", brand2: "#7c4dff",
};

const GENRES = {
  chalga: { label: "Чалга / Балкан поп", color: "#ff4d4d" },
  techno: { label: "Techno", color: "#b26bff" },
  house: { label: "House", color: "#3aa0ff" },
  rock: { label: "Rock", color: "#3ddc84" },
  metal: { label: "Metal", color: "#8b8fa3" },
  hiphop: { label: "Hip-Hop", color: "#ff9a3d" },
  pop: { label: "Pop", color: "#ff6fb0" },
  jazz: { label: "Jazz / Soul", color: "#ffcf4d" },
  live: { label: "Folk / Live", color: "#f1f0f5" },
  mixed: { label: "Mixed", color: "#ff2f7e" },
  theater: { label: "Театър", color: "#c9a876" },
  cinema: { label: "Кино", color: "#5fb8ff" },
};
const GENRE_LIST = Object.keys(GENRES);
const MUSIC_GENRE_LIST = GENRE_LIST.filter((g) => g !== "theater" && g !== "cinema");
const THEATER_GENRES = { drama: "Драма", comedy: "Комедия", musical: "Мюзикъл", opera: "Опера", ballet: "Балет", classic: "Класика" };
const CINEMA_GENRES = { action: "Екшън", drama: "Драма", comedy: "Комедия", thriller: "Трилър", animation: "Анимация", documentary: "Документален", scifi: "Sci-Fi", horror: "Хорър" };
const TYPE_LABELS = { club: "Клуб", bar: "Бар", concert: "Концертна зала", hall: "Зала", theater: "Театър", cinema: "Кино", square: "Площад", attraction: "Атракция" };

function hex2rgba(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function img(seed, w = 480, h = 320) { return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`; }
// Честен placeholder вместо случайна стокова снимка, която няма нищо общо със заведението:
// градиент в цвета на жанра + инициал на името. Няма реални снимки на заведенията (нямаме източник),
// затова не се преструваме, че показваме истинска снимка.
function placeholderImg(name, genreKey, w = 600, h = 360) {
  const color = (GENRES[genreKey] && GENRES[genreKey].color) || "#ff2f7e";
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#0a0a10" stop-opacity="1"/>
    </linearGradient></defs>
    <rect width="${w}" height="${h}" fill="#0a0a10"/>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <text x="50%" y="54%" font-family="sans-serif" font-size="${Math.round(h * 0.32)}" font-weight="700" fill="#ffffff" fill-opacity="0.85" text-anchor="middle" dominant-baseline="middle">${initial}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
function fmt(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${["яну","фев","мар","апр","май","юни","юли","авг","сеп","окт","ное","дек"][d.getMonth()]} ${d.getFullYear()}`;
}
function weekday(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return ["нед","пон","вт","ср","чет","пет","съб"][d.getDay()];
}
function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d - today) / 86400000);
}
function googleTickets(q) { return `https://www.google.com/search?q=${encodeURIComponent(q + " билети")}`; }
function fbSearch(q) { return `https://www.facebook.com/search/top?q=${encodeURIComponent(q)}`; }
function igSearch(q) { return `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(q)}`; }

/* ---------- REAL venues (verified via web search, Sept 2026) ---------- */
// Широко разпространявани заглавия около септември 2026 в България (потвърдени чрез търсене:
// cinefish.bg, forumfilm.bg, bTV Cinema X) — НЕ е потвърден график по конкретна зала/час,
// затова е маркирано като "национален прокат", а не като точна програма на дадено кино.
const NATIONAL_RELEASES = [
  { title: "28 години по-късно: Храм от кости", subGenre: "horror" },
  { title: "Анаконда", subGenre: "comedy" },
  { title: "Гарванът", subGenre: "action" },
];


// Данните се зареждат на живо от Supabase (виж useEffect в App()) — тези масиви
// започват празни и се попълват веднага след първото зареждане на страницата.
let VENUES = [];
let EVENTS = [];
let FESTIVALS = [];

/* ---------- small UI pieces ---------- */
function GenreBadge({ genre, size = "sm" }) {
  const g = GENRES[genre];
  return (
    <span style={{ background: hex2rgba(g.color, 0.14), color: g.color, borderRadius: 8, padding: size === "sm" ? "3px 8px" : "5px 11px", fontSize: size === "sm" ? 11 : 12.5, fontWeight: 600, letterSpacing: 0.1, whiteSpace: "nowrap" }}>{g.label}</span>
  );
}
function Chip({ active, onClick, children, color }) {
  return (
    <button onClick={onClick} style={{ flex: "0 0 auto", padding: "8px 14px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, border: `1px solid ${active ? (color || C.brand) : C.line}`, background: active ? hex2rgba(color || C.brand, 0.18) : "transparent", color: active ? (color || C.brand) : C.inkDim, cursor: "pointer" }}>{children}</button>
  );
}
function IconBtn({ onClick, children, label }) {
  return (
    <button onClick={onClick} aria-label={label} style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${C.line}`, background: C.surface2, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer" }}>{children}</button>
  );
}
function LinkBtn({ href, children }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: "center", padding: "11px 0", borderRadius: 12, border: `1px solid ${C.line}`, background: C.surface2, color: C.ink, fontWeight: 700, fontSize: 12.5, cursor: "pointer", textDecoration: "none" }}>{children}</a>
  );
}
function Sheet({ onClose, children }) {
  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(5,5,10,0.7)", backdropFilter: "blur(3px)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", background: C.surface, borderRadius: "20px 20px 0 0", border: `1px solid ${C.line}`, borderBottom: "none", animation: "slideUp .22s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px" }}><div style={{ width: 36, height: 4, borderRadius: 4, background: C.line }} /></div>
        {children}
      </div>
    </div>
  );
}
function EventRow({ ev, venue, onOpen, wide }) {
  const dLeft = daysUntil(ev.date);
  return (
    <div onClick={onOpen} style={{ cursor: "pointer", flex: wide ? "1 1 100%" : "0 0 208px", position: "relative", height: 190, borderRadius: 18, overflow: "hidden" }}>
      <img src={ev.img || venue.img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,10,16,0) 35%, rgba(10,10,16,0.55) 70%, rgba(10,10,16,0.92) 100%)" }} />
      <div style={{ position: "absolute", top: 10, right: 10 }}><GenreBadge genre={ev.genre} /></div>
      {dLeft === 0 && <div style={{ position: "absolute", top: 10, left: 10, background: C.brand, color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999 }}>🔥 ДНЕС</div>}
      <div style={{ position: "absolute", left: 12, right: 12, bottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.25, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,.6)" }}>{ev.title}</div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, margin: "3px 0 6px" }}>{venue?.name}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.75)" }}>
          <span>📅 {weekday(ev.date)}, {fmt(ev.date)}</span>
          <span>🕚 {ev.time}</span>
        </div>
      </div>
    </div>
  );
}
function VenueCard({ v, onOpen, height = 130 }) {
  return (
    <div onClick={onOpen} style={{ cursor: "pointer", flex: "0 0 168px", position: "relative", height, borderRadius: 16, overflow: "hidden" }}>
      <img src={v.img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,10,16,0) 40%, rgba(10,10,16,0.9) 100%)" }} />
      <div style={{ position: "absolute", left: 10, right: 10, bottom: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,.6)" }}>{v.name}</div>
        <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>{v.genres.slice(0, 2).map((g) => <GenreBadge key={g} genre={g} />)}</div>
      </div>
    </div>
  );
}
function Rail({ title, sub, onSeeAll, children }) {
  return (
    <section style={{ marginTop: 26 }}>
      <div style={{ padding: "0 16px", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 16, margin: 0 }}>{title}</h2>
          {onSeeAll && <button onClick={onSeeAll} style={{ background: "none", border: "none", color: C.brand2, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>виж всички</button>}
        </div>
        {sub && <div style={{ color: C.inkFaint, fontSize: 11.5, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 16px 4px" }}>{children}</div>
    </section>
  );
}
/* ---------- geo distance (real, from real lat/lon) ---------- */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function NearbyScreen({ setOpenVenue }) {
  const [status, setStatus] = useState("asking"); // asking | ok | denied
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) { setStatus("denied"); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lon: p.coords.longitude }); setStatus("ok"); },
      () => setStatus("denied"),
      { timeout: 8000 }
    );
  }, []);

  const list = VENUES.filter((v) => v.lat != null);
  const withDist = status === "ok" && pos
    ? list.map((v) => ({ v, dist: haversineKm(pos.lat, pos.lon, v.lat, v.lon) })).sort((a, b) => a.dist - b.dist)
    : list.map((v) => ({ v, dist: null }));

  return (
    <div style={{ padding: "4px 16px" }}>
      <h1 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 20, margin: "4px 0 8px" }}>Близо до теб</h1>
      {status === "asking" && <div style={{ color: C.inkDim, fontSize: 12.5, marginBottom: 14 }}>Искаме достъп до локацията ти, за да подредим клубовете по разстояние…</div>}
      {status === "denied" && (
        <div style={{ background: hex2rgba(C.brand2, 0.12), border: `1px solid ${hex2rgba(C.brand2, 0.35)}`, borderRadius: 10, padding: "9px 12px", fontSize: 12, color: C.inkDim, marginBottom: 14 }}>
          Нямаме достъп до локацията ти (отказана или неподдържана в тази среда) — показваме списъка без разстояния.
        </div>
      )}
      {status === "ok" && <div style={{ color: C.inkFaint, fontSize: 11.5, marginBottom: 14 }}>Разстоянията са изчислени по права линия от реалните координати на клубовете.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {withDist.map(({ v, dist }) => (
          <div key={v.id} onClick={() => setOpenVenue(v)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 8 }}>
            <div style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", flex: "0 0 auto" }}><img src={v.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{v.name}</div>
              <div style={{ fontSize: 11.5, color: C.inkDim }}>{TYPE_LABELS[v.type]} · {v.district}{dist != null ? ` · ${dist.toFixed(1)} km` : ""}</div>
            </div>
            <GenreBadge genre={v.genres[0]} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- app ---------- */
export default function App() {
  const [tab, setTab] = useState("home");
  const [moreMode, setMoreMode] = useState("venues");
  const [openEvent, setOpenEvent] = useState(null);
  const [openVenue, setOpenVenue] = useState(null);
  const [openFestival, setOpenFestival] = useState(null);
  const [finderOpen, setFinderOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileName, setProfileName] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [dataError, setDataError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: vRows, error: vErr }, { data: eRows, error: eErr }, { data: fRows, error: fErr }] = await Promise.all([
          supabase.from("venues").select("*"),
          supabase.from("events").select("*"),
          supabase.from("festivals").select("*"),
        ]);
        if (vErr) throw vErr;
        if (eErr) throw eErr;
        if (fErr) throw fErr;
        if (cancelled) return;
        VENUES = (vRows || []).map((v) => ({
          id: v.id, name: v.name, district: v.district, type: v.type, genres: v.genres || ["mixed"],
          address: v.address, website: v.website, instagram: v.instagram, facebook: v.facebook,
          note: v.note, rating: v.rating, ratingSource: v.rating_source, lat: v.lat, lon: v.lon,
          statusWarning: v.status_warning, nowShowing: v.now_showing,
          img: placeholderImg(v.name, (v.genres && v.genres[0]) || "mixed", 600, 360),
        }));
        EVENTS = (eRows || []).map((e) => ({
          id: e.id, title: e.title, artist: e.artist, venueId: e.venue_id, date: e.event_date,
          time: e.event_time, genre: e.genre, subGenre: e.sub_genre, ticketUrl: e.ticket_url,
          ticketLabel: e.ticket_label, social: e.social, instagram: e.social, desc: e.description,
          img: placeholderImg(e.title, e.genre || "mixed", 640, 420),
        }));
        FESTIVALS = (fRows || []).map((f) => ({
          id: f.id, name: f.name, place: f.place, date: f.event_date, days: f.days, genre: f.genre,
          ticketUrl: f.ticket_url, ticketLabel: f.ticket_label, note: f.note,
        }));
        setDataLoaded(true);
      } catch (err) {
        if (!cancelled) setDataError(err.message || String(err));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [favVenues, setFavVenues] = useState(new Set());
  const [going, setGoing] = useState(new Set());

  const [mapGenre, setMapGenre] = useState("all");
  const [evGenre, setEvGenre] = useState("all");
  const [evCategory, setEvCategory] = useState("music"); // music | theater | cinema
  const [evSubGenre, setEvSubGenre] = useState("all");
  const [query, setQuery] = useState("");

  const venueById = useMemo(() => Object.fromEntries(VENUES.map((v) => [v.id, v])), [dataLoaded]);
  const toggle = (setter) => (id) => setter((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleFavVenue = toggle(setFavVenues);
  const toggleGoing = toggle(setGoing);

  const upcoming = useMemo(() => [...EVENTS].filter((e) => daysUntil(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)), [dataLoaded]);
  const tonight = upcoming.filter((e) => daysUntil(e.date) === 0);
  const heroEvents = tonight.length ? tonight : upcoming.slice(0, 6);

  const searchResults = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return {
      events: upcoming.filter((e) => (e.title || "").toLowerCase().includes(q) || (e.artist || "").toLowerCase().includes(q) || (venueById[e.venueId]?.name || "").toLowerCase().includes(q)),
      venues: VENUES.filter((v) => v.name.toLowerCase().includes(q) || v.district.toLowerCase().includes(q)),
      festivals: FESTIVALS.filter((f) => f.name.toLowerCase().includes(q)),
    };
  }, [query, upcoming, venueById]);

  const filteredMapVenues = VENUES.filter((v) => v.id !== "tba" && (mapGenre === "all" || v.genres.includes(mapGenre)));
  const featuredVenues = useMemo(() => {
    const seen = new Set();
    const picks = [];
    for (const g of GENRE_LIST) {
      const v = VENUES.find((v) => v.type === "club" && v.genres[0] === g && !seen.has(v.id));
      if (v) { picks.push(v); seen.add(v.id); }
    }
    return picks;
  }, [dataLoaded]);
  const filteredEvents = upcoming.filter((e) => {
    if (evCategory === "theater" && e.genre !== "theater") return false;
    if (evCategory === "cinema" && e.genre !== "cinema") return false;
    if (evCategory === "music" && (e.genre === "theater" || e.genre === "cinema")) return false;
    if (evCategory === "music" && evGenre !== "all" && e.genre !== evGenre) return false;
    if (evCategory !== "music" && evSubGenre !== "all" && e.subGenre !== evSubGenre) return false;
    return true;
  });
  const eventsForVenue = (vid) => upcoming.filter((e) => e.venueId === vid);

  // Guard-ите за грешка/зареждане идват ЧАК СЛЕД всички hooks по-горе —
  // React изисква еднакъв брой hooks на всеки render, иначе гърми (грешка #310).
  if (dataError) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: "Inter, sans-serif" }}>
        <div>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Проблем при зареждане от базата</div>
          <div style={{ color: C.inkDim, fontSize: 13 }}>{dataError}</div>
        </div>
      </div>
    );
  }
  if (!dataLoaded) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🌙</div>
          <div style={{ color: C.inkDim, fontSize: 13 }}>Зареждане на живи данни...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", background: C.bg, color: C.ink, minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative", paddingBottom: 84 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
        @keyframes slideUp { from { transform: translateY(24px); opacity: .4; } to { transform: translateY(0); opacity: 1; } }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,.35);} 70% { box-shadow: 0 0 0 9px rgba(255,255,255,0);} 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0);} }
        button, a { font-family: inherit; }
        input { font-family: inherit; }
      `}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 30, background: `linear-gradient(${C.bg}, ${C.bg}ee 80%, transparent)`, padding: "14px 16px 8px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${C.brand}, ${C.brand2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flex: "0 0 auto" }}>🌙</div>
        <div style={{ flex: 1, fontFamily: "'Unbounded', sans-serif", fontSize: 13.5, fontWeight: 700 }}>Тая вечер</div>
        <IconBtn onClick={() => setSearchOpen(true)} label="Търсене">🔎</IconBtn>
        <IconBtn onClick={() => setNotifOpen(true)} label="Известия">🔔</IconBtn>
        <IconBtn onClick={() => setInfoOpen(true)} label="За данните">ℹ️</IconBtn>
        <IconBtn onClick={() => (profileName ? setTab("profile") : setLoginOpen(true))} label="Профил">
          {profileName ? profileName[0].toUpperCase() : "👤"}
        </IconBtn>
      </div>

      {tab === "home" && (
        <div>
          <div style={{ padding: "6px 16px 4px" }}>
            <h1 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 27, lineHeight: 1.15, margin: "6px 0 6px" }}>Какво ще правим<br /><span style={{ color: C.brand }}>тая вечер?</span></h1>
            <p style={{ color: C.inkDim, fontSize: 13, margin: "0 0 6px" }}>Реални предстоящи събития и клубове в София.</p>
            <div style={{ background: hex2rgba(C.brand2, 0.12), border: `1px solid ${hex2rgba(C.brand2, 0.35)}`, borderRadius: 10, padding: "7px 10px", fontSize: 11, color: C.inkDim, marginBottom: 12 }}>
              ℹ️ Данните са реални, събрани към 5.09.2026. Клубните DJ вечери се обявяват седмично — виж бутона „Социални мрежи“ за най-актуалното.
            </div>
            <button onClick={() => setSearchOpen(true)} style={{ width: "100%", textAlign: "left", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 14px", color: C.inkDim, fontSize: 13.5, cursor: "pointer" }}>🔎 Търси събитие, клуб или фестивал</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: "16px 16px 0" }}>
            {[
              ["🔥", "Предстоящи", () => setTab("events")],
              ["🗺️", "Карта", () => setTab("map")],
              ["📍", "Близо до мен", () => setTab("nearby")],
              ["🎉", "Фестивали", () => { setTab("more"); setMoreMode("festivals"); }],
              ["📍", "Заведения", () => { setTab("more"); setMoreMode("venues"); }],
              ["❤️", "Любими", () => setTab("profile")],
              ["🎭", "Театър", () => { setTab("events"); setEvGenre("theater"); }],
              ["🎬", "Кино", () => { setTab("map"); setMapGenre("cinema"); }],
            ].map(([icon, label, fn]) => (
              <button key={label} onClick={fn} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: "14px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: C.ink, cursor: "pointer" }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>{label}</span>
              </button>
            ))}
          </div>

          <Rail title={tonight.length ? "🔥 Тази вечер" : "🔥 Най-близките предстоящи"} sub={!tonight.length ? "Няма обявено събитие точно за днес — ето най-скорошните реални дати." : null} onSeeAll={() => setTab("events")}>
            {heroEvents.map((ev) => <EventRow key={ev.id} ev={ev} venue={venueById[ev.venueId]} onOpen={() => setOpenEvent(ev)} />)}
          </Rail>

          <section style={{ marginTop: 26, padding: "0 16px" }}>
            <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 16, margin: "0 0 10px" }}>🗺️ Нощна София</h2>
            <div onClick={() => setTab("map")} style={{ cursor: "pointer", borderRadius: 16, overflow: "hidden", border: `1px solid ${C.line}` }}><MiniMap venues={VENUES} /></div>
            <button onClick={() => setTab("map")} style={{ marginTop: 8, background: "none", border: "none", color: C.brand2, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Виж всички места →</button>
          </section>

          <Rail title="🎉 Предстоящи фестивали" onSeeAll={() => { setTab("more"); setMoreMode("festivals"); }}>
            {FESTIVALS.map((f) => (
              <div key={f.id} onClick={() => setOpenFestival(f)} style={{ cursor: "pointer", flex: "0 0 220px", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
                <img src={img(f.id, 400, 220)} alt="" style={{ width: "100%", height: 110, objectFit: "cover" }} />
                <div style={{ padding: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: C.inkDim, marginTop: 3 }}>📍 {f.place} · от {fmt(f.date)}</div>
                </div>
              </div>
            ))}
          </Rail>

          <Rail title="📍 Клубове, които да разгледаш" sub="по едно от всеки основен жанр" onSeeAll={() => { setTab("more"); setMoreMode("venues"); }}>
            {featuredVenues.map((v) => (
              <VenueCard key={v.id} v={v} onOpen={() => setOpenVenue(v)} />
            ))}
          </Rail>
        </div>
      )}

      {tab === "map" && (
        <div>
          <div style={{ padding: "4px 16px" }}>
            <h1 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 20, margin: "4px 0 12px" }}>Нощна карта на София</h1>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
              <Chip active={mapGenre === "all"} onClick={() => setMapGenre("all")}>Всички</Chip>
              {GENRE_LIST.map((g) => <Chip key={g} active={mapGenre === g} color={GENRES[g].color} onClick={() => setMapGenre(g)}>{GENRES[g].label}</Chip>)}
            </div>
          </div>
          <div style={{ padding: "0 16px" }}>
            <div style={{ borderRadius: 18, overflow: "hidden", border: `1px solid ${C.line}` }}><BigMap venues={filteredMapVenues} onPick={setOpenVenue} /></div>
            <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 8 }}>Плъзни картата за да разгледаш — истинска карта на София (OpenStreetMap), но част от координатите са приблизителни, не GPS-точни.</div>
          </div>
          <section style={{ padding: "18px 16px 0" }}>
            <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 15, margin: "0 0 10px" }}>Всички заведения ({filteredMapVenues.length})</h2>
            {filteredMapVenues.map((v) => (
              <div key={v.id} onClick={() => setOpenVenue(v)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.line}` }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, overflow: "hidden", flex: "0 0 auto" }}><img src={v.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{v.name}</div>
                  <div style={{ fontSize: 11.5, color: C.inkDim }}>{TYPE_LABELS[v.type]} · {v.district}</div>
                </div>
                <GenreBadge genre={v.genres[0]} />
              </div>
            ))}
          </section>
        </div>
      )}

      {tab === "events" && (
        <div>
          <div style={{ padding: "4px 16px 8px" }}>
            <h1 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 20, margin: "4px 0 12px" }}>Предстоящи събития</h1>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {[["music", "🎵 Музика"], ["theater", "🎭 Театър"], ["cinema", "🎬 Кино"]].map(([k, l]) => (
                <button key={k} onClick={() => { setEvCategory(k); setEvGenre("all"); setEvSubGenre("all"); }} style={{
                  flex: 1, padding: "9px 4px", borderRadius: 12, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  border: `1px solid ${evCategory === k ? C.brand : C.line}`, background: evCategory === k ? hex2rgba(C.brand, 0.15) : C.surface, color: evCategory === k ? C.brand : C.ink,
                }}>{l}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
              {evCategory === "music" && (
                <>
                  <Chip active={evGenre === "all"} onClick={() => setEvGenre("all")}>Всички жанрове</Chip>
                  {MUSIC_GENRE_LIST.map((g) => <Chip key={g} active={evGenre === g} color={GENRES[g].color} onClick={() => setEvGenre(g)}>{GENRES[g].label}</Chip>)}
                </>
              )}
              {evCategory === "theater" && (
                <>
                  <Chip active={evSubGenre === "all"} onClick={() => setEvSubGenre("all")}>Всички</Chip>
                  {Object.entries(THEATER_GENRES).map(([k, l]) => <Chip key={k} active={evSubGenre === k} onClick={() => setEvSubGenre(k)}>{l}</Chip>)}
                </>
              )}
              {evCategory === "cinema" && (
                <>
                  <Chip active={evSubGenre === "all"} onClick={() => setEvSubGenre("all")}>Всички</Chip>
                  {Object.entries(CINEMA_GENRES).map(([k, l]) => <Chip key={k} active={evSubGenre === k} onClick={() => setEvSubGenre(k)}>{l}</Chip>)}
                </>
              )}
            </div>
          </div>
          <div style={{ padding: "6px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12.5, color: C.inkDim }}>{filteredEvents.length} резултата</div>
            {evCategory === "cinema" && (
              <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: 2 }}>Билетирани кино прожекции засега няма в базата — виж 📍 Заведения → кина за „Сега се прожектира".</div>
            )}
            {filteredEvents.map((ev) => {
              const v = venueById[ev.venueId];
              return (
                <div key={ev.id} onClick={() => setOpenEvent(ev)} style={{ cursor: "pointer", display: "flex", gap: 12, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
                  <img src={v.img} alt="" style={{ width: 96, height: 96, objectFit: "cover", flex: "0 0 auto" }} />
                  <div style={{ padding: "10px 10px 10px 0", flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{ev.title}</div>
                      <GenreBadge genre={ev.genre} />
                    </div>
                    <div style={{ fontSize: 12, color: C.inkDim, marginTop: 3 }}>{v.name} · {v.district}</div>
                    <div style={{ fontSize: 12, color: C.inkDim, marginTop: 6 }}>{weekday(ev.date)}, {fmt(ev.date)} · 🕚 {ev.time}</div>
                  </div>
                </div>
              );
            })}
            {filteredEvents.length === 0 && <div style={{ color: C.inkFaint, fontSize: 13, padding: "20px 0" }}>Няма събития за този филтър в момента.</div>}
          </div>
        </div>
      )}

      {tab === "nearby" && <NearbyScreen setOpenVenue={setOpenVenue} />}

      {tab === "more" && (
        <div>
          <div style={{ padding: "4px 16px 10px", display: "flex", gap: 8 }}>
            {[["venues", "📍 Заведения"], ["festivals", "🎉 Фестивали"]].map(([k, l]) => (
              <button key={k} onClick={() => setMoreMode(k)} style={{ flex: 1, padding: "9px 4px", borderRadius: 12, fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: `1px solid ${moreMode === k ? C.brand : C.line}`, background: moreMode === k ? hex2rgba(C.brand, 0.15) : C.surface, color: moreMode === k ? C.brand : C.ink }}>{l}</button>
            ))}
          </div>
          {moreMode === "venues" && (
            <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {VENUES.filter((v) => v.id !== "tba").map((v) => (
                <div key={v.id} onClick={() => setOpenVenue(v)} style={{ cursor: "pointer", display: "flex", gap: 12, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
                  <img src={v.img} alt="" style={{ width: 88, height: 88, objectFit: "cover", flex: "0 0 auto" }} />
                  <div style={{ padding: "9px 10px 9px 0", flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{v.name}</div>
                    <div style={{ fontSize: 11.5, color: C.inkDim, margin: "3px 0 6px" }}>{TYPE_LABELS[v.type]} · {v.district}</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{v.genres.map((g) => <GenreBadge key={g} genre={g} />)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {moreMode === "festivals" && (
            <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              {FESTIVALS.map((f) => (
                <div key={f.id} onClick={() => setOpenFestival(f)} style={{ cursor: "pointer", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
                  <img src={img(f.id, 700, 300)} alt="" style={{ width: "100%", height: 130, objectFit: "cover" }} />
                  <div style={{ padding: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: C.inkDim, marginTop: 4 }}>📍 {f.place} · от {fmt(f.date)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "profile" && (
        <div style={{ padding: "4px 16px" }}>
          <h1 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 20, margin: "4px 0 4px" }}>Профил</h1>
          {profileName ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 12, margin: "10px 0 18px" }}>
              <div style={{ width: 42, height: 42, borderRadius: 999, background: `linear-gradient(135deg, ${C.brand}, ${C.brand2})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff" }}>{profileName[0]?.toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{profileName}</div>
                <div style={{ fontSize: 11.5, color: C.inkDim }}>{favVenues.size} любими · {going.size} предстоящи</div>
              </div>
              <button onClick={() => setProfileName(null)} style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 10px", color: C.inkDim, fontSize: 11.5, cursor: "pointer" }}>Изход</button>
            </div>
          ) : (
            <div style={{ margin: "10px 0 18px" }}>
              <p style={{ color: C.inkDim, fontSize: 12.5, margin: "0 0 10px" }}>Demo профил — без реален бекенд. Влизането е локално, само за да видиш как ще изглежда екранът.</p>
              <button onClick={() => setLoginOpen(true)} style={{ width: "100%", padding: "12px 0", borderRadius: 14, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${C.brand}, ${C.brand2})`, color: "#fff", fontWeight: 800, fontSize: 14 }}>Вход / Регистрация</button>
            </div>
          )}
          <h2 style={{ fontSize: 14.5, margin: "0 0 8px" }}>Моите предстоящи събития</h2>
          {[...going].length === 0 && <div style={{ color: C.inkFaint, fontSize: 12.5, marginBottom: 16 }}>Все още нямаш отбелязани „Ще ходя“ събития.</div>}
          {upcoming.filter((e) => going.has(e.id)).map((ev) => (
            <div key={ev.id} onClick={() => setOpenEvent(ev)} style={{ cursor: "pointer", display: "flex", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.line}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{ev.title}</div>
                <div style={{ fontSize: 11.5, color: C.inkDim }}>{venueById[ev.venueId].name} · {fmt(ev.date)}</div>
              </div>
              <GenreBadge genre={ev.genre} />
            </div>
          ))}
          <h2 style={{ fontSize: 14.5, margin: "22px 0 8px" }}>❤️ Любими заведения</h2>
          <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {[...favVenues].map((id) => venueById[id]).filter(Boolean).map((v) => (
              <div key={v.id} onClick={() => setOpenVenue(v)} style={{ cursor: "pointer", flex: "0 0 100px", textAlign: "center" }}>
                <img src={v.img} alt="" style={{ width: 100, height: 70, objectFit: "cover", borderRadius: 10 }} />
                <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 5 }}>{v.name}</div>
              </div>
            ))}
            {favVenues.size === 0 && <div style={{ color: C.inkFaint, fontSize: 12.5 }}>Нямаш любими заведения още.</div>}
          </div>
          <div style={{ marginTop: 26, padding: 14, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>⚙️ За организатори и заведения</div>
            <div style={{ fontSize: 12, color: C.inkDim }}>В следваща версия заведенията ще могат сами да добавят и управляват събитията си оттук.</div>
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "rgba(19,19,32,0.92)", backdropFilter: "blur(10px)", borderTop: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "10px 6px calc(10px + env(safe-area-inset-bottom))", zIndex: 40 }}>
        {[["home", "🏠", "Начало"], ["map", "🗺️", "Карта"], ["mid", "🔥", ""], ["events", "🎉", "Събития"], ["profile", "👤", "Профил"]].map(([k, icon, label]) => {
          if (k === "mid") return <button key={k} onClick={() => setFinderOpen(true)} style={{ width: 52, height: 52, borderRadius: 999, border: "none", marginTop: -22, background: `linear-gradient(135deg, ${C.brand}, ${C.brand2})`, color: "#fff", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 18px ${hex2rgba(C.brand, 0.5)}`, cursor: "pointer" }}>🔥</button>;
          const active = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", color: active ? C.brand : C.inkDim, flex: 1, padding: "4px 0" }}>
              <span style={{ fontSize: 18 }}>{icon}</span><span style={{ fontSize: 10, fontWeight: 700 }}>{label}</span>
            </button>
          );
        })}
      </div>

      {openEvent && (
        <Sheet onClose={() => setOpenEvent(null)}>
          <EventDetail ev={openEvent} venue={venueById[openEvent.venueId]} going={going.has(openEvent.id)} onGoing={() => toggleGoing(openEvent.id)} onOpenVenue={() => { setOpenEvent(null); setOpenVenue(venueById[openEvent.venueId]); }} />
        </Sheet>
      )}
      {openVenue && (
        <Sheet onClose={() => setOpenVenue(null)}>
          <VenueDetail venue={openVenue} events={eventsForVenue(openVenue.id)} fav={favVenues.has(openVenue.id)} onFav={() => toggleFavVenue(openVenue.id)} onOpenEvent={(e) => { setOpenVenue(null); setOpenEvent(e); }} />
        </Sheet>
      )}
      {openFestival && <Sheet onClose={() => setOpenFestival(null)}><FestivalDetail f={openFestival} /></Sheet>}
      {finderOpen && <Sheet onClose={() => setFinderOpen(false)}><SmartFinder onClose={() => setFinderOpen(false)} venueById={venueById} upcoming={upcoming} onOpenEvent={(e) => { setFinderOpen(false); setOpenEvent(e); }} /></Sheet>}
      {searchOpen && (
        <Sheet onClose={() => { setSearchOpen(false); setQuery(""); }}>
          <SearchScreen query={query} setQuery={setQuery} results={searchResults} venueById={venueById}
            onOpenEvent={(e) => { setSearchOpen(false); setOpenEvent(e); }}
            onOpenVenue={(v) => { setSearchOpen(false); setOpenVenue(v); }}
            onOpenFestival={(f) => { setSearchOpen(false); setOpenFestival(f); }} />
        </Sheet>
      )}
      {infoOpen && (
        <Sheet onClose={() => setInfoOpen(false)}>
          <div style={{ padding: 18, fontSize: 13, color: C.inkDim, lineHeight: 1.6 }}>
            <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 17, color: C.ink, margin: "0 0 10px" }}>За данните в приложението</h2>
            <p>Заведенията и събитията са реални и събрани чрез търсене в интернет към 5 септември 2026 г. (eventim.bg, kupibileti.bg, allevents.in, Songkick, официални сайтове).</p>
            <p>Клубните DJ програми (Yalta, КУПЕ, CLWD и др.) се обявяват седмично в Instagram/Facebook на съответния клуб — приложението не претендира да ги изброи в реално време, затова има директен бутон към социалните им мрежи.</p>
            <p>Картата вече показва реални улици на София (OpenStreetMap / CARTO), но координатите на част от местата не са GPS-потвърдени — те са приблизителни, в рамките на верния квартал.</p>
            <p>Снимките са placeholder изображения, не реални снимки на местата или изпълнителите.</p>
            <p>Бутоните „Купи билет“ водят или към конкретната билетна платформа (когато е потвърдена), или към търсене на събитието, когато нямаме потвърден директен линк.</p>
            <p>Рейтингите (звезди), които виждаш при отваряне на заведение, са реални Google рейтинги, потвърдени чрез търсене — засега само за няколко от най-известните места (Yalta Club, Sofia Live Club, Хамбара). За останалите нямаме проверена цифра, затова не показваме рейтинг вместо да го измисляме.</p>
            <p>Всяко заведение и събитие вече има отделни бутони за Instagram и Facebook. Там, където намерихме потвърдена официална страница (напр. Yalta Club, CLWD, Club 33, Plazza), линкваме директно към нея — иначе бутонът отваря търсене в съответната мрежа по име, вместо да измисляме несъществуващ адрес.</p>
            <p>Добавихме и секция „Театър“ — с два реални театъра (Народен театър „Иван Вазов" и Театър София) и реални представления от техните текущи програми.</p>
          </div>
        </Sheet>
      )}
      {notifOpen && (
        <Sheet onClose={() => setNotifOpen(false)}>
          <div style={{ padding: 18 }}>
            <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 17, margin: "0 0 12px" }}>Известия</h2>
            {[
              ["📅", `${upcoming.length} предстоящи реални събития са заредени в приложението.`],
              ["📍", `${VENUES.length - 1} заведения вече са добавени в картата на София.`],
              ["🎉", `${FESTIVALS.length} фестивала предстоят — виж раздел „Фестивали“.`],
              ["🔔", "Клубните DJ програми се обновяват седмично — следвай социалните мрежи на любимите си заведения за най-прясното."],
            ].map(([icon, text], i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: i < 3 ? `1px solid ${C.line}` : "none" }}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span style={{ fontSize: 13, color: C.inkDim, lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>
        </Sheet>
      )}
      {loginOpen && (
        <Sheet onClose={() => setLoginOpen(false)}>
          <LoginScreen onLogin={(name) => { setProfileName(name); setLoginOpen(false); }} />
        </Sheet>
      )}
    </div>
  );
}

/* ---------- real map (actual OpenStreetMap / CARTO dark tiles, real lat/lon) ---------- */
const TILE = 256;
const SOFIA_CENTER = { lat: 42.6977, lon: 23.3219 };
const DISTRICT_POINTS = [
  ["Център", 42.6977, 23.3219], ["Студентски град", 42.6534, 23.3550], ["Лозенец", 42.6739, 23.3129],
  ["Младост", 42.6377, 23.3773], ["Люлин", 42.7113, 23.2504], ["Овча купел", 42.6802, 23.2453],
  ["Красно село", 42.6890, 23.2934], ["Витоша (кв.)", 42.6423, 23.2760], ["Надежда", 42.7280, 23.2940],
  ["Изток", 42.6650, 23.3450], ["Иван Вазов", 42.6870, 23.3210], ["Оборище", 42.6970, 23.3400],
];
function lonToTileX(lon, z) { return ((lon + 180) / 360) * Math.pow(2, z); }
function latToTileY(lat, z) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z);
}
function tileXToLon(x, z) { return (x / Math.pow(2, z)) * 360 - 180; }
function tileYToLat(y, z) {
  const n = Math.pow(2, z);
  const rad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return (rad * 180) / Math.PI;
}
function nearestDistrict(lat, lon) {
  let best = "София", bestD = Infinity;
  for (const [name, dlat, dlon] of DISTRICT_POINTS) {
    const d = (lat - dlat) ** 2 + (lon - dlon) ** 2;
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}
function Pin({ color, size = 26 }) {
  return (
    <svg width={size} height={size * 1.33} viewBox="0 0 24 32" style={{ display: "block" }}>
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill={color} stroke="#0a0a10" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="4.2" fill="#0a0a10" />
    </svg>
  );
}
function RealMap({ venues, onPick, height = 380, interactive = true, initialZoom = 14, showLabel = false }) {
  const scrollRef = useRef(null);
  const [zoom, setZoom] = useState(initialZoom);
  const [label, setLabel] = useState("София");
  const pts = venues.filter((v) => v.lat != null && v.lon != null);
  const anchor = pts.length ? pts : [SOFIA_CENTER];
  const xs = anchor.map((v) => lonToTileX(v.lon, zoom) * TILE);
  const ys = anchor.map((v) => latToTileY(v.lat, zoom) * TILE);
  const minTileX = Math.floor(Math.min(...xs) / TILE) - 1;
  const maxTileX = Math.ceil(Math.max(...xs) / TILE) + 1;
  const minTileY = Math.floor(Math.min(...ys) / TILE) - 1;
  const maxTileY = Math.ceil(Math.max(...ys) / TILE) + 1;
  const cols = maxTileX - minTileX;
  const rows = maxTileY - minTileY;
  const tiles = [];
  for (let tx = minTileX; tx < maxTileX; tx++) for (let ty = minTileY; ty < maxTileY; ty++) tiles.push({ tx, ty });
  const centroidPX = xs.reduce((a, b) => a + b, 0) / xs.length - minTileX * TILE;
  const centroidPY = ys.reduce((a, b) => a + b, 0) / ys.length - minTileY * TILE;

  const updateLabel = () => {
    const el = scrollRef.current;
    if (!el) return;
    const cx = (el.scrollLeft + el.clientWidth / 2 + minTileX * TILE) / TILE;
    const cy = (el.scrollTop + el.clientHeight / 2 + minTileY * TILE) / TILE;
    setLabel(nearestDistrict(tileYToLat(cy, zoom), tileXToLon(cx, zoom)));
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, centroidPX - el.clientWidth / 2);
    el.scrollTop = Math.max(0, centroidPY - el.clientHeight / 2);
    updateLabel();
  }, [venues.length, zoom]);

  return (
    <div style={{ position: "relative" }}>
      <div ref={scrollRef} onScroll={interactive && showLabel ? updateLabel : undefined}
        style={{ position: "relative", height, overflow: interactive ? "auto" : "hidden", background: "#0d0d14", pointerEvents: interactive ? "auto" : "none" }}>
        <div style={{ position: "relative", width: cols * TILE, height: rows * TILE }}>
          {tiles.map(({ tx, ty }) => (
            <img key={`${tx}_${ty}`} src={`https://a.basemaps.cartocdn.com/dark_all/${zoom}/${tx}/${ty}.png`} alt=""
              style={{ position: "absolute", left: (tx - minTileX) * TILE, top: (ty - minTileY) * TILE, width: TILE, height: TILE, display: "block" }}
              onError={(e) => { e.target.style.background = C.surface2; }} draggable={false} />
          ))}
          {pts.map((v) => {
            const color = GENRES[v.genres[0]].color;
            const px = lonToTileX(v.lon, zoom) * TILE - minTileX * TILE;
            const py = latToTileY(v.lat, zoom) * TILE - minTileY * TILE;
            return (
              <button key={v.id} onClick={() => onPick && onPick(v)} title={v.name}
                style={{ position: "absolute", left: px - 13, top: py - 32, background: "none", border: "none", padding: 0, cursor: interactive ? "pointer" : "default", filter: "drop-shadow(0 2px 4px rgba(0,0,0,.6))" }}>
                <Pin color={color} />
              </button>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 8, bottom: 4, fontSize: 9, color: "rgba(255,255,255,0.55)", background: "rgba(0,0,0,0.35)", padding: "1px 5px", borderRadius: 4 }}>© OpenStreetMap © CARTO</div>
      </div>
      {showLabel && (
        <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(10,10,16,0.82)", border: `1px solid ${C.line}`, borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: C.ink, pointerEvents: "none" }}>📍 {label}</div>
      )}
      {interactive && (
        <div style={{ position: "absolute", top: 10, right: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={() => setZoom((z) => Math.min(17, z + 1))} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.line}`, background: "rgba(19,19,32,0.9)", color: C.ink, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>+</button>
          <button onClick={() => setZoom((z) => Math.max(11, z - 1))} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.line}`, background: "rgba(19,19,32,0.9)", color: C.ink, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>−</button>
        </div>
      )}
    </div>
  );
}
function MiniMap({ venues }) { return <RealMap venues={venues} height={150} interactive={false} initialZoom={12} />; }
function BigMap({ venues, onPick, height = 380 }) { return <RealMap venues={venues} onPick={onPick} height={height} interactive={!!onPick} initialZoom={13} showLabel={!!onPick} />; }

function EventDetail({ ev, venue, going, onGoing, onOpenVenue }) {
  const dLeft = daysUntil(ev.date);
  return (
    <div>
      <img src={venue.img} alt="" style={{ width: "100%", height: 190, objectFit: "cover" }} />
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 18, margin: 0, maxWidth: 260 }}>{ev.title}</h2>
          <GenreBadge genre={ev.genre} size="md" />
        </div>
        <div style={{ fontSize: 13, color: C.inkDim, margin: "8px 0" }}>🎤 {ev.artist}</div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", color: C.inkDim, fontSize: 12.5, margin: "0 0 12px" }}>
          <span>📅 {weekday(ev.date)}, {fmt(ev.date)}{dLeft > 0 ? ` · след ${dLeft} дни` : dLeft === 0 ? " · днес" : ""}</span>
          <span>🕚 {ev.time}</span>
          <span onClick={onOpenVenue} style={{ cursor: "pointer", color: C.brand2 }}>📍 {venue.name}</span>
        </div>
        <p style={{ fontSize: 13, color: C.inkDim, lineHeight: 1.5, margin: "0 0 16px" }}>{ev.desc}</p>

        <div onClick={onOpenVenue} style={{ cursor: "pointer", height: 110, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}><BigMap venues={[venue]} height={110} /></div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <LinkBtn href={ev.ticketUrl}>🎫 {ev.ticketLabel || "Купи билет"}</LinkBtn>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <LinkBtn href={ev.instagram}>📷 Instagram</LinkBtn>
          <LinkBtn href={ev.social}>📘 Facebook</LinkBtn>
        </div>
        <button onClick={onGoing} style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "none", cursor: "pointer", background: going ? C.surface2 : `linear-gradient(135deg, ${C.brand}, ${C.brand2})`, color: going ? C.brand : "#fff", fontWeight: 800, fontSize: 14.5 }}>{going ? "✓ Ще ходиш" : "ЩЕ ХОДЯ"}</button>
      </div>
    </div>
  );
}

function VenueDetail({ venue, events, fav, onFav, onOpenEvent }) {
  return (
    <div>
      <img src={venue.img} alt="" style={{ width: "100%", height: 190, objectFit: "cover" }} />
      <div style={{ padding: 16 }}>
        {venue.statusWarning && (
          <div style={{ background: hex2rgba("#ff9a3d", 0.16), border: `1px solid ${hex2rgba("#ff9a3d", 0.5)}`, borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#ff9a3d", marginBottom: 12 }}>
            ⚠️ {venue.statusWarning}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 18, margin: 0 }}>{venue.name}</h2>
          <button onClick={onFav} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>{fav ? "❤️" : "🤍"}</button>
        </div>
        <div style={{ color: C.inkDim, fontSize: 12.5, margin: "6px 0 4px" }}>📍 {venue.address} · {venue.district} · {TYPE_LABELS[venue.type]}</div>
        {venue.rating != null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ color: "#ffcf4d", fontSize: 13 }}>{"★".repeat(Math.round(venue.rating))}{"☆".repeat(5 - Math.round(venue.rating))}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{venue.rating.toFixed(1)}</span>
            <span style={{ fontSize: 11, color: C.inkFaint }}>({venue.ratingSource}, потвърдено чрез търсене)</span>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: 10 }}>Няма проверен рейтинг в наличните ни източници.</div>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>{venue.genres.map((g) => <GenreBadge key={g} genre={g} />)}</div>
        <p style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5, margin: "0 0 14px" }}>{venue.note}</p>

        {venue.type === "cinema" && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, margin: "0 0 8px" }}>Сега се прожектира</div>
            {venue.nowShowing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {venue.nowShowing.map((f, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < venue.nowShowing.length - 1 ? `1px solid ${C.line}` : "none" }}>
                    <span style={{ fontSize: 13 }}>{f.title}</span>
                    {f.subGenre && <span style={{ fontSize: 10.5, color: C.inkFaint }}>{CINEMA_GENRES[f.subGenre] || f.subGenre}</span>}
                  </div>
                ))}
                <div style={{ fontSize: 10.5, color: C.inkFaint, marginTop: 4 }}>{venue.nowShowingNote || "Часовете на прожекциите се сменят ежедневно — виж точния час на сайта на киното."}</div>
              </div>
            ) : (
              <div style={{ color: C.inkFaint, fontSize: 12.5 }}>Нямаме заредена днешна програма за тази зала — виж уебсайта за точните филми и часове.</div>
            )}
          </div>
        )}

        <div style={{ fontSize: 13.5, fontWeight: 700, margin: "0 0 8px" }}>Известни предстоящи събития тук</div>
        {events.length === 0 && <div style={{ color: C.inkFaint, fontSize: 12.5, marginBottom: 10 }}>Нямаме конкретна обявена дата в момента — виж социалните мрежи на заведението за седмичната програма.</div>}
        {events.map((e) => (
          <div key={e.id} onClick={() => onOpenEvent(e)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13 }}>
            <span>{weekday(e.date)}, {fmt(e.date)} — {e.title}</span><span style={{ color: C.inkDim }}>{e.time}</span>
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <LinkBtn href={venue.website}>🌐 Уебсайт</LinkBtn>
          <LinkBtn href={venue.instagram}>📷 Instagram</LinkBtn>
          <LinkBtn href={venue.facebook}>📘 Facebook</LinkBtn>
        </div>
      </div>
    </div>
  );
}

function FestivalDetail({ f }) {
  return (
    <div>
      <img src={img(f.id, 700, 300)} alt="" style={{ width: "100%", height: 190, objectFit: "cover" }} />
      <div style={{ padding: 16 }}>
        <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 18, margin: "0 0 8px" }}>{f.name}</h2>
        <div style={{ display: "flex", gap: 14, color: C.inkDim, fontSize: 12.5, marginBottom: 10, flexWrap: "wrap" }}>
          <span>📅 от {fmt(f.date)}</span><span>📍 {f.place}</span>
        </div>
        <GenreBadge genre={f.genre} size="md" />
        <p style={{ fontSize: 13, color: C.inkDim, lineHeight: 1.5, margin: "16px 0" }}>{f.note}</p>
        <LinkBtn href={f.ticketUrl}>🎫 {f.ticketLabel}</LinkBtn>
      </div>
    </div>
  );
}

function SmartFinder({ onClose, venueById, upcoming, onOpenEvent }) {
  const [genre, setGenre] = useState(null);
  const results = useMemo(() => (!genre ? upcoming : upcoming.filter((e) => e.genre === genre)).slice(0, 8), [genre, upcoming]);
  return (
    <div style={{ padding: 18 }}>
      <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 18, margin: "0 0 4px" }}>Какво ще правим тая вечер?</h2>
      <p style={{ color: C.inkDim, fontSize: 12.5, margin: "0 0 16px" }}>Избери музика и виж реални предстоящи събития.</p>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 14 }}>
        <Chip active={!genre} onClick={() => setGenre(null)}>Всички</Chip>
        {GENRE_LIST.map((g) => <Chip key={g} active={genre === g} color={GENRES[g].color} onClick={() => setGenre(g)}>{GENRES[g].label}</Chip>)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {results.map((e) => (
          <div key={e.id} onClick={() => onOpenEvent(e)} style={{ cursor: "pointer", display: "flex", gap: 10, background: C.surface2, borderRadius: 12, overflow: "hidden" }}>
            <img src={venueById[e.venueId].img} alt="" style={{ width: 72, height: 72, objectFit: "cover" }} />
            <div style={{ padding: "8px 10px" }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{e.title}</div>
              <div style={{ fontSize: 11.5, color: C.inkDim }}>{venueById[e.venueId]?.name || "—"} · {fmt(e.date)}</div>
            </div>
          </div>
        ))}
        {results.length === 0 && <div style={{ color: C.inkFaint, fontSize: 12.5 }}>Няма предстоящи събития от този жанр в момента.</div>}
      </div>
    </div>
  );
}

function SearchScreen({ query, setQuery, results, onOpenEvent, onOpenVenue, onOpenFestival }) {
  return (
    <div style={{ padding: 16 }}>
      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Yalta, техно, Хоротека..." style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.line}`, background: C.surface2, color: C.ink, fontSize: 14, marginBottom: 14 }} />
      {!results && <div style={{ color: C.inkFaint, fontSize: 12.5 }}>Търси реални събития, заведения и фестивали.</div>}
      {results && (
        <div>
          {results.events.length > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: C.inkDim, margin: "6px 0" }}>Събития</div>}
          {results.events.map((e) => <div key={e.id} onClick={() => onOpenEvent(e)} style={{ cursor: "pointer", padding: "8px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13.5 }}>{e.title}</div>)}
          {results.venues.length > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: C.inkDim, margin: "12px 0 6px" }}>Заведения</div>}
          {results.venues.map((v) => <div key={v.id} onClick={() => onOpenVenue(v)} style={{ cursor: "pointer", padding: "8px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13.5 }}>{v.name}</div>)}
          {results.festivals.length > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: C.inkDim, margin: "12px 0 6px" }}>Фестивали</div>}
          {results.festivals.map((f) => <div key={f.id} onClick={() => onOpenFestival(f)} style={{ cursor: "pointer", padding: "8px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13.5 }}>{f.name}</div>)}
          {results.events.length + results.venues.length + results.festivals.length === 0 && <div style={{ color: C.inkFaint, fontSize: 12.5 }}>Няма резултати за „{query}“.</div>}
        </div>
      )}
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [name, setName] = useState("");
  return (
    <div style={{ padding: 22 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.brand}, ${C.brand2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 14 }}>🌙</div>
      <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 19, margin: "0 0 6px" }}>Вход в профила</h2>
      <p style={{ color: C.inkDim, fontSize: 12.5, margin: "0 0 18px" }}>Demo екран — не е свързан с истински бекенд, само пази името ти локално в тази сесия.</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Твоето име" style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.line}`, background: C.surface2, color: C.ink, fontSize: 14, marginBottom: 12 }} />
      <button onClick={() => name.trim() && onLogin(name.trim())} style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${C.brand}, ${C.brand2})`, color: "#fff", fontWeight: 800, fontSize: 14.5, marginBottom: 14 }}>Влез</button>
      <div style={{ textAlign: "center", color: C.inkFaint, fontSize: 11.5, margin: "0 0 14px" }}>или</div>
      <div style={{ display: "flex", gap: 8 }}>
        {["Google", "Apple", "Facebook"].map((p) => (
          <button key={p} disabled style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: `1px solid ${C.line}`, background: C.surface2, color: C.inkFaint, fontSize: 11.5, fontWeight: 600, cursor: "not-allowed" }}>{p}</button>
        ))}
      </div>
      <div style={{ color: C.inkFaint, fontSize: 10.5, marginTop: 10, textAlign: "center" }}>Бутоните за Google/Apple/Facebook са само визуален пример — реална връзка изисква истински бекенд.</div>
    </div>
  );
}
