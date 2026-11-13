// Removing a person (13 Nov 2026 — modules/removals/): an educator, learning hub, supervisor or
// affiliate is deactivated, their ongoing work handed to someone of the same role, then removed. One
// with history (claims, QA reports, invoices…) isn't deleted: the row stays as a tombstone — status
// "removed" — so that history keeps their name. Its email moves to `removedEmail` and is cleared, so
// nothing matching by email (sign-in, suspension, re-using the address for someone new) finds it.
// A login with no role left is kept the same way (`users.removedAt`) instead of being deleted.

const addRemovalColumns = (withEmail) => (t) => {
  t.timestamp("removedAt").nullable();
  t.string("removedBy", 36).nullable();
  if (withEmail) t.string("removedEmail", 255).nullable();
};

exports.up = async function up(knex) {
  await knex.raw("ALTER TABLE teachers MODIFY status ENUM('active','inactive','on_leave','in_training','removed') NOT NULL DEFAULT 'active'");
  await knex.raw("ALTER TABLE learning_hubs MODIFY status ENUM('draft','active','inactive','removed') NOT NULL DEFAULT 'draft'");
  if (!(await knex.schema.hasColumn("teachers", "removedAt"))) await knex.schema.alterTable("teachers", addRemovalColumns(true));
  if (!(await knex.schema.hasColumn("learning_hubs", "removedAt"))) await knex.schema.alterTable("learning_hubs", addRemovalColumns(true));
  if (!(await knex.schema.hasColumn("affiliates", "removedAt"))) await knex.schema.alterTable("affiliates", addRemovalColumns(false));
  if (!(await knex.schema.hasColumn("users", "removedAt"))) {
    await knex.schema.alterTable("users", (t) => { t.timestamp("removedAt").nullable(); });
  }
};

exports.down = async function down(knex) {
  await knex("teachers").where({ status: "removed" }).update({ status: "inactive" });
  await knex("learning_hubs").where({ status: "removed" }).update({ status: "inactive" });
  await knex.raw("ALTER TABLE teachers MODIFY status ENUM('active','inactive','on_leave','in_training') NOT NULL DEFAULT 'active'");
  await knex.raw("ALTER TABLE learning_hubs MODIFY status ENUM('draft','active','inactive') NOT NULL DEFAULT 'draft'");
  for (const table of ["teachers", "learning_hubs", "affiliates"]) {
    if (await knex.schema.hasColumn(table, "removedAt")) {
      await knex.schema.alterTable(table, (t) => {
        t.dropColumn("removedAt");
        t.dropColumn("removedBy");
        if (table !== "affiliates") t.dropColumn("removedEmail");
      });
    }
  }
  if (await knex.schema.hasColumn("users", "removedAt")) {
    await knex.schema.alterTable("users", (t) => { t.dropColumn("removedAt"); });
  }
};
