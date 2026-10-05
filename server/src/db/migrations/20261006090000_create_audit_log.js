const { id, fk } = require("../helpers");

// The activity log (src/modules/audit/): who did what, to which record, when, and whether it
// went through. One row per change-making request and per sign-in event, written automatically
// (shared/middleware/audit.middleware.js) and never edited afterwards — there is no update or
// delete path in the app; rows only leave when they pass the retention period.
//
// Who and what are stored as they were at the time (actorName, entityLabel), so the record still
// reads correctly after the person is removed or the record renamed or deleted.
exports.up = async function up(knex) {
  await knex.schema.createTable("audit_log", (table) => {
    id(table);
    // The workspace it happened in — the admin whose data was touched. NULL when it can't be
    // tied to one (e.g. a failed sign-in for an unknown email).
    fk(table, "ownerAdminId").nullable();
    fk(table, "actorUserId").nullable();
    table.string("actorName", 150).nullable();
    table.string("actorEmail", 190).nullable();
    // The person's real kind of account (admin, collaborator, teacher, school, learner,
    // visitor) — never the "admin" a staff member is treated as while working.
    table.string("actorRole", 30).nullable();
    table.string("actorAccessRole", 100).nullable(); // a staff member's role name, at the time
    table.string("action", 40).notNullable(); // create | update | delete | link | unlink | login | … | a named action
    table.string("module", 40).nullable(); // area of the app, e.g. "bootcamps"
    table.string("entityType", 64).nullable(); // the table the record lives in
    fk(table, "entityId").nullable();
    table.string("entityLabel", 255).nullable();
    table.string("summary", 500).notNullable();
    table.json("changes").nullable(); // [{ field, from, to }]
    table.string("outcome", 12).notNullable().defaultTo("success"); // success | refused | failed
    table.integer("statusCode").nullable();
    table.string("reason", 300).nullable();
    table.string("method", 8).nullable();
    table.string("path", 255).nullable();
    table.string("ip", 64).nullable();
    table.string("userAgent", 255).nullable();
    table.datetime("createdAt", { precision: 3 }).notNullable();
    table.index(["ownerAdminId", "createdAt"]);
    table.index(["ownerAdminId", "actorUserId", "createdAt"]);
    table.index(["entityType", "entityId"]);
    table.index("createdAt");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("audit_log");
};
