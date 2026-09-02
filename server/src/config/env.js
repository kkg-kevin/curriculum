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
  // The public digifunzi-landing site — a second, cookie-less origin that only ever calls
  // POST /api/public/leads and /api/public/contact. Optional: those two routes work fine with
  // this unset (no browser CORS check applies to a same-origin curl/server-to-server call), it
  // only matters once the landing site is actually deployed and calling this API from a browser.
  PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
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
