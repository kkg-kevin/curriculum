// Where a hub's map link points, for the website's embedded map: the exact pin when the link
// holds coordinates, else a place name to search for, else null (the website then maps the
// address). Hubs store whatever link was shared from Google Maps — a short maps.app.goo.gl link,
// a share.google link, a full google.com/maps URL — so short links are followed to the full URL.
//
// The link is typed by an admin, so this only ever requests Google's own map/share hosts, checks
// every redirect hop against the same list, gives up after a few hops or seconds, and never
// reads a response body. Results (including failures) are remembered for a day per link.

const ALLOWED_HOSTS = new Set([
  "maps.app.goo.gl",
  "goo.gl",
  "share.google",
  "www.google.com",
  "google.com",
  "maps.google.com",
]);
// A Google URL is final (worth reading, not following) only once it's a maps or search page —
// share links pass through other google.com paths (e.g. /share.google?q=<id>) on the way.
const MAX_HOPS = 5;
const TIMEOUT_MS = 4000;
const CACHE_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;

const cache = new Map(); // link -> { pin, at }

function allowed(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const valid = (lat, lng) => lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

// Reads a pin out of a full Google Maps URL, most precise first:
//   …!3d<lat>!4d<lng>…        a place's own pin (a /maps/place/ link)
//   …!1d<lng>!2d<lat>…        a directions link's destination
//   ?q=<lat>,<lng> / ll=       an explicit point
//   /@<lat>,<lng>,<zoom>z      where the map was centred when shared
// then, with no coordinates, a place name: /maps/place/<name>/ or a search's q=<name>.
function pinFromUrl(url) {
  const decoded = decodeURIComponent(url);
  let m = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (m && valid(num(m[1]), num(m[2]))) return { lat: num(m[1]), lng: num(m[2]) };
  m = decoded.match(/!1d(-?\d+(?:\.\d+)?)!2d(-?\d+(?:\.\d+)?)/);
  if (m && valid(num(m[2]), num(m[1]))) return { lat: num(m[2]), lng: num(m[1]) };
  m = decoded.match(/[?&](?:q|ll|query)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (m && valid(num(m[1]), num(m[2]))) return { lat: num(m[1]), lng: num(m[2]) };
  m = decoded.match(/\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),/);
  if (m && valid(num(m[1]), num(m[2]))) return { lat: num(m[1]), lng: num(m[2]) };

  m = decoded.match(/\/maps\/place\/([^/@?]+)/);
  if (m) return { query: m[1].replace(/\+/g, " ").trim().slice(0, 200) };
  try {
    const q = new URL(url).searchParams.get("q");
    if (q && !/^-?\d/.test(q)) return { query: q.trim().slice(0, 200) };
  } catch {
    /* not a URL we can read */
  }
  return null;
}

async function follow(link) {
  let url = link;
  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    if (!allowed(url)) return null;
    const direct = pinFromUrl(url);
    const final = /^\/(maps|search)(\/|$)/.test(new URL(url).pathname) && !/^(maps\.app\.)?goo\.gl$|^share\.google$/.test(new URL(url).hostname);
    if (direct && (direct.lat !== undefined || final)) return direct;
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DigifunziMapPin/1.0)" },
    });
    // Never read the body — only where the link goes.
    try {
      await res.body?.cancel();
    } catch {
      /* already closed */
    }
    const next = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && next) {
      url = new URL(next, url).toString();
      continue;
    }
    return final ? direct : null;
  }
  return null;
}

/** { lat, lng } | { query } | null — never throws. */
async function resolveMapPin(link) {
  if (!link || typeof link !== "string") return null;
  const key = link.trim();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.pin;
  let pin = null;
  try {
    pin = await follow(key);
  } catch {
    pin = null;
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { pin, at: Date.now() });
  return pin;
}

module.exports = { resolveMapPin, pinFromUrl };
