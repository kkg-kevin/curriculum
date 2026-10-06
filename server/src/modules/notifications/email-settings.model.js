const db = require("../../config/db");
const { createRecord, updateRecord, firstOrNull, toJson } = require("../../shared/utils/model.utils");

const TABLE = "email_settings";

// One row per workspace (admin). A workspace with no row yet sends every email — the row is only
// written the first time an admin switches something off.
const EmailSettingsModel = {
  // The email types this workspace has switched off.
  async disabledTypes(ownerAdminId) {
    if (!ownerAdminId) return [];
    const row = await firstOrNull(db(TABLE).where({ ownerAdminId }));
    return Array.isArray(row?.disabledTypes) ? row.disabledTypes : [];
  },

  async saveDisabledTypes(ownerAdminId, disabledTypes) {
    const existing = await firstOrNull(db(TABLE).where({ ownerAdminId }));
    const data = { disabledTypes: toJson(disabledTypes) };
    if (existing) await updateRecord(db, TABLE, existing.id, data);
    else await createRecord(db, TABLE, { ...data, ownerAdminId });
    return disabledTypes;
  },
};

module.exports = EmailSettingsModel;
