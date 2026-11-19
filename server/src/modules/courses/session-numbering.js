const db = require("../../config/db");

// Session numbers start again in each module (19 Nov 2026, user): Module 1's sessions are 1..12,
// Module 2's are 1..12 again — never one count running across the whole course. The same rule as
// the course pages (client courses/sectionConfig.js buildModuleLocalSessionIndex): sessions with
// no module, or a module since deleted, are numbered together as one group.
//
// numberSessions(sessions, modules) → Map(sessionId → { number, count, moduleId, moduleName,
// moduleNumber }); `number` is 1-based within the module, `count` that module's session count,
// moduleName / moduleNumber null for module-less sessions (and for a course with no modules).
function numberSessions(sessions, modules = []) {
  const ordered = [...modules].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  const moduleById = new Map(ordered.map((m, i) => [m.id, { ...m, number: i + 1 }]));
  const keyOf = (s) => (s.moduleId && moduleById.has(s.moduleId) ? s.moduleId : null);
  const byOrder = [...sessions].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
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

module.exports = { numberSessions, sessionNumbering, placeFields };
