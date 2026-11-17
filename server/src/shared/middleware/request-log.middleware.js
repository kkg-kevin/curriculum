const morgan = require("morgan");

// Request logging (17 Nov 2026). Every request used to be logged (morgan "dev"), on the hosts too —
// a line per request written to the app's log on shared hosting. Now only what needs a look:
//   [error] a request that failed on the server (5xx)
//   [slow]  a request that took SLOW_REQUEST_MS or longer (default 1500 ms) — the list of pages
//           worth optimising
// Paths only, never the query string (it can carry tokens). REQUEST_LOG=all brings back the full
// per-request log (handy locally).
function requestLog() {
  if (String(process.env.REQUEST_LOG || "").trim().toLowerCase() === "all") return morgan("dev");
  const slowMs = Number(process.env.SLOW_REQUEST_MS) || 1500;
  return (req, res, next) => {
    const started = process.hrtime.bigint();
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      const failed = res.statusCode >= 500;
      if (!failed && ms < slowMs) return;
      const path = String(req.originalUrl || req.url || "").split("?")[0];
      const line = `[${failed ? "error" : "slow"}] ${req.method} ${path} ${res.statusCode} ${Math.round(ms)}ms`;
      if (failed) console.error(line); else console.warn(line);
    });
    next();
  };
}

module.exports = { requestLog };
