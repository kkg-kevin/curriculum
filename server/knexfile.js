require("dotenv").config();

// mysql2 returns TINYINT(1) (what table.boolean() creates) as the raw number 0/1, not a real
// JS boolean — every boolean field (isPrimary, isCurrent, isProgram, reportPublished, etc.)
// would otherwise come back as 1/0 instead of true/false, changing the API's response shape
// from the JSON-file era. Cast just that one MySQL type back to a real boolean; every other
// type is left to mysql2's own default handling (see the dateStrings note below for the one
// other explicit override).
function typeCast(field, next) {
  if (field.type === "TINY" && field.length === 1) {
    const value = field.string();
    return value === null ? null : value === "1";
  }
  return next();
}

module.exports = {
  client: "mysql2",
  connection: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    timezone: "Z",
    // DATETIME columns stay JS Date objects (JSON.stringify still emits the same ISO-with-Z
    // format the JSON-file era used). DATE columns are calendar dates with no time/timezone
    // meaning — force those back to plain "YYYY-MM-DD" strings so date-only fields (attendance
    // date, schedule startDate, etc.) match exactly what every service already expects.
    dateStrings: ["DATE"],
    typeCast,
  },
  // Shared hosting caps how many connections one MySQL user may hold (max_user_connections,
  // often 10–30), and that cap is shared by every process signing in as that user — each app
  // instance, the mail cron, phpMyAdmin. A pool bigger than the cap doesn't buy throughput, it
  // makes MySQL refuse the connection mid-request ("already has more than 'max_user_connections'
  // active connections"). So the pool stays well under it: a request needing more connections
  // than the pool has waits its turn inside knex instead of failing. min:0 lets idle connections
  // close, so a quiet app holds none. Raise DB_POOL_MAX only on a host with a known higher cap.
  pool: { min: 0, max: Number(process.env.DB_POOL_MAX) || 8, idleTimeoutMillis: 30000 },
  migrations: {
    directory: "./src/db/migrations",
    tableName: "knex_migrations",
  },
  seeds: {
    directory: "./src/db/seeds",
  },
};
