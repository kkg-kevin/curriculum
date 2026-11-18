const db = require("../../config/db");
const { createRecord, updateRecord, firstOrNull, stringifyJsonFields, generateId } = require("../../shared/utils/model.utils");

// Thin Knex wrappers over the four expense tables (see the 20261118090000 migration). The rules
// live in expense.rules.js and expense.service.js.

const CLAIMS = "expense_claims";
const ITEMS = "expense_items";
const FILES = "expense_files";
const SETTINGS = "expense_settings";

// mysql2 hands DECIMAL columns back as strings.
const num = (v) => (v == null ? v : Number(v));
const shapeClaim = (row) => (row ? { ...row, totalAmount: num(row.totalAmount), approvedAmount: num(row.approvedAmount), timeline: Array.isArray(row.timeline) ? row.timeline : [] } : row);
const shapeItem = (row) => (row ? { ...row, amount: num(row.amount) } : row);

const ExpenseModel = {
  // ---- Claims --------------------------------------------------------------------------------
  async createClaim(data) {
    const record = await createRecord(db, CLAIMS, stringifyJsonFields(data, ["timeline"]));
    return ExpenseModel.findClaim(record.id);
  },

  async findClaim(id) {
    return shapeClaim(await firstOrNull(db(CLAIMS).where({ id })));
  },

  async findClaims({ ownerAdminId, claimantUserId, supervisorId, statuses, excludeDrafts = false, ids } = {}) {
    let q = db(CLAIMS);
    if (ownerAdminId) q = q.where({ ownerAdminId });
    if (claimantUserId) q = q.where({ claimantUserId });
    if (supervisorId) q = q.where({ supervisorId });
    if (statuses) q = q.whereIn("status", statuses);
    if (excludeDrafts) q = q.whereNot({ status: "draft" });
    if (ids) q = q.whereIn("id", ids.length ? ids : ["-"]);
    return (await q.orderBy([{ column: "updatedAt", order: "desc" }])).map(shapeClaim);
  },

  async updateClaim(id, data) {
    return shapeClaim(await updateRecord(db, CLAIMS, id, stringifyJsonFields(data, ["timeline"])));
  },

  // Moves a claim on only if it is still in one of `fromStatuses` — two reviewers acting on the
  // same claim at once can't both win. Returns null when it had already moved.
  async transition(id, fromStatuses, data) {
    const from = Array.isArray(fromStatuses) ? fromStatuses : [fromStatuses];
    const count = await db(CLAIMS).where({ id }).whereIn("status", from).update({ ...stringifyJsonFields(data, ["timeline"]), updatedAt: new Date() });
    if (count === 0) return null;
    return ExpenseModel.findClaim(id);
  },

  async deleteClaim(id) {
    await db.transaction(async (trx) => {
      await trx(ITEMS).where({ claimId: id }).del();
      await trx(CLAIMS).where({ id }).del();
    });
  },

  // EXP-0001, EXP-0002… per workspace, given when a claim is first sent.
  async nextNumber(ownerAdminId) {
    const row = await db(CLAIMS).where({ ownerAdminId }).whereNotNull("number").count({ n: "*" }).first();
    return `EXP-${String(Number(row?.n || 0) + 1).padStart(4, "0")}`;
  },

  // ---- Lines ---------------------------------------------------------------------------------
  async itemsOf(claimIds) {
    const ids = Array.isArray(claimIds) ? claimIds : [claimIds];
    if (!ids.length) return [];
    return (await db(ITEMS).whereIn("claimId", ids).orderBy(["claimId", "position"])).map(shapeItem);
  },

  // Saves the claim's lines as given: lines with a known id are updated, new ones added, the rest
  // removed. Returns the saved lines in order.
  async saveItems(claimId, ownerAdminId, items) {
    const now = new Date();
    const existing = await db(ITEMS).where({ claimId }).select("id");
    const known = new Set(existing.map((r) => r.id));
    const keep = new Set();
    const saved = [];
    await db.transaction(async (trx) => {
      for (const [position, item] of items.entries()) {
        const row = {
          position,
          spentOn: item.spentOn,
          category: item.category,
          description: item.description,
          vendor: item.vendor || null,
          amount: item.amount,
          mpesaCode: item.mpesaCode || null,
          noReceiptReason: item.noReceiptReason || null,
        };
        if (item.id && known.has(item.id)) {
          await trx(ITEMS).where({ id: item.id }).update({ ...row, updatedAt: now });
          keep.add(item.id);
          saved.push({ ...row, id: item.id, clientKey: item.clientKey });
        } else {
          const id = generateId();
          await trx(ITEMS).insert({ ...row, id, claimId, ownerAdminId, status: "open", createdAt: now, updatedAt: now });
          keep.add(id);
          saved.push({ ...row, id, clientKey: item.clientKey });
        }
      }
      const gone = [...known].filter((id) => !keep.has(id));
      if (gone.length) await trx(ITEMS).whereIn("id", gone).del();
    });
    return saved;
  },

  async setItemDecisions(claimId, decisions) {
    const now = new Date();
    await db.transaction(async (trx) => {
      for (const d of decisions) {
        await trx(ITEMS).where({ id: d.id, claimId }).update({ status: d.rejected ? "rejected" : "open", rejectionReason: d.rejected ? d.reason || null : null, updatedAt: now });
      }
    });
  },

  async reopenItems(claimId) {
    await db(ITEMS).where({ claimId }).update({ status: "open", rejectionReason: null, updatedAt: new Date() });
  },

  // ---- Files ---------------------------------------------------------------------------------
  async createFile(data) {
    const record = await createRecord(db, FILES, data, { updatedAt: false });
    return record;
  },

  async findFile(id) {
    return firstOrNull(db(FILES).where({ id }));
  },

  async filesByIds(ids) {
    if (!ids.length) return [];
    return db(FILES).whereIn("id", ids);
  },

  async filesOf(claimIds, { includeRemoved = false } = {}) {
    const ids = Array.isArray(claimIds) ? claimIds : [claimIds];
    if (!ids.length) return [];
    let q = db(FILES).whereIn("claimId", ids);
    if (!includeRemoved) q = q.whereNull("removedAt");
    return q.orderBy("createdAt");
  },

  async updateFile(id, data) {
    await db(FILES).where({ id }).update(data);
  },

  async deleteFiles(ids) {
    if (ids.length) await db(FILES).whereIn("id", ids).del();
  },

  // A person's uploads never saved on a claim, older than `before` — left behind by a form that
  // was closed.
  async strayFiles(uploadedBy, before) {
    return db(FILES).where({ uploadedBy }).whereNull("claimId").where("createdAt", "<", before);
  },

  // ---- Settings ------------------------------------------------------------------------------
  async settingsRow(ownerAdminId) {
    if (!ownerAdminId) return null;
    return firstOrNull(db(SETTINGS).where({ ownerAdminId }));
  },

  async saveSettings(ownerAdminId, data) {
    const row = stringifyJsonFields(data, ["categories"]);
    const existing = await firstOrNull(db(SETTINGS).where({ ownerAdminId }));
    if (existing) await updateRecord(db, SETTINGS, existing.id, row);
    else await createRecord(db, SETTINGS, { ...row, ownerAdminId });
    return ExpenseModel.settingsRow(ownerAdminId);
  },
};

module.exports = ExpenseModel;
