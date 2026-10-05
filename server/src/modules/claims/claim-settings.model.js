const db = require("../../config/db");
const { createRecord, updateRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "claim_settings";

// What a workspace pays when it has never changed anything: KSh 904.666 a session, and an
// advance of 30% of the whole course.
const DEFAULTS = { sessionRate: 904.666, advancePercent: 30, currency: "KES" };

function shape(row) {
  return { sessionRate: Number(row.sessionRate), advancePercent: Number(row.advancePercent), currency: row.currency || DEFAULTS.currency };
}

// One row per workspace (admin). A workspace with no row yet simply runs on DEFAULTS — the row is
// only written the first time an admin changes something.
const ClaimSettingsModel = {
  DEFAULTS,

  async get(ownerAdminId) {
    if (!ownerAdminId) return { ...DEFAULTS };
    const row = await firstOrNull(db(TABLE).where({ ownerAdminId }));
    return row ? shape(row) : { ...DEFAULTS };
  },

  async save(ownerAdminId, data) {
    const existing = await firstOrNull(db(TABLE).where({ ownerAdminId }));
    if (existing) return shape(await updateRecord(db, TABLE, existing.id, data));
    return shape(await createRecord(db, TABLE, { ...DEFAULTS, ...data, ownerAdminId }));
  },
};

module.exports = ClaimSettingsModel;
