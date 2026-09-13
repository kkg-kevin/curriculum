// Bootcamps/Competitions no longer link to an "Event" — that entity is going away entirely
// (see the migrations that follow this one). Both tables' `eventId` column already stored a
// plain `curricula.id` (an Event WAS a `curricula` row with isEvent: true — see
// bootcamp.service.js's old assertEventOwnedBy), so this is a pure rename with no data
// transform: every existing value already points at the right kind of row, it's only the
// column name and the meaning attached to it that changes (no more isEvent gate on what it can
// point to — any curriculum qualifies now).
//
// competitions.programId is also handled as a fallback name for `eventId`, in case this runs
// against a database that got stuck mid-migration between 20260911100000 (programId -> eventId)
// and now — without this fallback, a DB in that exact stuck state would have neither `eventId`
// nor a way for this migration to find its data.
//
// No DB FK is added on the new column — no table in this schema uses real FOREIGN KEY
// constraints (see server/src/db/helpers.js) — and no data changes, only column identity.
//
// Guarded per-column so a mid-migration crash (MySQL commits each ALTER immediately, unlike
// Postgres) leaves a bare retry as a harmless no-op for whatever already renamed.

exports.up = async function up(knex) {
  if (await knex.schema.hasColumn("bootcamps", "eventId")) {
    await knex.schema.alterTable("bootcamps", (t) => {
      t.renameColumn("eventId", "curriculumId");
    });
  }

  if (await knex.schema.hasColumn("competitions", "eventId")) {
    await knex.schema.alterTable("competitions", (t) => {
      t.renameColumn("eventId", "curriculumId");
    });
  } else if (await knex.schema.hasColumn("competitions", "programId")) {
    // A DB stuck between the Program->Event rename and this migration never got as far as
    // having `eventId` at all — rename straight from the pre-rename name instead.
    await knex.schema.alterTable("competitions", (t) => {
      t.renameColumn("programId", "curriculumId");
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("competitions", "curriculumId")) {
    await knex.schema.alterTable("competitions", (t) => {
      t.renameColumn("curriculumId", "eventId");
    });
  }

  if (await knex.schema.hasColumn("bootcamps", "curriculumId")) {
    await knex.schema.alterTable("bootcamps", (t) => {
      t.renameColumn("curriculumId", "eventId");
    });
  }
};
