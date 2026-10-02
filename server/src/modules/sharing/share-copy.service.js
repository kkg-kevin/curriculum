const db = require("../../config/db");
const { generateId } = require("../../shared/utils/model.utils");

// Copies content from one admin's workspace into another's (see sharing.service.js for who may
// ask). The copy is complete and independent: a course arrives with its modules, sessions, the
// assessments its sessions use, and the competencies, pathways and materials all of those are
// tagged with; a curriculum arrives with its whole framework and its courses. Nothing in the
// source workspace is touched, and nothing learner-related (classes, submissions, reports) is
// ever copied.
//
// How it works:
//   1. Collect  — start from the chosen records and follow what they refer to, until nothing new
//                 turns up. References are found by scanning the collected rows for the ids of
//                 the source admin's own content, so a reference buried in a JSON column counts.
//   2. Reuse    — something already copied from this admin earlier (shared_imports), or a
//                 Settings entry the receiving admin already has under the same name, is linked
//                 to rather than copied a second time.
//   3. Rewrite  — every collected row gets a new id, and every id it mentions is swapped for the
//                 new (or reused) one.
//   4. Insert   — all in one transaction.

const UUID_SOURCE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_ANYWHERE = new RegExp(UUID_SOURCE, "gi");
const UUID_EXACT = new RegExp(`^${UUID_SOURCE}$`, "i");
const isUuid = (value) => typeof value === "string" && UUID_EXACT.test(value);

// Content an admin owns outright — what can be picked to copy, and what a reference is followed to.
const ROOT_TABLES = ["competencies", "pathway_templates", "system_levels", "items", "assessments", "courses", "curricula"];

// Settings entries: one per name in a workspace, so an incoming one with a name already there
// links to the existing entry.
const CATALOG_TABLES = new Set(["competencies", "pathway_templates", "system_levels", "items"]);

// The rows that belong to a record and are copied with it: [table, column pointing at the record].
const CHILDREN = {
  competencies: [["competency_indicators", "competencyId"]],
  assessments: [
    ["assessment_competency_links", "assessmentId"],
    ["assessment_pathway_links", "assessmentId"],
    ["assessment_inventory_links", "assessmentId"],
  ],
  courses: [
    ["course_modules", "courseId"],
    ["course_sessions", "courseId"],
    ["course_competency_links", "courseId"],
    ["course_pathway_links", "courseId"],
    ["course_inventory_links", "courseId"],
  ],
  curricula: [
    "academic_year_groups", "academic_year_versions", "curriculum_versions", "age_categories",
    "assessment_types", "evidence_types", "pathways", "performance_bands", "progress_levels",
    "progression_ladder_rungs", "curriculum_competency_links", "curriculum_competency_indicators",
    "indicator_achievements", "course_curriculum_links",
  ].map((table) => [table, "curriculumId"]),
};

// Rows that only join two records: dropped when either side wasn't copied, and never doubled up.
const LINK_KEYS = {
  assessment_competency_links: ["assessmentId", "competencyId"],
  assessment_pathway_links: ["assessmentId", "pathwayId"],
  assessment_inventory_links: ["assessmentId", "inventoryItemId"],
  course_competency_links: ["courseId", "competencyId"],
  course_pathway_links: ["courseId", "pathwayId"],
  course_inventory_links: ["courseId", "inventoryItemId"],
  course_curriculum_links: ["courseId", "curriculumId"],
  curriculum_competency_links: ["curriculumId", "competencyId"],
  indicator_achievements: ["curriculumId", "indicatorId"],
};

// A pathway (Settings) lists the courses in it. Copying a pathway doesn't drag those courses
// along — it keeps only the ones that are being copied anyway.
const NOT_FOLLOWED = { pathway_templates: new Set(["courses"]) };

const nameKey = (table, row) => `${table === "items" ? `${row.kind || ""}|` : ""}${String(row.name || "").trim().toLowerCase()}`;

function eachString(value, visit) {
  if (typeof value === "string") visit(value);
  else if (Array.isArray(value)) for (const entry of value) eachString(entry, visit);
  else if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    for (const [key, entry] of Object.entries(value)) { visit(key); eachString(entry, visit); }
  }
}

class CopyRun {
  constructor({ trx, sourceAdminId, targetAdminId }) {
    this.trx = trx;
    this.sourceAdminId = sourceAdminId;
    this.targetAdminId = targetAdminId;
    this.idMap = new Map(); // source id → the id it has in the receiving workspace
    this.rows = []; // { table, row } still carrying source ids
    this.seen = new Set();
    this.queue = [];
    this.created = {}; // table → count, for the summary
    this.reused = {};
    this.provenance = []; // { entityTable, sourceId, targetId } to remember after this run
    this.rootOutcome = new Map(); // `${table}:${id}` → "created" | "existing"
  }

