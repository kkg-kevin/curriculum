// One-off backfill: assigns a registrationNumber (REG-000001, REG-000002, ...) to every existing
// learner that doesn't have one yet, in createdAt order — so the earliest-registered learner
// gets the lowest number. New learners get theirs automatically at creation time (see
// learner.service.js's nextRegistrationNumber); this script only covers records that predate
// that field. Safe to re-run — only fills in learners still missing the field.
const fs = require("fs");
const path = require("path");

const LEARNERS_FILE = path.join(__dirname, "../../data/learners.json");
const BACKUP_FILE = path.join(__dirname, "../../data/learners.pre-registration-number-backfill.backup.json");
const REGISTRATION_PREFIX = "REG-";

function backfill() {
  if (!fs.existsSync(LEARNERS_FILE)) {
    console.log("No learners.json found — nothing to backfill.");
    return;
  }

  const raw = fs.readFileSync(LEARNERS_FILE, "utf-8").trim();
  const learners = raw ? JSON.parse(raw) : [];

  const missing = learners.filter((l) => !l.registrationNumber);
  if (missing.length === 0) {
    console.log("Every learner already has a registrationNumber — nothing to do.");
    return;
  }

  fs.writeFileSync(BACKUP_FILE, JSON.stringify(learners, null, 2), "utf-8");

  let maxSeq = learners.reduce((max, l) => {
    const seq = typeof l.registrationNumber === "string" && l.registrationNumber.startsWith(REGISTRATION_PREFIX)
      ? parseInt(l.registrationNumber.slice(REGISTRATION_PREFIX.length), 10)
      : NaN;
    return Number.isFinite(seq) ? Math.max(max, seq) : max;
  }, 0);

  const missingSortedByCreatedAt = [...missing].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const numberByLearnerId = new Map();
  for (const l of missingSortedByCreatedAt) {
    maxSeq += 1;
    numberByLearnerId.set(l.id, `${REGISTRATION_PREFIX}${String(maxSeq).padStart(6, "0")}`);
  }

  const updated = learners.map((l) => (numberByLearnerId.has(l.id) ? { ...l, registrationNumber: numberByLearnerId.get(l.id) } : l));

  fs.writeFileSync(LEARNERS_FILE, JSON.stringify(updated, null, 2), "utf-8");

  console.log(`Backfilled ${missing.length} of ${learners.length} learner(s) with a registrationNumber.`);
  console.log(`Backup written to ${BACKUP_FILE}`);
}

backfill();
