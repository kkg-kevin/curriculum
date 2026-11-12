// General events' website page (13 Nov 2026 — modules/general-events/): what helps a family say yes.
//   ageMin / ageMax   who it's for ("For ages 6–14"); both empty = all ages
//   highlights        "What to expect" lines (JSON [string]); empty = sensible ones for the kind
//                     (general-event.rules.js's DEFAULT_HIGHLIGHTS)
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("general_events", "highlights"))) {
    await knex.schema.alterTable("general_events", (t) => {
      t.integer("ageMin").nullable();
      t.integer("ageMax").nullable();
      t.json("highlights").nullable();
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("general_events", "highlights")) {
    await knex.schema.alterTable("general_events", (t) => {
      t.dropColumn("ageMin");
      t.dropColumn("ageMax");
      t.dropColumn("highlights");
    });
  }
};
