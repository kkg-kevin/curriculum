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
//
// Each step below checks the current schema before acting: MySQL commits every DDL statement
// immediately (renameTable/alterTable are not rolled back by a later failure in the same
// migration, unlike Postgres), so if this migration crashes partway through, a bare retry would
// otherwise error on the step that already succeeded (e.g. "table 'events' already exists" /
// unknown column 'isProgram'). Guarding each step makes a retry after a partial failure a
// harmless no-op for whatever already ran, instead of requiring manual DB surgery.

exports.up = async function up(knex) {
  if (await knex.schema.hasTable("programs")) {
    await knex.schema.renameTable("programs", "events");
  }

  if (await knex.schema.hasColumn("curricula", "isProgram")) {
    await knex.schema.alterTable("curricula", (t) => {
      t.renameColumn("isProgram", "isEvent");
    });
  }

  if (await knex.schema.hasColumn("competitions", "programId")) {
    await knex.schema.alterTable("competitions", (t) => {
      t.renameColumn("programId", "eventId");
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("competitions", "eventId")) {
    await knex.schema.alterTable("competitions", (t) => {
      t.renameColumn("eventId", "programId");
    });
  }

  if (await knex.schema.hasColumn("curricula", "isEvent")) {
    await knex.schema.alterTable("curricula", (t) => {
      t.renameColumn("isEvent", "isProgram");
    });
  }

  if (await knex.schema.hasTable("events")) {
    await knex.schema.renameTable("events", "programs");
  }
};
