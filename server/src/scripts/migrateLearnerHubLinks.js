// One-off structural migration: Learner used to carry singular `schoolId`, `classId`,
// `admissionNumber`, and `status` fields. They're being replaced by a many-to-many
// learner-hub-links table so a learner can be enrolled at more than one learning hub, same
// shape as migrateTeacherHubLinks.js did for Teacher. This preserves every existing learner's
// current enrollment as a link-table row, then strips those four fields off the learner
// record. Safe to re-run — LearnerHubLinkModel.create is idempotent per (learnerId, hubId),
// and once the fields are stripped a second pass finds nothing left to migrate.
const fs = require("fs");
const path = require("path");

const LearnerHubLinkModel = require("../modules/learners/learner-hub-link.model");

const LEARNERS_FILE = path.join(__dirname, "../../data/learners.json");
const BACKUP_FILE = path.join(__dirname, "../../data/learners.pre-hub-migration.backup.json");

function migrate() {
  if (!fs.existsSync(LEARNERS_FILE)) {
    console.log("No learners.json found — nothing to migrate.");
    return;
  }

  const raw = fs.readFileSync(LEARNERS_FILE, "utf-8").trim();
  const learners = raw ? JSON.parse(raw) : [];

  fs.writeFileSync(BACKUP_FILE, JSON.stringify(learners, null, 2), "utf-8");

  let linked = 0;
  let skipped = 0;

  const migrated = learners.map((l) => {
    const { schoolId, classId, admissionNumber, status, ...rest } = l;
    if (schoolId) {
      LearnerHubLinkModel.create({ learnerId: l.id, hubId: schoolId, classId, admissionNumber, status });
      linked += 1;
    } else {
      skipped += 1;
    }
    return rest;
  });

  fs.writeFileSync(LEARNERS_FILE, JSON.stringify(migrated, null, 2), "utf-8");

  console.log(`Migrated ${learners.length} learner record(s): ${linked} linked to a hub, ${skipped} had no schoolId.`);
  console.log(`Backup written to ${BACKUP_FILE}`);
}

migrate();
