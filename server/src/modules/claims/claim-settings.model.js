const db = require("../../config/db");
const { createRecord, updateRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "claim_settings";

// What a workspace pays when it has never changed anything: KSh 904.666 a session, no hourly or
// daily rate and no Base plus commission (not offered until set), and an advance of 30% of the
// whole course. These are the part-time rates — full-time educators don't claim (see
// claim.service.js).
const DEFAULTS = { sessionRate: 904.666, hourlyRate: null, dailyRate: null, commissionRate: null, advancePercent: 30, currency: "KES" };

const rateOrNull = (value) => (value == null || Number(value) <= 0 ? null : Number(value));

function shape(row) {
  return {
    sessionRate: rateOrNull(row.sessionRate),
    hourlyRate: rateOrNull(row.hourlyRate),
    dailyRate: rateOrNull(row.dailyRate),
    // Base plus: the commission per enrolled learner, on top of the session rate, each session.
    commissionRate: rateOrNull(row.commissionRate),
    advancePercent: Number(row.advancePercent),
    currency: row.currency || DEFAULTS.currency,
  };
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
