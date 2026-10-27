const { id, fk, timestamps } = require("../helpers");

// Tasks from a check-in's resolutions (27 Oct 2026): something to do, who does it — the check-in's
// Account Manager, its Training Lead, or an admin of the workspace — and by when. Kept light on
// purpose (the old actions tracker was dropped on 26 Oct): open or done, nothing else.
//
//   checkin_tasks   one per task; sessionId is the check-in it came from. dueDate is a Kenyan
//                   calendar date ("YYYY-MM-DD"), like the check-in dates.
//
// No DB-level foreign keys, as everywhere else in this schema (see helpers.js).
exports.up = async function up(knex) {
  if (await knex.schema.hasTable("checkin_tasks")) return;
  await knex.schema.createTable("checkin_tasks", (table) => {
    id(table);
    fk(table, "ownerAdminId").notNullable();
    fk(table, "sessionId").notNullable();
    fk(table, "hubId").notNullable();
    // The task itself — rich text (HTML from the editor), like the report.
    table.text("title").notNullable();
    fk(table, "assigneeId").notNullable();
    table.date("dueDate").notNullable();
    table.string("status", 10).notNullable().defaultTo("open");
    // The deadline the "task due" reminder was last sent for — one reminder per deadline.
    table.date("remindedFor").nullable();
    table.datetime("doneAt").nullable();
    fk(table, "doneBy").nullable();
    fk(table, "createdBy").nullable();
    fk(table, "updatedBy").nullable();
    timestamps(table);
    table.index("sessionId");
    table.index(["ownerAdminId", "status", "dueDate"]);
    table.index(["assigneeId", "status"]);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("checkin_tasks");
};
