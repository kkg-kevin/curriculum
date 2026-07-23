// One-off structural migration: Teacher used to carry a single required `schoolId` field.
// It's being replaced by a many-to-many teacher-hub-links table so a teacher can be assigned
// to more than one learning hub. This preserves every existing teacher's current hub
// assignment as a link-table row, then strips `schoolId` off the teacher record. Safe to
// re-run — `TeacherHubLinkModel.link` is idempotent, and once `schoolId` is stripped a second
// pass finds nothing left to migrate.
const fs = require("fs");
const path = require("path");

const TeacherHubLinkModel = require("../modules/teachers/teacher-hub-link.model");

const TEACHERS_FILE = path.join(__dirname, "../../data/teachers.json");
const BACKUP_FILE = path.join(__dirname, "../../data/teachers.pre-hub-migration.backup.json");

function migrate() {
  if (!fs.existsSync(TEACHERS_FILE)) {
    console.log("No teachers.json found — nothing to migrate.");
    return;
  }

  const raw = fs.readFileSync(TEACHERS_FILE, "utf-8").trim();
  const teachers = raw ? JSON.parse(raw) : [];

  fs.writeFileSync(BACKUP_FILE, JSON.stringify(teachers, null, 2), "utf-8");

  let linked = 0;
  let skipped = 0;

  const migrated = teachers.map((t) => {
    const { schoolId, ...rest } = t;
    if (schoolId) {
      TeacherHubLinkModel.link(t.id, schoolId);
      linked += 1;
    } else {
      skipped += 1;
    }
    return rest;
  });

  fs.writeFileSync(TEACHERS_FILE, JSON.stringify(migrated, null, 2), "utf-8");

  console.log(`Migrated ${teachers.length} teacher record(s): ${linked} linked to a hub, ${skipped} had no schoolId.`);
  console.log(`Backup written to ${BACKUP_FILE}`);
}

migrate();
