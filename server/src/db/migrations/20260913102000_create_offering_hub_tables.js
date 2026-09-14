const { id, fk, timestamps } = require("../helpers");

// Replaces the `events` table as the record of "which hubs run this, and which classes did
// that create" — one join table per sellable entity (bootcamp_hubs, competition_hubs) instead
// of one shared table keyed by curriculum, since a bootcamp/competition's dates now live once
// on the PARENT row (uniform across every hub it runs at, per the new requirement that a single
// bootcamp's dates can't vary by hub) rather than per deployment the way `events.startDate`/
// `endDate` did. These tables carry no dates of their own for exactly that reason.
//
// `classIds` is a JSON array of the Class rows this offering auto-created (one per curriculum
// cohort) — same shape and purpose as the old `events.classIds`, including the same "a Class has
// no back-reference of its own" tradeoff: finding the offering a given classId belongs to means
// scanning these rows (see bootcamp-hub.model.js's findByClassId), exactly as
// EventModel.findByClassId did.
//
// No `unique(bootcampId, hubId)` / `unique(competitionId, hubId)` constraint — this schema
// enforces referential/uniqueness integrity at the application layer throughout (see helpers.js),
// not in the DB; the one-offering-per-hub rule is enforced in bootcamp-hub.service.js /
// competition-hub.service.js instead.
//
// Guarded by hasTable so a retry after a partial failure elsewhere in this migration chain is a
// harmless no-op (MySQL commits CREATE TABLE immediately and doesn't roll it back if a later
// statement in the same deploy fails).

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("bootcamp_hubs"))) {
    await knex.schema.createTable("bootcamp_hubs", (t) => {
      id(t);
      // Multi-tenant scope — same posture as every other root-ish table (see the
      // owner-admin-id migrations). Lets the timetable's classId -> date-window lookup scope
      // to one tenant instead of scanning every admin's offerings.
      fk(t, "ownerAdminId").notNullable();
      t.index("ownerAdminId");
      fk(t, "bootcampId").notNullable();
      t.index("bootcampId");
      fk(t, "hubId").notNullable();
      t.index("hubId");
      t.json("classIds").nullable();
      timestamps(t);
      t.index("createdAt");
    });
  }

  if (!(await knex.schema.hasTable("competition_hubs"))) {
    await knex.schema.createTable("competition_hubs", (t) => {
      id(t);
      fk(t, "ownerAdminId").notNullable();
      t.index("ownerAdminId");
      fk(t, "competitionId").notNullable();
      t.index("competitionId");
      fk(t, "hubId").notNullable();
      t.index("hubId");
      t.json("classIds").nullable();
      timestamps(t);
      t.index("createdAt");
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("competition_hubs");
  await knex.schema.dropTableIfExists("bootcamp_hubs");
};
