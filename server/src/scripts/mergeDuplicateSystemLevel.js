// One-off repair: merges a duplicate System Level into a surviving one, then deletes the
// duplicate. Needed because system_levels.name had no DB-level uniqueness before migration
// 20260827100000 — a raced double-create (e.g. a double-clicked "+ Add Level") could produce two
// rows with the same name (e.g. two "Level 1"s), and once any curriculum's classes[] references
// the duplicate's id, system-level.service.js's assertNotInUse blocks deleting it outright.
//
// This repoints every curriculum's classes[].systemLevelId from the duplicate's id to the
// surviving id, then deletes the now-unreferenced duplicate row. Safe to run more than once —
// re-running after the duplicate is already gone just reports 0 curricula touched and exits.
//
// Usage (run from server/):
//   node src/scripts/mergeDuplicateSystemLevel.js <keepId> <duplicateId>
//   node src/scripts/mergeDuplicateSystemLevel.js <keepId> <duplicateId> --dry-run
//
// --dry-run reports what WOULD change without writing anything — always run this first to
// confirm the two ids are what you expect before merging for real.
const db = require("../config/db");
const SystemLevelModel = require("../modules/settings/system-levels/system-level.model");
const CurriculumModel = require("../modules/curriculum/curriculum.model");

async function main() {
  const [keepId, duplicateId, flag] = process.argv.slice(2);
  const dryRun = flag === "--dry-run";

  if (!keepId || !duplicateId) {
    console.error("Usage: node src/scripts/mergeDuplicateSystemLevel.js <keepId> <duplicateId> [--dry-run]");
    process.exit(1);
  }
  if (keepId === duplicateId) {
    console.error("keepId and duplicateId must be different.");
    process.exit(1);
  }

  const [keep, duplicate] = await Promise.all([
    SystemLevelModel.findById(keepId),
    SystemLevelModel.findById(duplicateId),
  ]);
  if (!keep) { console.error(`No system level found with id ${keepId}`); process.exit(1); }
  if (!duplicate) { console.error(`No system level found with id ${duplicateId}`); process.exit(1); }

  console.log(`Keeping:    ${keep.name} (${keep.id}, sequence ${keep.sequence})`);
  console.log(`Merging in: ${duplicate.name} (${duplicate.id}, sequence ${duplicate.sequence})`);

  const curricula = await CurriculumModel.findAll();
  const affected = curricula.filter((c) => (c.classes || []).some((cls) => cls.systemLevelId === duplicateId));

  console.log(`\n${affected.length} curriculum(s) reference the duplicate:`);
  affected.forEach((c) => {
    const grades = (c.classes || []).filter((cls) => cls.systemLevelId === duplicateId).map((cls) => cls.name);
    console.log(`  - ${c.name || c.id}: grade(s) ${grades.join(", ")}`);
  });

  if (affected.length === 0) {
    console.log("\nNothing references the duplicate — safe to delete it directly via the System Levels UI.");
    process.exit(0);
  }

  if (dryRun) {
    console.log("\n--dry-run: no changes made. Re-run without --dry-run to apply.");
    process.exit(0);
  }

  for (const c of affected) {
    const nextClasses = (c.classes || []).map((cls) => (
      cls.systemLevelId === duplicateId ? { ...cls, systemLevelId: keepId } : cls
    ));
    await CurriculumModel.update(c.id, { classes: nextClasses });
    console.log(`Updated curriculum "${c.name || c.id}"`);
  }

  await SystemLevelModel.delete(duplicateId);
  console.log(`\nDeleted duplicate level "${duplicate.name}" (${duplicateId}).`);
  console.log("Merge complete — the unique-name migration can now be applied safely.");
}

main()
  .then(() => db.destroy())
  .catch((err) => { console.error(err); db.destroy().then(() => process.exit(1)); });
