const { id, fk, timestamps } = require("../helpers");

// Unsaved work in the portal's long forms — the assessment builder, Add/Edit Course and the
// course session editor (see modules/drafts/). Each form writes here as it is typed, so nothing is
// lost if the page closes before Save; and because it's in the workspace rather than one browser,
// several people sharing one account each keep their own draft, and any of them can carry one on.
// Replaces assessment_drafts (20261016090000), which only the assessment builder used: its rows
// are moved across and the table dropped.
//
// kind      — which form: "assessment", "course" or "course-session".
// recordId  — the record being edited; null for one not saved yet (a new assessment or course).
// parentId  — the course a session draft belongs to; null otherwise.
// type      — the assessment type, for an assessment draft.
// content   — the form as it is, unvalidated (it's checked when the record itself is saved).
//             name is copied out of it for the "Unsaved drafts" lists.
// revision  — goes up by one on every write; a write naming an older revision is refused, so two
//             people carrying on the same draft can't silently overwrite each other.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("drafts"))) {
    await knex.schema.createTable("drafts", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      table.string("kind", 30).notNullable();
      fk(table, "recordId").nullable();
      fk(table, "parentId").nullable();
      table.string("type", 20).nullable();
      table.string("name", 255).notNullable().defaultTo("");
      table.json("content").nullable();
      table.integer("revision").notNullable().defaultTo(1);
      fk(table, "lastEditedBy").nullable();
      timestamps(table);
      table.index(["ownerAdminId", "kind"]);
      table.index("recordId");
      table.index("parentId");
    });
  }

  if (await knex.schema.hasTable("assessment_drafts")) {
    const rows = await knex("assessment_drafts").select();
    for (const row of rows) {
      await knex("drafts").insert({
        id: row.id,
        ownerAdminId: row.ownerAdminId,
        kind: "assessment",
        recordId: row.assessmentId,
        parentId: null,
        type: row.type,
        name: row.name,
        content: typeof row.content === "string" || row.content == null ? row.content : JSON.stringify(row.content),
        revision: row.revision,
        lastEditedBy: row.lastEditedBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    }
    await knex.schema.dropTable("assessment_drafts");
  }
};

// Puts back only what assessment_drafts can hold — course and session drafts are dropped.
exports.down = async function down(knex) {
  if (!(await knex.schema.hasTable("drafts"))) return;
  if (!(await knex.schema.hasTable("assessment_drafts"))) {
    await knex.schema.createTable("assessment_drafts", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "assessmentId").nullable();
      table.string("type", 20).notNullable();
      table.string("name", 150).notNullable().defaultTo("");
      table.json("content").nullable();
      table.integer("revision").notNullable().defaultTo(1);
      fk(table, "lastEditedBy").nullable();
      timestamps(table);
      table.index("ownerAdminId");
      table.index("assessmentId");
    });
  }
  const rows = await knex("drafts").where({ kind: "assessment" }).select();
  for (const row of rows) {
    await knex("assessment_drafts").insert({
      id: row.id,
      ownerAdminId: row.ownerAdminId,
      assessmentId: row.recordId,
      type: row.type || "quiz",
      name: String(row.name || "").slice(0, 150),
      content: typeof row.content === "string" || row.content == null ? row.content : JSON.stringify(row.content),
      revision: row.revision,
      lastEditedBy: row.lastEditedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
  await knex.schema.dropTable("drafts");
};
