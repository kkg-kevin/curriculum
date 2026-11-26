// Bootcamp runs already scheduled (27 Nov 2026): a run's cohort classes are named "<cohort> ·
// <bootcamp name>" when it's the only run, and "<cohort> · <bootcamp name> · 7 Dec 2026" for a run
// made with "Schedule another run". So the FIRST run's classes read like the bare bootcamp name and
// can't be told apart from the next run's at a glance. Every class of a bootcamp that is part of a
// series whose stream is still exactly the bootcamp's name takes its run's start date — as
// bootcamp-hub.service.js's streamLabelFor names them (and dateRunClasses does from now on).
// Nothing else changes; a class staff renamed is left alone. No down: the names stay.

const list = (v) => {
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v || "[]"); } catch { return []; }
};

function labelFor(bootcamp) {
  const start = bootcamp.startDate instanceof Date ? bootcamp.startDate.toISOString().slice(0, 10) : String(bootcamp.startDate).slice(0, 10);
  const day = new Date(`${start}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const suffix = ` · ${day}`;
  return `${bootcamp.name.slice(0, 100 - suffix.length)}${suffix}`;
}

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("bootcamp_hubs"))) return;
  const bootcamps = await knex("bootcamps").whereNotNull("seriesId").whereNotNull("startDate").select("id", "name", "startDate");
  for (const b of bootcamps) {
    const label = labelFor(b);
    const offerings = await knex("bootcamp_hubs").where({ bootcampId: b.id }).select("classIds");
    const classIds = offerings.flatMap((o) => list(o.classIds));
    if (!classIds.length) continue;
    try {
      await knex("classes").whereIn("id", classIds).where({ streamName: b.name }).update({ streamName: label });
    } catch (err) {
      // A clash with a class already carrying that name: leave this run's names as they were.
      console.warn(`[migration] could not date the classes of bootcamp ${b.id}: ${err.message}`);
    }
  }
};

exports.down = async function down() {};
