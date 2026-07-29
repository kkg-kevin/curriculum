// One-off bootstrap: creates the 14 default System Levels (Level 1..14) so there's a real
// spine for curricula to map their grades onto from day one. Safe to re-run — only fills in
// whatever sequence numbers 1..14 are still missing, never touches existing/renamed levels.
const SystemLevelModel = require("../modules/settings/system-levels/system-level.model");

function seed() {
  const existing = SystemLevelModel.findAll();
  const existingSequences = new Set(existing.map((l) => l.sequence));
  let created = 0;

  for (let seq = 1; seq <= 14; seq++) {
    if (existingSequences.has(seq)) continue;
    SystemLevelModel.create({ name: `Level ${seq}`, sequence: seq });
    created++;
  }

  console.log(`Seeded ${created} of 14 default system levels (${existing.length} already existed).`);
}

seed();