  // The source admin's own content (id → table) and, for each indicator, its competency — what a
  // reference found while scanning may be followed to. Plus what the receiving admin already has.
  async prepare() {
    this.sourceIndex = new Map();
    for (const table of ROOT_TABLES) {
      const ids = await this.trx(table).where({ ownerAdminId: this.sourceAdminId }).pluck("id");
      for (const id of ids) this.sourceIndex.set(id, table);
    }
    this.indicatorCompetency = new Map();
    const competencyIds = [...this.sourceIndex].filter(([, table]) => table === "competencies").map(([id]) => id);
    if (competencyIds.length) {
      const indicators = await this.trx("competency_indicators").whereIn("competencyId", competencyIds).select("id", "competencyId");
      for (const indicator of indicators) this.indicatorCompetency.set(indicator.id, indicator.competencyId);
    }

    const imports = await this.trx("shared_imports").where({ ownerAdminId: this.targetAdminId, sourceAdminId: this.sourceAdminId });
    this.imported = new Map(imports.map((row) => [`${row.entityTable}:${row.sourceId}`, row.targetId]));

    this.targetNames = {};
    for (const table of CATALOG_TABLES) {
      const rows = await this.trx(table).where({ ownerAdminId: this.targetAdminId });
      this.targetNames[table] = new Map(rows.map((row) => [nameKey(table, row), row.id]));
    }
    const lastLevel = await this.trx("system_levels").where({ ownerAdminId: this.targetAdminId }).max({ max: "sequence" }).first();
    this.nextLevelSequence = Number(lastLevel?.max || 0) + 1;
  }

  count(bucket, table) {
    bucket[table] = (bucket[table] || 0) + 1;
  }

  // The receiving admin's own copy of something copied earlier, if they still have it.
  async previouslyImported(table, sourceId) {
    const targetId = this.imported.get(`${table}:${sourceId}`);
    if (!targetId) return null;
    const query = this.trx(table).where({ id: targetId });
    if (ROOT_TABLES.includes(table)) query.where({ ownerAdminId: this.targetAdminId });
    return (await query.first()) ? targetId : null;
  }

  remember(table, sourceId, targetId) {
    if (this.imported.get(`${table}:${sourceId}`) === targetId) return;
    this.provenance.push({ entityTable: table, sourceId, targetId });
  }

  collect(table, row) {
    this.idMap.set(row.id, generateId());
    this.rows.push({ table, row });
    const skip = NOT_FOLLOWED[table];
    for (const [column, value] of Object.entries(row)) {
      if (skip?.has(column)) continue;
      eachString(value, (text) => {
        for (const match of text.match(UUID_ANYWHERE) || []) this.follow(match.toLowerCase());
      });
    }
  }

  // A curriculum is only ever copied when it is the thing that was asked for: an assessment or
  // course that merely sits in one doesn't bring the whole curriculum with it.
  follow(id) {
    const table = this.sourceIndex.get(id);
    if (table && table !== "curricula") this.queue.push([table, id]);
    else if (this.indicatorCompetency.has(id)) this.queue.push(["competencies", this.indicatorCompetency.get(id)]);
  }

