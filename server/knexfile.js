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
  pool: { min: 0, max: 10 },
  migrations: {
    directory: "./src/db/migrations",
    tableName: "knex_migrations",
  },
  seeds: {
    directory: "./src/db/seeds",
  },
};
