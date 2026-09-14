const { randomUUID } = require("crypto");

// Carries every existing Event hub-deployment into the new bootcamp_hubs/competition_hubs join
// tables, and seeds the parent bootcamp's/competition's own startDate/endDate from it — the last
// data-preserving step before 20260913104000 drops the `events` table and `curricula.isEvent`
// for good. Runs only while `events` still exists; a clean no-op on any DB that never had it (a
// fresh install) or has already had it dropped (a re-run after 20260913104000 has shipped).
//
// What this does NOT preserve, and why:
//   - An Event whose curriculum is linked to NEITHER a bootcamp nor a competition has nowhere to
//     go — there's no longer a "just an Event, nothing else" concept for it to become. Its
//     classes and their learners/attendance history are left completely untouched (this
//     migration never touches `classes`); only the deployment's date-window/hub-run bookkeeping
//     is lost. Logged below so it's visible before the drop migration runs, not discovered after.
//   - registrationOpenDate/registrationCloseDate have no prior equivalent anywhere in this
//     schema and are deliberately left NULL rather than guessed at (see the migration plan) —
//     inventing a registration window would fabricate data a parent-facing page might render as
//     fact.
//   - A bootcamp/competition whose curriculum had MULTIPLE Event deployments with different
//     dates gets one collapsed window: earliest startDate, latest endDate across all of them.
//     This is an unavoidable consequence of dates now living once on the parent instead of per
//     deployment — earliest-start/latest-end is the only collapse that keeps every migrated
//     class's already-scheduled sessions inside the new single window, so nothing that already
//     had a valid date suddenly falls outside it. Logged below whenever it actually collapses
//     more than one distinct window, so an admin can see exactly what happened to their dates.
//
// Every step here is idempotent per-row (checked via existence, not run-once flags), and the
// parent-date seed only ever fills in a date that's still null — never overwrites a value an
// admin (or an earlier partial run of this very migration) already set. This is required by the
// same non-transactional-MySQL-DDL reasoning as every other migration in this chain: a crash
// partway through must leave a bare retry as a no-op for whatever already landed, not a
// duplicate-insert or a clobbered date.

function toYmd(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  // events.startDate/endDate are real DATE columns -> mysql2 hands back JS Date objects.
  // Built from local getters, NOT toISOString(), which can shift a day under a negative UTC
  // offset — these are calendar dates, not instants.
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function classIdsArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function backfillOne(knex, { parentTable, joinTable, parentIdColumn }) {
  const parents = await knex(parentTable).whereNotNull("curriculumId");
  const linkedCurriculumIds = new Set();

  for (const parent of parents) {
    linkedCurriculumIds.add(parent.curriculumId);
    // eslint-disable-next-line no-await-in-loop
    const events = await knex("events").where({ curriculumId: parent.curriculumId });
    if (!events.length) continue;

    const starts = events.map((e) => toYmd(e.startDate)).filter(Boolean).sort();
    const ends = events.map((e) => toYmd(e.endDate)).filter(Boolean).sort();
    const collapsedStart = starts[0] || null;
    const collapsedEnd = ends[ends.length - 1] || null;
    if (new Set(starts).size > 1 || new Set(ends).size > 1) {
      // eslint-disable-next-line no-console
      console.warn(
        `[backfill_offering_hubs] ${parentTable} "${parent.name}" (${parent.id}) had ${events.length} ` +
        `Event deployments with differing dates — collapsed to a single window ${collapsedStart} to ` +
        `${collapsedEnd} (earliest start, latest end) since dates now live once on the ${parentTable.slice(0, -1)} itself.`
      );
    }

    const parentPatch = {};
    if (!parent.startDate && collapsedStart) parentPatch.startDate = collapsedStart;
    if (!parent.endDate && collapsedEnd) parentPatch.endDate = collapsedEnd;
    if (Object.keys(parentPatch).length) {
      // eslint-disable-next-line no-await-in-loop
      await knex(parentTable).where({ id: parent.id }).update(parentPatch);
    }

    for (const event of events) {
      // eslint-disable-next-line no-await-in-loop
      const existing = await knex(joinTable).where({ [parentIdColumn]: parent.id, hubId: event.hubId }).first();
      if (existing) continue;
      // eslint-disable-next-line no-await-in-loop
      await knex(joinTable).insert({
        id: randomUUID(),
        ownerAdminId: parent.ownerAdminId,
        [parentIdColumn]: parent.id,
        hubId: event.hubId,
        // mysql2 auto-parses events.classIds on read but does not auto-serialize on write —
        // must re-stringify for this raw insert (see CLAUDE.md).
        classIds: JSON.stringify(classIdsArray(event.classIds)),
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      });
    }
  }

  return linkedCurriculumIds;
}

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("events"))) return;
  if (!(await knex.schema.hasTable("bootcamp_hubs")) || !(await knex.schema.hasTable("competition_hubs"))) return;

  const linkedToBootcamps = await backfillOne(knex, {
    parentTable: "bootcamps",
    joinTable: "bootcamp_hubs",
    parentIdColumn: "bootcampId",
  });
  const linkedToCompetitions = await backfillOne(knex, {
    parentTable: "competitions",
    joinTable: "competition_hubs",
    parentIdColumn: "competitionId",
  });
  const linkedToEither = new Set([...linkedToBootcamps, ...linkedToCompetitions]);

  const allEvents = await knex("events");
  const orphans = allEvents.filter((e) => !linkedToEither.has(e.curriculumId));
  if (orphans.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[backfill_offering_hubs] ${orphans.length} Event deployment(s) have no linked bootcamp or ` +
      "competition and will be dropped when 20260913104000 removes the `events` table. Their " +
      "classes and learner data are untouched by this migration — only the deployment's date-window " +
      "is lost. Orphans:",
      orphans.map((e) => ({ curriculumId: e.curriculumId, hubId: e.hubId, classIds: classIdsArray(e.classIds) }))
    );
  }
};

exports.down = async function down() {
  // Forward-only: the join-table rows this migration creates carry no marker distinguishing
  // them from ones created normally after this shipped, so there's nothing safe to reverse.
  // Matches 20260911150000_create_bootcamps.js's own "best-effort" honesty about irreversible
  // data migrations — restoring the pre-migration state means restoring a DB backup, not
  // running `down`.
};
