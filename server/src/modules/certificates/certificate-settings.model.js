const db = require("../../config/db");
const { createRecord, updateRecord, firstOrNull } = require("../../shared/utils/model.utils");

const TABLE = "certificate_settings";
const FIELDS = ["signatoryName", "signatoryTitle", "signatureImage"];

const EMPTY = { signatoryName: null, signatoryTitle: null, signatureImage: null };

// One row per workspace (admin): who signs its certificates. A workspace with no row yet has no
// signatory — its certificates carry the verification QR alone.
const CertificateSettingsModel = {
  async get(ownerAdminId) {
    if (!ownerAdminId) return { ...EMPTY };
    const row = await firstOrNull(db(TABLE).where({ ownerAdminId }));
    return Object.fromEntries(FIELDS.map((f) => [f, row?.[f] || null]));
  },

  // Always the whole set — a field left out is cleared, so the form saves what it shows.
  async save(ownerAdminId, values) {
    const data = Object.fromEntries(FIELDS.map((f) => [f, values[f] || null]));
    const existing = await firstOrNull(db(TABLE).where({ ownerAdminId }));
    if (existing) await updateRecord(db, TABLE, existing.id, data);
    else await createRecord(db, TABLE, { ...data, ownerAdminId });
    return data;
  },
};

module.exports = CertificateSettingsModel;
