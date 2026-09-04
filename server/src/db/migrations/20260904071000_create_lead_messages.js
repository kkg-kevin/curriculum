const { id, fk, timestamps } = require("../helpers");

// The Enquiries page's "act on this lead from inside the system" layer — see
// Guide/LEADS_IMPLEMENTATION.md §3.3/§3.4. One table covers both an outbound reply (emailed to
// the lead, direction: "outbound") and a staff-only follow-up note (never emailed, direction:
// "note") — same shape, same timeline UI, distinguished only by direction, rather than two
// near-identical tables.
exports.up = async function up(knex) {
  await knex.schema.createTable("lead_messages", (table) => {
    id(table);
    table.string("leadId", 36).notNullable();
    table.enu("direction", ["outbound", "note"]).notNullable();
    // Only ever set for direction: "outbound" — a note has no subject.
    table.string("subject", 200).nullable();
    table.text("body").notNullable();
    fk(table, "sentByUserId").nullable();
    timestamps(table, { updatedAt: false });
    table.index("leadId");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("lead_messages");
};
