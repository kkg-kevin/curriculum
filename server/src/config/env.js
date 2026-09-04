const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  COOKIE_NAME: "token",
  // Mirrors client/src/config/authConfig.js — flip both back to false together to
  // bypass login enforcement for local work. While false, `protect` lets every request through.
  AUTH_ENABLED: true,
  CLIENT_URL: process.env.CLIENT_URL,
  // The public digifunzi-landing site — cookie-less origin(s) that only ever call the
  // /api/public/* routes. Optional: those routes work fine with this unset (no browser CORS
  // check applies to a same-origin curl/server-to-server call), it only matters once the
  // landing site is actually deployed and calling this API from a browser.
  // Comma-separated to allow several origins at once, e.g.
  //   PUBLIC_SITE_URL=https://africa.digifunzi.com,http://localhost:5175,http://localhost:4199
  // (deployed site + Vite dev server + the build-time prerender's origin).
  PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
  // This API's own externally-visible base URL, e.g. https://nodeapp.digifunzi.com — used to
  // turn stored relative "/uploads/..." media paths into absolute URLs in the /api/public/*
  // responses, since the landing site consumes them cross-origin (an <img src="/uploads/x">
  // there would resolve against the landing site's own origin, not this API). Optional: if
  // unset, public responses fall back to returning the raw stored value.
  API_PUBLIC_URL: process.env.API_PUBLIC_URL,
  // Outbound email — all optional. Unset means mailer.js silently no-ops (logs, doesn't throw),
  // so auto-ack/reply/digest emails degrade to a no-op instead of blocking the request that
  // triggered them. Works against any standard SMTP account (Google Workspace, a transactional
  // provider's SMTP endpoint, etc) — no vendor-specific SDK.
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  MAIL_FROM: process.env.MAIL_FROM,
  MAIL_REPLY_TO: process.env.MAIL_REPLY_TO,
  DB_HOST: process.env.DB_HOST || "127.0.0.1",
  DB_PORT: Number(process.env.DB_PORT) || 3306,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
};

// Fail fast at boot with a clear message instead of starting successfully and failing later
// with an opaque Knex connection error or a JWT-signing crash on the first real request — every
// one of these is required for the app to do anything, so there's no valid state where starting
// without them is better than refusing to start.
const REQUIRED_KEYS = ["JWT_SECRET", "CLIENT_URL", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missing = REQUIRED_KEYS.filter((key) => !env[key]);
if (missing.length) {
  throw new Error(
    `Missing required environment variable(s): ${missing.join(", ")}. Check your .env file.`
  );
}

module.exports = env;
