const db = require("../../config/db");
const DraftModel = require("./draft.model");
const { KINDS } = require("./draft.kinds");
const { ASSESSMENT_TYPES } = require("../assessments/assessment.validation");

// Unsaved work in the portal's long forms (draft.kinds.js), kept in the workspace rather than one
// browser so it survives the page closing and is open to everyone in the workspace — several
// people often share one account. A form writes here as it is typed and deletes its draft once the
// record is saved; see client/src/hooks/useWorkspaceDraft.js.
//
// Every call takes `kinds`: the kinds the route it came through serves (assessment drafts under
// /api/assessments, course and session drafts under /api/courses), so each stays behind its own
// module's staff permission.

function fail(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
}

// What the lists show for a draft: its name as typed so far (a course form keeps its fields under
// `values`; a session's is its title).
const nameOf = (content) => String(content?.name ?? content?.values?.name ?? content?.title ?? "").trim().slice(0, 255);

async function requireOwnDraft(id, ownerAdminId, kinds) {
  const draft = await DraftModel.findById(id);
  if (!draft || draft.ownerAdminId !== ownerAdminId || !kinds.includes(draft.kind)) throw fail("Draft not found", 404);
  return draft;
}

// id → name for the given ids of `table`. Looked up separately rather than joined: tables made at
// different times can carry different collations on some installs, and MySQL refuses to compare
// their id columns directly.
async function namesById(table, column, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!table || unique.length === 0) return new Map();
  const rows = await db(table).whereIn("id", unique).select("id", `${column} as label`);
  return new Map(rows.map((row) => [row.id, row.label]));
}

const DraftService = {
  // Each draft comes with who last wrote it, the name of the record it edits (recordName) and, for
  // a session, its course (parentName). A draft whose record has since been deleted is removed here.
  async list(ownerAdminId, kinds, { kind, recordId, parentId } = {}) {
    const drafts = await DraftModel.findAll({ ownerAdminId, kinds, kind, recordId, parentId });
    const people = await namesById("users", "name", drafts.map((d) => d.lastEditedBy));
    const records = new Map();
    const parents = new Map();
    for (const k of new Set(drafts.map((d) => d.kind))) {
      const config = KINDS[k];
      const ofKind = drafts.filter((d) => d.kind === k);
      records.set(k, await namesById(config.table, config.nameColumn, ofKind.map((d) => d.recordId)));
      parents.set(k, await namesById(config.parentTable, "name", ofKind.map((d) => d.parentId)));
    }
    const orphans = drafts.filter((d) => d.recordId && !records.get(d.kind).has(d.recordId)).map((d) => d.id);
    await DraftModel.deleteMany(orphans);
    return drafts
      .filter((d) => !orphans.includes(d.id))
      .map((d) => ({
        ...d,
        lastEditedByName: people.get(d.lastEditedBy) || null,
        recordName: d.recordId ? records.get(d.kind).get(d.recordId) ?? null : null,
        parentName: d.parentId ? parents.get(d.kind).get(d.parentId) ?? null : null,
      }));
  },

  get(id, ownerAdminId, kinds) {
    return requireOwnDraft(id, ownerAdminId, kinds);
  },

  async create(ownerAdminId, userId, kinds, { kind = kinds[0], recordId, type, content }) {
    if (!kinds.includes(kind)) throw fail("Unknown kind of draft", 400);
    const config = KINDS[kind];
    let parentId = null;
    if (recordId) {
      const record = await config.resolve(recordId);
      if (!record || record.ownerAdminId !== ownerAdminId) throw fail("Record not found", 404);
      type = record.type ?? null;
      parentId = record.parentId;
    } else if (!config.canBeNew) {
      throw fail("This draft needs the record it belongs to", 400);
    }
    if (kind === "assessment" && !ASSESSMENT_TYPES.includes(type)) throw fail("Select a valid assessment type", 400);
    return DraftModel.create({
      ownerAdminId, kind, recordId: recordId || null, parentId, type: kind === "assessment" ? type : null,
      name: nameOf(content), content, lastEditedBy: userId,
    });
  },

  // Refused (409, DRAFT_CHANGED) when someone else has written the draft since `revision` — the
  // form then keeps this person's work as a draft of its own rather than overwrite theirs.
  async update(id, ownerAdminId, userId, kinds, { revision, content }) {
    await requireOwnDraft(id, ownerAdminId, kinds);
    const updated = await DraftModel.updateAtRevision(id, revision, { name: nameOf(content), content, lastEditedBy: userId });
    if (!updated) throw fail("Someone else has changed this draft since you opened it", 409, "DRAFT_CHANGED");
    return updated;
  },

  async remove(id, ownerAdminId, kinds) {
    await requireOwnDraft(id, ownerAdminId, kinds);
    await DraftModel.delete(id);
    return { message: "Draft deleted" };
  },
};

module.exports = DraftService;
