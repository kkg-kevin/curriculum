// Program → Event. A pure rename — no columns added or dropped, every existing row's values
// carried over by MySQL's in-place RENAME. An "Event" is the reframed Program: a curriculum
// flagged for short-run cohort deployment (e.g. a bootcamp), deployed to a hub with its own
// dates, which Bootcamps (sale fields on the same curriculum) and Competitions (soft-link) both
// attach to. "Bootcamp" and "Competition" naming is unchanged — only the thing they attach to
// is renamed.
//
// Renamed:
//   programs               -> events                    (hub-deployment record)
//   curricula.isProgram    -> isEvent
//   competitions.programId -> eventId                    (soft link, no DB FK)
//
// No index touches either renamed column today — no compound-index dance needed here, unlike
// the Learning Areas → Pathways rename this one otherwise mirrors.

exports.up = async function up(knex) {
  await knex.schema.renameTable("programs", "events");

  await knex.schema.alterTable("curricula", (t) => {
    t.renameColumn("isProgram", "isEvent");
  });

  await knex.schema.alterTable("competitions", (t) => {
    t.renameColumn("programId", "eventId");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("competitions", (t) => {
    t.renameColumn("eventId", "programId");
  });

  await knex.schema.alterTable("curricula", (t) => {
    t.renameColumn("isEvent", "isProgram");
  });

  await knex.schema.renameTable("events", "programs");
};
