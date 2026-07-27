// One-time migration: curriculum.classes goes from string[] to {id, name}[] so classes can be
// tracked (and renamed) by a stable id instead of joining on exact name text everywhere.
// Idempotent — safe to re-run; already-migrated curricula/entries are left untouched.
//
// Also backfills classId onto existing curriculum-version content (matched by name against the
// curriculum it belongs to) and gradeId onto existing physical Class records in classes.json
// (matched by name against the curriculum they were created under). Both backfills rely on
// name-matching exactly once, at migration time — the same matching this whole change exists to
// stop relying on going forward. Anything that doesn't find a match is left as-is, not deleted.
//
// Run with: node server/scripts/migrate-classes-to-ids.js

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CURRICULA_FILE = path.join(__dirname, "../data/curricula.json");
const VERSIONS_FILE  = path.join(__dirname, "../data/curriculum-versions.json");
const CLASSES_FILE   = path.join(__dirname, "../data/classes.json");

const generateId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const readJson = (file) => {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, "utf-8").trim();
  return raw ? JSON.parse(raw) : [];
};

const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");

const norm = (s) => (s || "").trim().toLowerCase();

function migrateCurricula(curricula) {
  let changed = 0;
  // curriculumId -> Map(normalized name -> id), used by the version/classes backfills below
  const nameToIdByCurriculum = new Map();

  curricula.forEach((c) => {
    const raw = c.classes || [];
    const alreadyMigrated = raw.length > 0 && typeof raw[0] === "object";

    if (alreadyMigrated) {
      nameToIdByCurriculum.set(c.id, new Map(raw.map((cls) => [norm(cls.name), cls.id])));
      return;
    }

    const migrated = raw.map((name) => ({ id: generateId(), name }));
    c.classes = migrated;
    nameToIdByCurriculum.set(c.id, new Map(migrated.map((cls) => [norm(cls.name), cls.id])));
    if (raw.length) changed++;
  });

  return { changed, nameToIdByCurriculum };
}

function migrateVersions(versions, nameToIdByCurriculum) {
  let changed = 0;

  versions.forEach((v) => {
    const nameToId = nameToIdByCurriculum.get(v.curriculumId);
    (v.content || []).forEach((period) => {
      (period.classes || []).forEach((cls) => {
        if (cls.classId !== undefined) return; // already migrated
        const id = nameToId ? nameToId.get(norm(cls.className)) : undefined;
        cls.classId = id ?? null;
        changed++;
      });
    });
  });

  return changed;
}

function migrateClasses(classes, nameToIdByCurriculum) {
  let changed = 0;

  classes.forEach((cls) => {
    const nameToId = nameToIdByCurriculum.get(cls.curriculumId);
    const newGradeId = nameToId ? nameToId.get(norm(cls.gradeName)) : undefined;
    // Only upgrade if we found a confident match — never blank out an existing gradeId.
    if (newGradeId && newGradeId !== cls.gradeId) {
      cls.gradeId = newGradeId;
      changed++;
    }
  });

  return changed;
}

function run() {
  const curricula = readJson(CURRICULA_FILE);
  const { changed: curriculaChanged, nameToIdByCurriculum } = migrateCurricula(curricula);
  writeJson(CURRICULA_FILE, curricula);
  console.log(`curricula.json: migrated classes on ${curriculaChanged} curriculum(a)`);

  const versions = readJson(VERSIONS_FILE);
  const versionsChanged = migrateVersions(versions, nameToIdByCurriculum);
  writeJson(VERSIONS_FILE, versions);
  console.log(`curriculum-versions.json: backfilled classId on ${versionsChanged} class entr(y/ies)`);

  const classes = readJson(CLASSES_FILE);
  const classesChanged = migrateClasses(classes, nameToIdByCurriculum);
  writeJson(CLASSES_FILE, classes);
  console.log(`classes.json: upgraded gradeId on ${classesChanged} class record(s)`);
}

run();
