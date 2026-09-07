// One-off bootstrap: creates the 14 default System Levels (Level 1..14) for the platform's first
// admin (system_levels is tenant-owned — see 20260907105000_add_owner_admin_id_to_settings_tables
// — so there's no "the" spine anymore, only "this admin's own"; run it again per admin if a later
// admin wants the same starting spine). Safe to re-run — only fills in whatever sequence numbers
// 1..14 are still missing for that admin, never touches existing/renamed levels.
const db = require("../config/db");
const SystemLevelModel = require("../modules/settings/system-levels/system-level.model");

async function seed() {
  const admin = await db("users").where({ role: "admin" }).orderBy("createdAt", "asc").first();
  if (!admin) {
    console.error("No admin account exists yet — create one before seeding system levels.");
    process.exitCode = 1;
    return;
  }

  const existing = await SystemLevelModel.findAll({ ownerAdminId: admin.id });
  const existingSequences = new Set(existing.map((l) => l.sequence));
  let created = 0;

  for (let seq = 1; seq <= 14; seq++) {
    if (existingSequences.has(seq)) continue;
    await SystemLevelModel.create({ name: `Level ${seq}`, sequence: seq, ownerAdminId: admin.id });
    created++;
  }

  console.log(`Seeded ${created} of 14 default system levels for ${admin.email} (${existing.length} already existed).`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
