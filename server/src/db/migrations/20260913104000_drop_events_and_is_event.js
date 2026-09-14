// Final step of the Event-entity removal: drops `curricula.isEvent` and the `events` table
// itself. DESTRUCTIVE — do not run this against a real environment until:
//   1. 20260913100000 / ...101000 / ...102000 / ...103000 have all run and been verified there
//      (bootcamp_hubs/competition_hubs are populated, bootcamp/competition dates look right).
//   2. Every server-side EventModel require has been removed (timetable.service.js,
//      curriculum.service.js, curriculum.controller.js, curriculum-versions.controller.js,
//      public-bootcamp.service.js) and server/src/modules/events/ deleted + unmounted from
//      app.js.
//   3. Every `isEvent` reference is gone from server/src and client/src (outside migration
//      files) — grep both before shipping this.
//
// What is permanently lost, with no `down` able to restore the data (only the shape):
//   - curricula.isEvent — recoverable only by manually re-flagging a curriculum, if anyone still
//     remembers which ones were Events.
//   - The entire `events` table. Every hub-deployment record referenced by a bootcamp/
//     competition was already copied into bootcamp_hubs/competition_hubs by 20260913103000.
//     Deployments with no linked bootcamp/competition (logged as "orphans" by that migration)
//     are lost here for good — their Classes are NOT touched by this migration and remain
//     exactly as they are.
//
// Guarded the same way as every migration in this chain: MySQL commits DDL immediately, so a
// retry after a partial failure must skip whatever already dropped rather than error on it.

exports.up = async function up(knex) {
  if (await knex.schema.hasColumn("curricula", "isEvent")) {
    await knex.schema.alterTable("curricula", (t) => {
      t.dropColumn("isEvent");
    });
  }
  await knex.schema.dropTableIfExists("events");
};

exports.down = async function down(knex) {
  // Shape-only restoration — no data. A dropped `events` table and a dropped `isEvent` column
  // are gone for good the moment `up` runs; recovering the actual rows means restoring a DB
  // backup taken before this migration, not running this `down`.
  if (!(await knex.schema.hasColumn("curricula", "isEvent"))) {
    await knex.schema.alterTable("curricula", (t) => {
      t.boolean("isEvent").notNullable().defaultTo(false);
    });
  }
  if (!(await knex.schema.hasTable("events"))) {
    const { id, fk, timestamps } = require("../helpers");
    await knex.schema.createTable("events", (t) => {
      id(t);
      fk(t, "curriculumId").notNullable();
      fk(t, "hubId").notNullable();
      t.date("startDate").notNullable();
      t.date("endDate").notNullable();
      t.json("classIds").nullable();
      timestamps(t);
      t.index("curriculumId");
      t.index("hubId");
    });
  }
};
