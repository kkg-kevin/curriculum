const db = require("../../config/db");
const { createRecord, updateRecord, firstOrNull, stringifyJsonFields, generateId } = require("../../shared/utils/model.utils");

// Thin Knex wrappers over the two check-in tables (see the 20261022130000 and 20261026110000
// migrations). The rules — who may do what — live in checkin.service.js.

const SCHEDULES = "checkin_schedules";
const SESSIONS = "checkin_sessions";
const SESSION_JSON = ["report"];

const parseJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
};
const shapeSession = (row) => (row ? { ...row, report: parseJson(row.report, null) } : row);

const CheckinModel = {
  db,

  // ---- Schedules ----
  createSchedule(data, connection = db) { return createRecord(connection, SCHEDULES, data); },
  updateSchedule(id, data, connection = db) { return updateRecord(connection, SCHEDULES, id, data); },
  findSchedule(id, connection = db) { return firstOrNull(connection(SCHEDULES).where({ id })); },
  listSchedules({ ownerAdminId, hubId, status } = {}) {
    let q = db(SCHEDULES).where({ ownerAdminId });
    if (hubId) q = q.where({ hubId });
    if (status) q = q.where({ status });
    return q.orderBy("createdAt", "desc");
  },
  activeSchedules(ownerAdminId = null) {
    let q = db(SCHEDULES).where({ status: "active" });
    if (ownerAdminId) q = q.where({ ownerAdminId });
    return q;
  },

  // ---- Check-ins ----
  // Adds the check-ins not on file yet; one already there for the same (schedule, date) is left
  // exactly as it is (the UNIQUE key), so this is safe to run any number of times.
  async insertSessionsIgnoringExisting(rows, connection = db) {
    if (!rows.length) return;
    const now = new Date();
    const prepared = rows.map((row) => stringifyJsonFields({ id: generateId(), createdAt: now, updatedAt: now, ...row }, SESSION_JSON));
    await connection(SESSIONS).insert(prepared).onConflict(["scheduleId", "occurrenceDate"]).ignore();
  },
  async findSession(id, connection = db, forUpdate = false) {
    let q = connection(SESSIONS).where({ id });
    if (forUpdate) q = q.forUpdate();
    return shapeSession(await firstOrNull(q));
  },
  async updateSession(id, data, connection = db) {
    return shapeSession(await updateRecord(connection, SESSIONS, id, stringifyJsonFields(data, SESSION_JSON)));
  },
  sessionsQuery(ownerAdminId) { return db(SESSIONS).where({ ownerAdminId }); },
  async findSessions(query) { return (await query).map(shapeSession); },

  transaction(work) { return db.transaction(work); },
};

module.exports = CheckinModel;
module.exports._internal = { shapeSession };
