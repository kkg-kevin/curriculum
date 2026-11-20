const db = require("../../config/db");

// Session numbers start again in each module (19 Nov 2026, user): Module 1's sessions are 1..12,
// Module 2's are 1..12 again — never one count running across the whole course. The same rule as
// the course pages (client courses/sectionConfig.js buildModuleLocalSessionIndex): sessions with
// no module, or a module since deleted, are numbered together as one group.
//
// numberSessions(sessions, modules) → Map(sessionId → { number, count, moduleId, moduleName,
// moduleNumber }); `number` is 1-based within the module, `count` that module's session count,
// moduleName / moduleNumber null for module-less sessions (and for a course with no modules).
// A course's sessions in the order the course pages list them (client courses/sectionConfig.js's
// groupSessionsByModule): the modules in their order, each module's sessions in their order, then
// sessions with no module (or a deleted one). Since 20 Nov 2026 everything that asks "which is a
// module's / the course's last session" or lists a course's sessions in turn uses this — sorting the
// whole course by each session's own `order` disagreed with the course pages whenever those numbers
// restart in each module or a module was moved after its sessions were made (Reports pointed at the
// wrong module's sessions, and a module's certificates couldn't be found).
function courseOrder(sessions, modules = []) {
  const position = new Map([...modules].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)).map((m, i) => [m.id, i]));
  const rank = (s) => (s.moduleId && position.has(s.moduleId) ? position.get(s.moduleId) : Number.MAX_SAFE_INTEGER);
  return [...sessions].map((s, i) => ({ s, i })).sort((a, b) =>
    rank(a.s) - rank(b.s) || (Number(a.s.order) || 0) - (Number(b.s.order) || 0) || a.i - b.i,
  ).map(({ s }) => s);
}

function numberSessions(sessions, modules = []) {
  const ordered = [...modules].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  const moduleById = new Map(ordered.map((m, i) => [m.id, { ...m, number: i + 1 }]));
  const keyOf = (s) => (s.moduleId && moduleById.has(s.moduleId) ? s.moduleId : null);
  const byOrder = courseOrder(sessions, modules);
  const totals = new Map();
  for (const s of byOrder) totals.set(keyOf(s), (totals.get(keyOf(s)) || 0) + 1);
  const seen = new Map();
  const out = new Map();
  for (const s of byOrder) {
    const key = keyOf(s);
    const number = (seen.get(key) || 0) + 1;
    seen.set(key, number);
    const m = key ? moduleById.get(key) : null;
    out.set(s.id, { number, count: totals.get(key), moduleId: m?.id || null, moduleName: m ? m.name || `Module ${m.number}` : null, moduleNumber: m?.number || null });
  }
  return out;
}

// One course's numbering, read fresh (a few seconds' cache: a calendar or report build asks for
// the same course many times in one go).
const TTL_MS = 5 * 1000;
const cache = new Map();
async function sessionNumbering(courseId) {
  if (!courseId) return new Map();
  const hit = cache.get(courseId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const [sessions, modules] = await Promise.all([
    db("course_sessions").where({ courseId }).select("id", "order", "moduleId"),
    db("course_modules").where({ courseId }).select("id", "name", "order"),
  ]);
  const value = numberSessions(sessions, modules);
  cache.set(courseId, { at: Date.now(), value });
  return value;
}

// The fields a session carries wherever it's shown: { sessionNumber, sessionCount, moduleName,
// moduleNumber } — all null when the session isn't found.
function placeFields(numbering, sessionId) {
  const p = numbering.get(sessionId);
  return { sessionNumber: p?.number ?? null, sessionCount: p?.count ?? null, moduleName: p?.moduleName ?? null, moduleNumber: p?.moduleNumber ?? null };
}

module.exports = { courseOrder, numberSessions, sessionNumbering, placeFields };
