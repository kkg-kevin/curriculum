// localStorage that never throws. A browser blocking site data (cookies/storage switched off, some
// in-app browsers, strict privacy modes) throws on merely READING `window.localStorage` — "Failed
// to read the 'localStorage' property from 'Window': Access is denied for this document" — and
// `typeof window !== "undefined"` doesn't catch that. Unguarded, it broke sign-in on live (3 Nov
// 2026): api.js reads the active child / hub on every request. Here a blocked browser falls back
// to memory, so choices still hold for the open page; they just aren't remembered after a reload.
const memory = new Map();

function storage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readLocal(key) {
  try {
    const store = storage();
    if (store) return store.getItem(key);
  } catch {
    /* blocked — memory below */
  }
  return memory.has(key) ? memory.get(key) : null;
}

export function writeLocal(key, value) {
  memory.set(key, String(value));
  try {
    storage()?.setItem(key, String(value));
  } catch {
    /* blocked or full — memory keeps it for this page */
  }
}

// The same for sessionStorage — this tab only, kept across a refresh, gone when the tab closes.
// Where sessionStorage is blocked too, the tab's own name (`window.name`) holds it instead: it also
// belongs to this one tab and survives a refresh, and browsers clear it when the tab goes to
// another site. So a sign-in in a browser that blocks every kind of storage survives a refresh.
const NAME_PREFIX = "digifunzi:";
function sessionStore() {
  try {
    const store = typeof window !== "undefined" ? window.sessionStorage : null;
    if (!store) return null;
    store.getItem(NAME_PREFIX); // some browsers only throw on use
    return store;
  } catch {
    return null;
  }
}
function readTabName() {
  try {
    const name = typeof window !== "undefined" ? window.name || "" : "";
    return name.startsWith(NAME_PREFIX) ? JSON.parse(name.slice(NAME_PREFIX.length)) || {} : {};
  } catch {
    return {};
  }
}
function writeTabName(values) {
  try {
    if (typeof window === "undefined") return;
    window.name = Object.keys(values).length ? NAME_PREFIX + JSON.stringify(values) : "";
  } catch {
    /* nothing left to keep it in — this page only */
  }
}
export function readSession(key) {
  const store = sessionStore();
  if (store) {
    try {
      return store.getItem(key);
    } catch {
      /* fall through */
    }
  }
  const value = readTabName()[key];
  return value == null ? null : String(value);
}
export function writeSession(key, value) {
  const store = sessionStore();
  if (store) {
    try {
      store.setItem(key, String(value));
      return;
    } catch {
      /* fall through */
    }
  }
  writeTabName({ ...readTabName(), [key]: String(value) });
}
export function removeSession(key) {
  const store = sessionStore();
  if (store) {
    try {
      store.removeItem(key);
    } catch {
      /* fall through */
    }
  }
  const values = readTabName();
  if (key in values) {
    delete values[key];
    writeTabName(values);
  }
}

export function removeLocal(key) {
  memory.delete(key);
  try {
    storage()?.removeItem(key);
  } catch {
    /* blocked */
  }
}