  async add(table, sourceId, { root = false } = {}) {
    const key = `${table}:${sourceId}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    // Only ever the source admin's own content, whatever id was asked for.
    const row = await this.trx(table).where({ id: sourceId, ownerAdminId: this.sourceAdminId }).first();
    if (!row) return;

    let existingId = await this.previouslyImported(table, sourceId);
    if (!existingId && CATALOG_TABLES.has(table)) existingId = this.targetNames[table].get(nameKey(table, row)) || null;
    if (existingId) {
      this.idMap.set(sourceId, existingId);
      this.remember(table, sourceId, existingId);
      this.count(this.reused, table);
      if (root) this.rootOutcome.set(key, "existing");
      if (table === "competencies") await this.mergeIndicators(sourceId, existingId);
      return;
    }

    this.collect(table, row);
    this.count(this.created, table);
    this.remember(table, sourceId, this.idMap.get(sourceId));
    if (root) this.rootOutcome.set(key, "created");

    if (table === "curricula") {
      // The year levels live inside the curriculum record with ids of their own, which the
      // curriculum's versions refer to — give the copy its own.
      for (const level of Array.isArray(row.classes) ? row.classes : []) {
        if (isUuid(level?.id) && !this.idMap.has(level.id)) this.idMap.set(level.id, generateId());
      }
      const assessments = await this.trx("assessments").where({ curriculumId: sourceId, ownerAdminId: this.sourceAdminId }).pluck("id");
      for (const id of assessments) this.queue.push(["assessments", id]);
    }

    for (const [childTable, column] of CHILDREN[table] || []) {
      const children = await this.trx(childTable).where({ [column]: sourceId });
      for (const child of children) {
        this.collect(childTable, child);
        if (childTable === "competency_indicators") this.remember(childTable, child.id, this.idMap.get(child.id));
      }
    }
  }

  // A competency the receiving admin already has: its indicators are matched by name, and any
  // the incoming one has that theirs lacks are added to it (nothing of theirs is changed).
  async mergeIndicators(sourceCompetencyId, targetCompetencyId) {
    const incoming = await this.trx("competency_indicators").where({ competencyId: sourceCompetencyId });
    const existing = await this.trx("competency_indicators").where({ competencyId: targetCompetencyId });
    const byName = new Map(existing.map((row) => [String(row.name || "").trim().toLowerCase(), row.id]));
    for (const indicator of incoming) {
      const targetId = (await this.previouslyImported("competency_indicators", indicator.id)) || byName.get(String(indicator.name || "").trim().toLowerCase());
      if (targetId) {
        this.idMap.set(indicator.id, targetId);
        this.remember("competency_indicators", indicator.id, targetId);
      } else {
        this.collect("competency_indicators", indicator);
        this.remember("competency_indicators", indicator.id, this.idMap.get(indicator.id));
      }
    }
  }

  async drain() {
    while (this.queue.length) {
      const [table, id] = this.queue.shift();
      await this.add(table, id);
    }
  }

  mapId(id) {
    return this.idMap.get(id) || this.idMap.get(String(id).toLowerCase());
  }

  // Swaps every id this run knows about, wherever it appears — values, object keys, inside text.
  rewrite(value) {
    if (typeof value === "string") return value.replace(UUID_ANYWHERE, (match) => this.mapId(match) || match);
    if (Array.isArray(value)) return value.map((entry) => this.rewrite(entry));
    if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [this.rewrite(key), this.rewrite(entry)]));
    }
    return value;
  }

  // The row as it is written into the receiving workspace, or null when it shouldn't be.
  transform(table, row, now) {
    const out = {};
    for (const [column, value] of Object.entries(row)) {
      if (column === "id") out.id = this.mapId(value);
      else if (column === "ownerAdminId") out.ownerAdminId = this.targetAdminId;
      else if (column === "createdAt" || column === "updatedAt") out[column] = now;
      else if (column.endsWith("Id") && isUuid(value)) {
        // A pointer at another record. One that wasn't copied (the curriculum a lone assessment
        // sat in, the person who administers a curriculum) must not carry over.
        out[column] = this.mapId(value) || null;
        if (!out[column] && LINK_KEYS[table]) return null;
      } else out[column] = this.rewrite(value);
    }

    // Nothing arrives already on sale or already public: that is the receiving admin's call.
    if (table === "items" || table === "assessments") out.saleStatus = "internal";
    if (table === "pathways") out.publicDiagnosticEnabled = false;
    if (table === "pathway_templates") {
      out.courses = (Array.isArray(row.courses) ? row.courses : []).map((id) => this.mapId(id)).filter(Boolean);
    }
    if (table === "system_levels") out.sequence = this.nextLevelSequence++;

    for (const [column, value] of Object.entries(out)) {
      if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) out[column] = JSON.stringify(value);
    }
    return out;
  }

  async write() {
    const now = new Date();
    const byTable = new Map();
    const linkSeen = new Set();
    for (const { table, row } of this.rows) {
      const out = this.transform(table, row, now);
      if (!out) continue;
      if (LINK_KEYS[table]) {
        const key = `${table}|${LINK_KEYS[table].map((column) => out[column]).join("|")}`;
        if (linkSeen.has(key)) continue;
        linkSeen.add(key);
      }
      if (!byTable.has(table)) byTable.set(table, []);
      byTable.get(table).push(out);
    }
    for (const [table, rows] of byTable) {
      // Small batches: a session or a curriculum version can be a very large row.
      for (let i = 0; i < rows.length; i += 20) await this.trx(table).insert(rows.slice(i, i + 20));
    }
    for (const entry of this.provenance) {
      await this.trx("shared_imports").insert({ id: generateId(), ownerAdminId: this.targetAdminId, sourceAdminId: this.sourceAdminId, createdAt: now, ...entry });
    }
  }
}

/**
 * Copies `ids` of one kind (`table`, a ROOT_TABLES entry) from sourceAdminId's workspace into
 * targetAdminId's, with everything they depend on.
 * Returns { added, alreadyHad, created: { table: n }, reused: { table: n } } — `added` /
 * `alreadyHad` count the records that were asked for; the other two cover everything that came
 * along with them.
 * `transaction` is for tests that want to look and then roll back.
 */
async function copyBetweenAdmins({ sourceAdminId, targetAdminId, table, ids, transaction }) {
  if (!ROOT_TABLES.includes(table)) throw Object.assign(new Error("That can't be shared"), { statusCode: 400 });
  const work = async (trx) => {
    const run = new CopyRun({ trx, sourceAdminId, targetAdminId });
    await run.prepare();
    for (const id of ids) {
      await run.add(table, id, { root: true });
      await run.drain();
    }
    await run.write();
    const outcomes = [...run.rootOutcome.values()];
    return {
      added: outcomes.filter((o) => o === "created").length,
      alreadyHad: outcomes.filter((o) => o === "existing").length,
      created: run.created,
      reused: run.reused,
    };
  };
  return transaction ? work(transaction) : db.transaction(work);
}

module.exports = { copyBetweenAdmins, ROOT_TABLES };
