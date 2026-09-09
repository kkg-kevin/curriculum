// One-off operational script: deep-clones one admin's ENTIRE tenant (every hub, curriculum,
// course, assessment, the 5 tenant-owned settings catalogs, every learner/teacher linked into
// those hubs, and their full operational history) into brand-new rows owned by a different
// admin. Every row gets a fresh id; every foreign key (plain column or id embedded in JSON) in
// the copies is rewritten to point at the new sibling rows. The source admin's data is never
// modified.
//
// Deliberately excludes: billing (invoices/payments/batches/audit events — real financial
// transactions, cloning them as if they happened twice is wrong), notifications (transient
// inbox, regenerates naturally), public_diagnostic_attempts (anonymous-visitor history tied to
// the original admin's public pages). leads/lead_messages stay platform-wide, untouched.
// billing_number_sequences stays untouched (global counter, not tenant data).
//
// Usage (from server/):
//   node src/scripts/cloneTenant.js --from=admin@digifunzi.com --to=kenmaina@digifunzi.com --dry-run
//   node src/scripts/cloneTenant.js --from=admin@digifunzi.com --to=kenmaina@digifunzi.com
//
// See C:\Users\user\.claude\plans\whimsical-mapping-nygaard.md for the full design rationale —
// this file follows that plan's clone order and JSON-remap list exactly.

const db = require("../config/db");
const { generateId, toJson, stringifyJsonFields } = require("../shared/utils/model.utils");

// Every JSON column NOT already individually remapped/rewrapped inline below (id-embedding
// columns are handled by hand at each insert site, see the plan doc) must still be re-serialized
// on the way back in — mysql2 auto-parses a JSON column to a real JS array/object on SELECT, but
// does not auto-serialize one back on INSERT (see model.utils.js's own comment on toJson/
// stringifyJsonFields); a raw `{...row}` spread of a SELECT * result carries the parsed value
// forward unchanged, which knex then spreads as bad positional params. This is the fields list
// for every table that isn't already fully hand-remapped at its insert site.
const PLAIN_JSON_FIELDS = {
  learning_hubs: ["address", "photos", "amenities", "operatingHours", "spaces"],
  courses: ["requirements"],
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const fromArg = args.find((a) => a.startsWith("--from="));
const toArg = args.find((a) => a.startsWith("--to="));
const FROM_EMAIL = fromArg && fromArg.slice("--from=".length);
const TO_EMAIL = toArg && toArg.slice("--to=".length);

// ---------------------------------------------------------------------------------------------
// id-remap infrastructure
// ---------------------------------------------------------------------------------------------

// One Map per "id space" — tables that mint their own ids (real tables) plus two synthetic id
// spaces for ids that only ever live inside JSON (curricula.classes[].id "cohort" ids, which
// classes.gradeId points into; nothing else needs a synthetic space per the plan's schema map).
const maps = {
  system_levels: new Map(),
  inventory: new Map(),
  competencies: new Map(),
  competency_indicators: new Map(),
  pathway_templates: new Map(),
  learning_hubs: new Map(),
  curricula: new Map(),
  cohort: new Map(), // synthetic: curricula.classes[].id <-> classes.gradeId
  courses: new Map(),
  course_modules: new Map(),
  assessments: new Map(),
  academic_year_groups: new Map(),
  academic_year_versions: new Map(),
  age_categories: new Map(),
  assessment_types: new Map(),
  evidence_types: new Map(),
  pathways: new Map(),
  progress_levels: new Map(),
  progression_ladder_rungs: new Map(),
  curriculum_versions: new Map(),
  learning_hub_curricula: new Map(),
  rooms: new Map(),
  performance_bands: new Map(),
  course_sessions: new Map(),
  classes: new Map(),
  programs: new Map(),
  learners: new Map(),
  teachers: new Map(),
  users: new Map(), // original users.id -> new users.id, only for people actually cloned
  learner_hub_links: new Map(),
  teacher_hub_links: new Map(),
  class_groups: new Map(),
  learner_pathways: new Map(),
  assessment_issues: new Map(),
  assessment_submissions: new Map(),
};

const counts = {}; // table -> number of rows cloned, for the summary report
function bump(table, n = 1) {
  counts[table] = (counts[table] || 0) + n;
}

const fallbacks = { userIdDefaultedToTargetAdmin: 0, sentinelPassedThrough: 0 };

function remapId(mapName, oldId) {
  if (oldId === null || oldId === undefined || oldId === "") return oldId;
  return maps[mapName].get(oldId) ?? oldId; // falls through unchanged if not in this tenant's clone set (shouldn't happen for in-tenant refs; caught by verification pass)
}

function remapArray(mapName, arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map((v) => remapId(mapName, v));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A users.id reference that isn't the row being cloned itself (issuedBy, gradedBy, markedBy,
// taughtBy, attendanceLockedBy, createdBy, transferredBy, payerUserId, recordedBy, actorUserId —
// though the billing ones are moot, billing is excluded). Sentinel strings ("system",
// "system-backfill") pass through unchanged. A real users.id is remapped through maps.users if
// that person was cloned (a teacher/admin who was itself cloned), otherwise defaults to the
// target admin's own id — never left dangling, never pointing at the source tenant's admin.
function remapActorUserId(oldId, targetAdminId) {
  if (oldId === null || oldId === undefined || oldId === "") return oldId;
  if (!UUID_RE.test(oldId)) {
    fallbacks.sentinelPassedThrough++;
    return oldId;
  }
  if (maps.users.has(oldId)) return maps.users.get(oldId);
  fallbacks.userIdDefaultedToTargetAdmin++;
  return targetAdminId;
}

// Generic "walk this JSON value, remap any key literally named one of these id-ish keys, using
// the given mapName" pass — used for the handful of columns whose nested shape is a snapshot
// display structure (reports.content, assessment_submissions.indicatorBreakdown/
// milestoneProgress) rather than a precisely-typed shape worth a dedicated function for.
function remapKnownIdKeys(value, keyToMapName) {
  if (Array.isArray(value)) return value.map((v) => remapKnownIdKeys(v, keyToMapName));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (keyToMapName[k] && typeof v === "string" && UUID_RE.test(v)) {
        out[k] = remapId(keyToMapName[k], v);
      } else {
        out[k] = remapKnownIdKeys(v, keyToMapName);
      }
    }
    return out;
  }
  return value;
}

const INDICATOR_KEYS = { indicatorId: "competency_indicators" };
const ASSESSMENT_KEYS = { assessmentId: "assessments" };

// ---------------------------------------------------------------------------------------------
// insert helper — bypasses model/service validation layers on purpose (this script writes
// pre-validated shapes cloned from already-valid rows), stamps a fresh id, preserves original
// createdAt/updatedAt (this is a copy of real history, not new activity).
// ---------------------------------------------------------------------------------------------

async function insertClone(trx, table, row) {
  if (!DRY_RUN) await trx(table).insert(row);
  bump(table);
  return row;
}

// ---------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------

async function run() {
  if (!FROM_EMAIL || !TO_EMAIL) {
    console.error("Usage: node src/scripts/cloneTenant.js --from=<email> --to=<email> [--dry-run]");
    process.exitCode = 1;
    return;
  }

  const sourceAdmin = await db("users").where({ email: FROM_EMAIL, role: "admin" }).first();
  const targetAdmin = await db("users").where({ email: TO_EMAIL, role: "admin" }).first();
  if (!sourceAdmin) throw new Error(`No admin found with email ${FROM_EMAIL}`);
  if (!targetAdmin) throw new Error(`No admin found with email ${TO_EMAIL}`);
  if (sourceAdmin.id === targetAdmin.id) throw new Error("--from and --to must be different admins");

  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Cloning tenant ${FROM_EMAIL} -> ${TO_EMAIL}`);

  const trx = await db.transaction();
  try {
    await cloneTenant(trx, sourceAdmin, targetAdmin);
    if (DRY_RUN) {
      await trx.rollback();
      console.log("\n[DRY RUN] Rolled back — no data was written.");
    } else {
      await trx.commit();
      console.log("\nCommitted.");
    }
    printSummary();
    process.exit(0);
  } catch (err) {
    await trx.rollback().catch(() => {});
    console.error("\nClone FAILED, rolled back:", err);
    process.exitCode = 1;
  }
}

function printSummary() {
  console.log("\n--- Row counts cloned per table ---");
  Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])).forEach(([t, n]) => {
    console.log(`  ${t.padEnd(30)} ${n}`);
  });
  console.log("\n--- Fallback cases (review before trusting a real run) ---");
  console.log(`  users.id references defaulted to target admin: ${fallbacks.userIdDefaultedToTargetAdmin}`);
  console.log(`  sentinel strings ("system"/"system-backfill") passed through: ${fallbacks.sentinelPassedThrough}`);
}

async function cloneTenant(trx, sourceAdmin, targetAdmin) {
  const srcId = sourceAdmin.id;
  const dstId = targetAdmin.id;

  // ===== Step 1: independent owned catalogs =====================================================
  const systemLevels = await trx("system_levels").where({ ownerAdminId: srcId });
  for (const row of systemLevels) {
    const newId = generateId();
    maps.system_levels.set(row.id, newId);
    await insertClone(trx, "system_levels", { ...row, id: newId, ownerAdminId: dstId });
  }

  const inventory = await trx("inventory").where({ ownerAdminId: srcId });
  for (const row of inventory) {
    const newId = generateId();
    maps.inventory.set(row.id, newId);
    await insertClone(trx, "inventory", { ...row, id: newId, ownerAdminId: dstId });
  }

  const competencies = await trx("competencies").where({ ownerAdminId: srcId });
  for (const row of competencies) {
    const newId = generateId();
    maps.competencies.set(row.id, newId);
    await insertClone(trx, "competencies", { ...row, id: newId, ownerAdminId: dstId });
  }
  const competencyIds = competencies.map((c) => c.id);
  const indicators = competencyIds.length
    ? await trx("competency_indicators").whereIn("competencyId", competencyIds)
    : [];
  for (const row of indicators) {
    const newId = generateId();
    maps.competency_indicators.set(row.id, newId);
    await insertClone(trx, "competency_indicators", {
      ...row,
      id: newId,
      competencyId: remapId("competencies", row.competencyId),
    });
  }

  // pathway_templates.courses (array of courses.id) is remapped in the backfill pass (step 6b),
  // since courses don't exist yet at this point in the clone order.
  const pathwayTemplates = await trx("pathway_templates").where({ ownerAdminId: srcId });
  for (const row of pathwayTemplates) {
    const newId = generateId();
    maps.pathway_templates.set(row.id, newId);
    // courses (array of courses.id) starts empty/unset here — courses don't exist yet at this
    // point in the clone order — and gets its real remapped value written in the step 6b backfill.
    await insertClone(trx, "pathway_templates", { ...row, id: newId, ownerAdminId: dstId, courses: toJson([]) });
  }

  // ===== Step 2: learning_hubs (self-referential parentHubId; curriculumId backfilled step 6b) ===
  const hubs = await trx("learning_hubs").where({ ownerAdminId: srcId });
  // Parents before branches — a hub with no parentHubId, or whose parent is outside this
  // tenant (shouldn't happen), goes first.
  const hubsSorted = [...hubs].sort((a, b) => (a.parentHubId ? 1 : 0) - (b.parentHubId ? 1 : 0));
  for (const row of hubsSorted) {
    const newId = generateId();
    maps.learning_hubs.set(row.id, newId);
    await insertClone(trx, "learning_hubs", stringifyJsonFields({
      ...row,
      id: newId,
      ownerAdminId: dstId,
      parentHubId: row.parentHubId ? remapId("learning_hubs", row.parentHubId) : null,
      curriculumId: null, // backfilled in step 6b once curricula exist
    }, PLAIN_JSON_FIELDS.learning_hubs));
  }
  if (hubs.length === 0) {
    console.log("Source admin has no learning hubs — nothing to clone.");
  }

  // ===== Step 3: curricula (classes[]/periods/competencyWeights remap) ===========================
  const curricula = await trx("curricula").where({ ownerAdminId: srcId });
  const pendingHubCurriculumId = []; // [{hubId(new), original curriculumId}]
  for (const row of curricula) {
    const newId = generateId();
    maps.curricula.set(row.id, newId);

    // curricula.classes[]: mint a fresh "cohort" id per entry now (systemLevelId/
    // developmentalStageId remapped in the step-6b backfill, once system_levels(done, step 1)
    // and age_categories(step 6) both exist — systemLevelId is already available now, remap it
    // here; developmentalStageId needs the backfill pass).
    const classesArr = Array.isArray(row.classes) ? row.classes : [];
    const newClasses = classesArr.map((c) => {
      const newCohortId = generateId();
      maps.cohort.set(c.id, newCohortId);
      return {
        ...c,
        id: newCohortId,
        systemLevelId: c.systemLevelId ? remapId("system_levels", c.systemLevelId) : c.systemLevelId,
        // developmentalStageId remapped in step 6b backfill.
      };
    });

    const competencyWeightsArr = Array.isArray(row.competencyWeights) ? row.competencyWeights : [];
    const newCompetencyWeights = competencyWeightsArr.map((w) => ({
      ...w,
      competencyId: remapId("competencies", w.competencyId),
    }));

    await insertClone(trx, "curricula", {
      ...row,
      id: newId,
      ownerAdminId: dstId,
      curriculumAdminId: null, // a curriculum admin login is a separate delegation the target admin can set up themselves; never carry the source's delegate over
      classes: toJson(newClasses),
      periods: toJson(row.periods), // confirmed no embedded ids
      competencyWeights: toJson(newCompetencyWeights),
    });

    // Remember which cloned hubs pointed at this original curriculum, to backfill in step 6b.
    hubsSorted.forEach((h) => {
      if (h.curriculumId === row.id) pendingHubCurriculumId.push({ newHubId: maps.learning_hubs.get(h.id), originalCurriculumId: row.id });
    });
  }

  // ===== Step 4: courses + direct children =====================================================
  const courses = await trx("courses").where({ ownerAdminId: srcId });
  for (const row of courses) {
    const newId = generateId();
    maps.courses.set(row.id, newId);
    await insertClone(trx, "courses", stringifyJsonFields({ ...row, id: newId, ownerAdminId: dstId }, PLAIN_JSON_FIELDS.courses));
  }
  const courseIds = courses.map((c) => c.id);

  const courseModules = courseIds.length ? await trx("course_modules").whereIn("courseId", courseIds) : [];
  for (const row of courseModules) {
    const newId = generateId();
    maps.course_modules.set(row.id, newId);
    await insertClone(trx, "course_modules", { ...row, id: newId, courseId: remapId("courses", row.courseId) });
  }

  const courseCompetencyLinks = courseIds.length ? await trx("course_competency_links").whereIn("courseId", courseIds) : [];
  for (const row of courseCompetencyLinks) {
    await insertClone(trx, "course_competency_links", {
      ...row,
      id: generateId(),
      courseId: remapId("courses", row.courseId),
      competencyId: remapId("competencies", row.competencyId),
    });
  }

  const courseCurriculumLinks = courseIds.length ? await trx("course_curriculum_links").whereIn("courseId", courseIds) : [];
  for (const row of courseCurriculumLinks) {
    await insertClone(trx, "course_curriculum_links", {
      ...row,
      id: generateId(),
      courseId: remapId("courses", row.courseId),
      curriculumId: remapId("curricula", row.curriculumId),
    });
  }

  // course_pathway_links.pathwayId remapped in step 6b backfill (pathways don't exist yet).
  const coursePathwayLinksRaw = courseIds.length ? await trx("course_pathway_links").whereIn("courseId", courseIds) : [];

  const courseInventoryLinks = courseIds.length ? await trx("course_inventory_links").whereIn("courseId", courseIds) : [];
  for (const row of courseInventoryLinks) {
    await insertClone(trx, "course_inventory_links", {
      ...row,
      id: generateId(),
      courseId: remapId("courses", row.courseId),
      inventoryItemId: remapId("inventory", row.inventoryItemId),
    });
  }

  // ===== Step 5: assessments + direct children ==================================================
  const assessments = await trx("assessments").where({ ownerAdminId: srcId });
  for (const row of assessments) {
    const newId = generateId();
    maps.assessments.set(row.id, newId);
    await insertClone(trx, "assessments", {
      ...row,
      id: newId,
      ownerAdminId: dstId,
      curriculumId: row.curriculumId ? remapId("curricula", row.curriculumId) : row.curriculumId,
      sections: toJson(remapKnownIdKeys(row.sections, INDICATOR_KEYS)),
      items: toJson(remapKnownIdKeys(row.items, INDICATOR_KEYS)),
      rubric: toJson(remapKnownIdKeys(row.rubric, INDICATOR_KEYS)),
      indicators: toJson(remapKnownIdKeys(row.indicators, INDICATOR_KEYS)),
      deliverables: toJson(remapKnownIdKeys(row.deliverables, INDICATOR_KEYS)),
      milestones: toJson(remapKnownIdKeys(row.milestones, INDICATOR_KEYS)),
    });
  }
  const assessmentIds = assessments.map((a) => a.id);

  const assessmentCompetencyLinks = assessmentIds.length ? await trx("assessment_competency_links").whereIn("assessmentId", assessmentIds) : [];
  for (const row of assessmentCompetencyLinks) {
    await insertClone(trx, "assessment_competency_links", {
      ...row,
      id: generateId(),
      assessmentId: remapId("assessments", row.assessmentId),
      competencyId: remapId("competencies", row.competencyId),
    });
  }

  const assessmentInventoryLinks = assessmentIds.length ? await trx("assessment_inventory_links").whereIn("assessmentId", assessmentIds) : [];
  for (const row of assessmentInventoryLinks) {
    await insertClone(trx, "assessment_inventory_links", {
      ...row,
      id: generateId(),
      assessmentId: remapId("assessments", row.assessmentId),
      inventoryItemId: remapId("inventory", row.inventoryItemId),
    });
  }

  // assessment_pathway_links.pathwayId remapped in step 6b backfill.
  const assessmentPathwayLinksRaw = assessmentIds.length ? await trx("assessment_pathway_links").whereIn("assessmentId", assessmentIds) : [];

  // ===== Step 6: curriculum-framework children of curricula ======================================
  const curriculumIds = curricula.map((c) => c.id);
  const byCurriculum = (table) => (curriculumIds.length ? trx(table).whereIn("curriculumId", curriculumIds) : Promise.resolve([]));

  const academicYearGroups = await byCurriculum("academic_year_groups");
  for (const row of academicYearGroups) {
    const newId = generateId();
    maps.academic_year_groups.set(row.id, newId);
    await insertClone(trx, "academic_year_groups", { ...row, id: newId, curriculumId: remapId("curricula", row.curriculumId) });
  }
  const yearGroupIds = academicYearGroups.map((g) => g.id);
  const academicYearVersions = yearGroupIds.length ? await trx("academic_year_versions").whereIn("yearGroupId", yearGroupIds) : [];
  for (const row of academicYearVersions) {
    const newId = generateId();
    maps.academic_year_versions.set(row.id, newId);
    await insertClone(trx, "academic_year_versions", {
      ...row,
      id: newId,
      yearGroupId: remapId("academic_year_groups", row.yearGroupId),
      curriculumId: remapId("curricula", row.curriculumId),
      periods: toJson(row.periods), // confirmed date-range shape, no embedded ids (same shape family as curricula.periods)
    });
  }

  const ageCategories = await byCurriculum("age_categories");
  for (const row of ageCategories) {
    const newId = generateId();
    maps.age_categories.set(row.id, newId);
    await insertClone(trx, "age_categories", {
      ...row,
      id: newId,
      curriculumId: remapId("curricula", row.curriculumId),
      diagnosticAssessmentId: row.diagnosticAssessmentId ? remapId("assessments", row.diagnosticAssessmentId) : row.diagnosticAssessmentId,
      competencyIds: toJson(remapArray("competencies", row.competencyIds)),
      indicatorContributions: toJson(remapKnownIdKeys(row.indicatorContributions, { competencyId: "competencies" })),
    });
  }

  const assessmentTypes = await byCurriculum("assessment_types");
  for (const row of assessmentTypes) {
    const newId = generateId();
    maps.assessment_types.set(row.id, newId);
    // pathwayId AND evidenceWeights (each entry's evidenceTypeId -> evidence_types.id, plus
    // nested competencyMappings[].competencyId) are both remapped in the step 6b backfill below —
    // pathways/evidence_types don't exist yet at this point in the clone order (evidence_types is
    // cloned later in this same step 6, competencies already exist from step 1).
    await insertClone(trx, "assessment_types", {
      ...row,
      id: newId,
      curriculumId: remapId("curricula", row.curriculumId),
      evidenceWeights: toJson([]),
    });
  }

  const curriculumCompetencyLinks = await byCurriculum("curriculum_competency_links");
  for (const row of curriculumCompetencyLinks) {
    await insertClone(trx, "curriculum_competency_links", {
      ...row,
      id: generateId(),
      curriculumId: remapId("curricula", row.curriculumId),
      competencyId: remapId("competencies", row.competencyId),
    });
  }

  const evidenceTypes = await byCurriculum("evidence_types");
  for (const row of evidenceTypes) {
    const newId = generateId();
    maps.evidence_types.set(row.id, newId);
    await insertClone(trx, "evidence_types", { ...row, id: newId, curriculumId: remapId("curricula", row.curriculumId) });
  }

  // pathways.courses / courseSequence remapped now (courses already cloned in step 4).
  const pathways = await byCurriculum("pathways");
  for (const row of pathways) {
    const newId = generateId();
    maps.pathways.set(row.id, newId);
    await insertClone(trx, "pathways", {
      ...row,
      id: newId,
      curriculumId: remapId("curricula", row.curriculumId),
      diagnosticAssessmentId: row.diagnosticAssessmentId ? remapId("assessments", row.diagnosticAssessmentId) : row.diagnosticAssessmentId,
      courses: toJson(remapArray("courses", row.courses)),
      courseSequence: toJson(remapArray("courses", row.courseSequence)),
    });
  }

  const progressLevels = await byCurriculum("progress_levels");
  for (const row of progressLevels) {
    const newId = generateId();
    maps.progress_levels.set(row.id, newId);
    await insertClone(trx, "progress_levels", { ...row, id: newId, curriculumId: remapId("curricula", row.curriculumId) });
  }

  const progressionLadderRungs = await byCurriculum("progression_ladder_rungs");
  for (const row of progressionLadderRungs) {
    const newId = generateId();
    maps.progression_ladder_rungs.set(row.id, newId);
    // assignments: legacy/mostly-unused shape, unconfirmed — pass through unchanged rather than
    // guess at a remap that could corrupt it; flagged in the plan as low priority.
    await insertClone(trx, "progression_ladder_rungs", { ...row, id: newId, curriculumId: remapId("curricula", row.curriculumId), assignments: toJson(row.assignments) });
  }

  const curriculumCompetencyIndicators = await byCurriculum("curriculum_competency_indicators");
  for (const row of curriculumCompetencyIndicators) {
    await insertClone(trx, "curriculum_competency_indicators", {
      ...row,
      id: generateId(),
      curriculumId: remapId("curricula", row.curriculumId),
      competencyId: remapId("competencies", row.competencyId),
    });
  }

  // curriculum_versions.content — actively dereferenced at runtime (content.utils.js's
  // collectCourseIds), must be rewritten for EVERY version row (draft/published/inactive).
  // versionOf is self-referential — clone in original createdAt order so a later version's
  // versionOf already has its remap entry.
  const curriculumVersionsRaw = curriculumIds.length
    ? await trx("curriculum_versions").whereIn("curriculumId", curriculumIds).orderBy("createdAt", "asc")
    : [];
  for (const row of curriculumVersionsRaw) {
    const newId = generateId();
    maps.curriculum_versions.set(row.id, newId);
    const content = Array.isArray(row.content)
      ? row.content.map((period) => ({
          ...period,
          classes: Array.isArray(period.classes)
            ? period.classes.map((cls) => ({
                ...cls,
                classId: cls.classId ? remapId("cohort", cls.classId) : cls.classId,
                courses: Array.isArray(cls.courses)
                  ? cls.courses.map((c) => ({ ...c, id: remapId("courses", c.id) }))
                  : cls.courses,
              }))
            : period.classes,
        }))
      : row.content;
    await insertClone(trx, "curriculum_versions", {
      ...row,
      id: newId,
      curriculumId: remapId("curricula", row.curriculumId),
      academicYearId: row.academicYearId ? remapId("academic_year_versions", row.academicYearId) : row.academicYearId,
      versionOf: row.versionOf ? remapId("curriculum_versions", row.versionOf) : row.versionOf,
      content: toJson(content),
    });
  }

  // --- Step 6b: backfill everything that referenced pathways/age_categories before they existed ---
  for (const { newHubId, originalCurriculumId } of pendingHubCurriculumId) {
    if (!DRY_RUN) {
      await trx("learning_hubs").where({ id: newHubId }).update({ curriculumId: remapId("curricula", originalCurriculumId) });
    }
  }

  for (const row of pathwayTemplates) {
    if (!DRY_RUN) {
      await trx("pathway_templates").where({ id: maps.pathway_templates.get(row.id) }).update({
        courses: toJson(remapArray("courses", row.courses)),
      });
    }
  }

  for (const row of coursePathwayLinksRaw) {
    await insertClone(trx, "course_pathway_links", {
      ...row,
      id: generateId(),
      courseId: remapId("courses", row.courseId),
      pathwayId: remapId("pathways", row.pathwayId),
    });
  }

  for (const row of assessmentPathwayLinksRaw) {
    await insertClone(trx, "assessment_pathway_links", {
      ...row,
      id: generateId(),
      assessmentId: remapId("assessments", row.assessmentId),
      pathwayId: remapId("pathways", row.pathwayId),
    });
  }

  for (const row of assessmentTypes) {
    const evidenceWeights = Array.isArray(row.evidenceWeights)
      ? row.evidenceWeights.map((w) => ({
          ...w,
          evidenceTypeId: remapId("evidence_types", w.evidenceTypeId),
          competencyMappings: Array.isArray(w.competencyMappings)
            ? w.competencyMappings.map((m) => ({ ...m, competencyId: remapId("competencies", m.competencyId) }))
            : w.competencyMappings,
        }))
      : row.evidenceWeights;
    if (!DRY_RUN) {
      await trx("assessment_types").where({ id: maps.assessment_types.get(row.id) }).update({
        pathwayId: row.pathwayId ? remapId("pathways", row.pathwayId) : row.pathwayId,
        evidenceWeights: toJson(evidenceWeights),
      });
    }
  }

  // curricula.classes[].developmentalStageId -> age_categories.id, backfilled now that
  // age_categories exist.
  for (const row of curricula) {
    const newCurriculumId = maps.curricula.get(row.id);
    const classesArr = Array.isArray(row.classes) ? row.classes : [];
    if (classesArr.length === 0) continue;
    const updatedClasses = classesArr.map((c) => ({
      id: remapId("cohort", c.id),
      name: c.name,
      systemLevelId: c.systemLevelId ? remapId("system_levels", c.systemLevelId) : c.systemLevelId,
      shortLabel: c.shortLabel,
      developmentalStageId: c.developmentalStageId ? remapId("age_categories", c.developmentalStageId) : c.developmentalStageId,
    }));
    if (!DRY_RUN) {
      await trx("curricula").where({ id: newCurriculumId }).update({ classes: toJson(updatedClasses) });
    }
  }

  // ===== Step 7: learning_hub_curricula, rooms, performance_bands, course_sessions ================
  const hubIds = hubs.map((h) => h.id);
  const learningHubCurricula = hubIds.length ? await trx("learning_hub_curricula").whereIn("hubId", hubIds) : [];
  for (const row of learningHubCurricula) {
    const newId = generateId();
    maps.learning_hub_curricula.set(row.id, newId);
    await insertClone(trx, "learning_hub_curricula", {
      ...row,
      id: newId,
      hubId: remapId("learning_hubs", row.hubId),
      curriculumId: remapId("curricula", row.curriculumId),
    });
  }

  const rooms = hubIds.length ? await trx("rooms").whereIn("hubId", hubIds) : [];
  for (const row of rooms) {
    const newId = generateId();
    maps.rooms.set(row.id, newId);
    await insertClone(trx, "rooms", { ...row, id: newId, hubId: remapId("learning_hubs", row.hubId) });
  }

  const performanceBands = curriculumIds.length ? await trx("performance_bands").whereIn("curriculumId", curriculumIds) : [];
  for (const row of performanceBands) {
    const newId = generateId();
    maps.performance_bands.set(row.id, newId);
    await insertClone(trx, "performance_bands", {
      ...row,
      id: newId,
      curriculumId: remapId("curricula", row.curriculumId),
      pathwayId: row.pathwayId ? remapId("pathways", row.pathwayId) : row.pathwayId,
      courseId: row.courseId ? remapId("courses", row.courseId) : row.courseId,
      ageCategoryId: row.ageCategoryId ? remapId("age_categories", row.ageCategoryId) : row.ageCategoryId,
      competencyIds: toJson(remapArray("competencies", row.competencyIds)),
      indicatorContributions: toJson(remapKnownIdKeys(row.indicatorContributions, { competencyId: "competencies" })),
    });
  }

  const courseSessions = courseIds.length ? await trx("course_sessions").whereIn("courseId", courseIds) : [];
  for (const row of courseSessions) {
    const newId = generateId();
    maps.course_sessions.set(row.id, newId);
    await insertClone(trx, "course_sessions", stringifyJsonFields({
      ...row,
      id: newId,
      courseId: remapId("courses", row.courseId),
      moduleId: row.moduleId ? remapId("course_modules", row.moduleId) : row.moduleId,
      assessmentIds: toJson(remapArray("assessments", row.assessmentIds)),
      indicatorIds: toJson(remapArray("competency_indicators", row.indicatorIds)),
      // assessmentAttachments: unconfirmed shape per the plan: pass through unchanged rather
      // than guess — if it embeds assessment ids, a follow-up backfill can correct it later
      // without risk of corrupting anything already correct.
      assessmentAttachments: toJson(row.assessmentAttachments),
      // outcomes/mainConcepts/activities/notes/resources: plain descriptive JSON, no embedded
      // ids per the plan's schema map — just needs re-serializing, not remapping.
    }, ["outcomes", "mainConcepts", "activities", "notes", "resources"]));
  }

  // ===== Step 8: classes, programs ===============================================================
  const classes = hubIds.length ? await trx("classes").whereIn("schoolId", hubIds) : [];
  for (const row of classes) {
    const newId = generateId();
    maps.classes.set(row.id, newId);
    await insertClone(trx, "classes", {
      ...row,
      id: newId,
      schoolId: remapId("learning_hubs", row.schoolId),
      curriculumId: remapId("curricula", row.curriculumId),
      gradeId: remapId("cohort", row.gradeId),
      classTeacherId: null, // legacy field; teachers are re-linked via class_course_teacher_links below, not this column
      // tag is system-wide unique (class.service.js's assertTagAvailable) — never copy verbatim.
      tag: row.tag ? `${row.tag}-clone-${newId.slice(0, 8)}` : row.tag,
    });
  }
  const classIds = classes.map((c) => c.id);

  const programs = hubIds.length ? await trx("programs").whereIn("hubId", hubIds) : [];
  for (const row of programs) {
    const newId = generateId();
    maps.programs.set(row.id, newId);
    await insertClone(trx, "programs", {
      ...row,
      id: newId,
      hubId: remapId("learning_hubs", row.hubId),
      curriculumId: row.curriculumId ? remapId("curricula", row.curriculumId) : row.curriculumId,
      classIds: toJson(remapArray("classes", row.classIds)),
    });
  }

  // ===== Step 9: learners, teachers (only those linked to this admin's hubs) =====================
  const learnerHubLinksRaw = hubIds.length ? await trx("learner_hub_links").whereIn("hubId", hubIds) : [];
  const learnerIds = [...new Set(learnerHubLinksRaw.map((l) => l.learnerId))];
  const learners = learnerIds.length ? await trx("learners").whereIn("id", learnerIds) : [];
  for (const row of learners) {
    const newId = generateId();
    maps.learners.set(row.id, newId);

    // Only mint a new users row if THIS learner actually had a dedicated username login —
    // guardian-mediated logins are matched by guardianEmail, handled by copying guardianEmail
    // as-is (a guardian can legitimately have children under both admins).
    let newUsername = row.username;
    if (row.username) {
      const existingUser = await trx("users").where({ username: row.username }).first();
      if (existingUser) {
        newUsername = `${row.username}-${newId.slice(0, 6)}`;
        const newUserId = generateId();
        maps.users.set(existingUser.id, newUserId);
        if (!DRY_RUN) {
          await trx("users").insert({
            id: newUserId,
            name: existingUser.name,
            email: existingUser.email, // nullable, username-login learners typically have no email
            username: newUsername,
            passwordHash: existingUser.passwordHash,
            role: existingUser.role,
            photo: existingUser.photo,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        bump("users");
      }
    }

    await insertClone(trx, "learners", {
      ...row,
      id: newId,
      username: newUsername,
      currentRungId: row.currentRungId ? remapId("progression_ladder_rungs", row.currentRungId) : row.currentRungId,
      publicToken: null, // regenerated on demand by the app (regeneratePublicToken), never copied
    });
  }

  const teacherHubLinksRaw = hubIds.length ? await trx("teacher_hub_links").whereIn("hubId", hubIds) : [];
  const teacherIds = [...new Set(teacherHubLinksRaw.map((l) => l.teacherId))];
  const teachers = teacherIds.length ? await trx("teachers").whereIn("id", teacherIds) : [];
  for (const row of teachers) {
    const newId = generateId();
    maps.teachers.set(row.id, newId);

    let newEmail = row.email;
    if (row.email) {
      const existingUser = await trx("users").where({ email: row.email }).first();
      if (existingUser) {
        const [local, domain] = row.email.split("@");
        newEmail = `${local}+clone-${newId.slice(0, 6)}@${domain}`;
        const newUserId = generateId();
        maps.users.set(existingUser.id, newUserId);
        if (!DRY_RUN) {
          await trx("users").insert({
            id: newUserId,
            name: existingUser.name,
            email: newEmail,
            username: existingUser.username,
            passwordHash: existingUser.passwordHash,
            role: existingUser.role,
            photo: existingUser.photo,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        bump("users");
      }
    }

    await insertClone(trx, "teachers", {
      ...row,
      id: newId,
      email: newEmail,
      qualifiedCourseIds: toJson(remapArray("courses", row.qualifiedCourseIds)),
    });
  }

  // ===== Step 10: hub links, class-course-teacher links, class groups, learner pathways, transfers, availability ===
  for (const row of learnerHubLinksRaw) {
    const newId = generateId();
    maps.learner_hub_links.set(row.id, newId);
    await insertClone(trx, "learner_hub_links", {
      ...row,
      id: newId,
      learnerId: remapId("learners", row.learnerId),
      hubId: remapId("learning_hubs", row.hubId),
      classId: row.classId ? remapId("classes", row.classId) : row.classId,
      currentStageId: row.currentStageId ? remapId("age_categories", row.currentStageId) : row.currentStageId,
      currentBandId: row.currentBandId ? remapId("performance_bands", row.currentBandId) : row.currentBandId,
    });
  }

  for (const row of teacherHubLinksRaw) {
    const newId = generateId();
    maps.teacher_hub_links.set(row.id, newId);
    await insertClone(trx, "teacher_hub_links", {
      ...row,
      id: newId,
      teacherId: remapId("teachers", row.teacherId),
      hubId: remapId("learning_hubs", row.hubId),
    });
  }

  const classCourseTeacherLinks = classIds.length ? await trx("class_course_teacher_links").whereIn("classId", classIds) : [];
  for (const row of classCourseTeacherLinks) {
    await insertClone(trx, "class_course_teacher_links", {
      ...row,
      id: generateId(),
      classId: remapId("classes", row.classId),
      courseId: remapId("courses", row.courseId),
      teacherId: remapId("teachers", row.teacherId),
    });
  }

  const classGroups = classIds.length ? await trx("class_groups").whereIn("classId", classIds) : [];
  for (const row of classGroups) {
    const newId = generateId();
    maps.class_groups.set(row.id, newId);
    await insertClone(trx, "class_groups", { ...row, id: newId, classId: remapId("classes", row.classId) });
  }
  const classGroupIds = classGroups.map((g) => g.id);
  const classGroupMembers = classGroupIds.length ? await trx("class_group_members").whereIn("groupId", classGroupIds) : [];
  for (const row of classGroupMembers) {
    await insertClone(trx, "class_group_members", {
      ...row,
      id: generateId(),
      groupId: remapId("class_groups", row.groupId),
      learnerId: remapId("learners", row.learnerId),
    });
  }

  const learnerPathways = learnerIds.length ? await trx("learner_pathways").whereIn("learnerId", learnerIds) : [];
  for (const row of learnerPathways) {
    const newId = generateId();
    maps.learner_pathways.set(row.id, newId);
    const history = Array.isArray(row.history)
      ? row.history.map((h) => ({
          ...h,
          courseId: h.courseId ? remapId("courses", h.courseId) : h.courseId,
          assessmentId: h.assessmentId ? remapId("assessments", h.assessmentId) : h.assessmentId,
        }))
      : row.history;
    await insertClone(trx, "learner_pathways", {
      ...row,
      id: newId,
      learnerId: remapId("learners", row.learnerId),
      curriculumId: remapId("curricula", row.curriculumId),
      pathwayId: remapId("pathways", row.pathwayId),
      currentCourseId: row.currentCourseId ? remapId("courses", row.currentCourseId) : row.currentCourseId,
      history: toJson(history),
    });
  }

  const learnerTransfers = learnerIds.length ? await trx("learner_transfers").whereIn("learnerId", learnerIds) : [];
  for (const row of learnerTransfers) {
    await insertClone(trx, "learner_transfers", {
      ...row,
      id: generateId(),
      learnerId: remapId("learners", row.learnerId),
      fromHubId: row.fromHubId ? remapId("learning_hubs", row.fromHubId) : row.fromHubId,
      toHubId: row.toHubId ? remapId("learning_hubs", row.toHubId) : row.toHubId,
      fromClassId: row.fromClassId ? remapId("classes", row.fromClassId) : row.fromClassId,
      toClassId: row.toClassId ? remapId("classes", row.toClassId) : row.toClassId,
      transferredBy: remapActorUserId(row.transferredBy, dstId),
    });
  }

  const teacherAvailability = teacherIds.length ? await trx("teacher_availability_slots").whereIn("teacherId", teacherIds) : [];
  for (const row of teacherAvailability) {
    await insertClone(trx, "teacher_availability_slots", { ...row, id: generateId(), teacherId: remapId("teachers", row.teacherId) });
  }

  // ===== Step 11: timetable ======================================================================
  const timetableSlots = classIds.length ? await trx("timetable_slots").whereIn("classId", classIds) : [];
  for (const row of timetableSlots) {
    await insertClone(trx, "timetable_slots", {
      ...row,
      id: generateId(),
      classId: remapId("classes", row.classId),
      courseId: remapId("courses", row.courseId),
      teacherId: row.teacherId ? remapId("teachers", row.teacherId) : row.teacherId,
      roomId: row.roomId ? remapId("rooms", row.roomId) : row.roomId,
    });
  }

  const timetableCourseSchedules = classIds.length ? await trx("timetable_course_schedules").whereIn("classId", classIds) : [];
  for (const row of timetableCourseSchedules) {
    await insertClone(trx, "timetable_course_schedules", {
      ...row,
      id: generateId(),
      classId: remapId("classes", row.classId),
      courseId: remapId("courses", row.courseId),
    });
  }

  const timetableSessionSkips = classIds.length ? await trx("timetable_session_skips").whereIn("classId", classIds) : [];
  for (const row of timetableSessionSkips) {
    await insertClone(trx, "timetable_session_skips", {
      ...row,
      id: generateId(),
      classId: remapId("classes", row.classId),
      courseId: remapId("courses", row.courseId),
      sessionId: row.sessionId ? remapId("course_sessions", row.sessionId) : row.sessionId,
      createdBy: remapActorUserId(row.createdBy, dstId),
      roomId: row.roomId ? remapId("rooms", row.roomId) : row.roomId,
      teacherId: row.teacherId ? remapId("teachers", row.teacherId) : row.teacherId,
    });
  }

  const sessionOccurrences = classIds.length ? await trx("session_occurrences").whereIn("classId", classIds) : [];
  for (const row of sessionOccurrences) {
    await insertClone(trx, "session_occurrences", {
      ...row,
      id: generateId(),
      classId: remapId("classes", row.classId),
      courseId: remapId("courses", row.courseId),
      sessionId: row.sessionId ? remapId("course_sessions", row.sessionId) : row.sessionId,
      taughtBy: remapActorUserId(row.taughtBy, dstId),
      attendanceLockedBy: remapActorUserId(row.attendanceLockedBy, dstId),
    });
  }

  // ===== Step 12: assessment issues + submissions ================================================
  // assessmentId is notNullable on every row (both the course-attached and standalone-diagnostic
  // shapes set it — see 20260807120006_assessments.js), unlike classId/learnerId which are only
  // set on one shape or the other — so filtering by assessmentIds (already scoped to this tenant)
  // catches both shapes correctly, where classIds alone would miss standalone diagnostic issues.
  // Ordered by issuedAt (this table has no createdAt/updatedAt — it stamps issuedAt instead) so a
  // reissue's reissuedFromIssueId always has its remap entry by the time it's needed.
  const assessmentIssuesRaw = assessmentIds.length ? await trx("assessment_issues").whereIn("assessmentId", assessmentIds).orderBy("issuedAt", "asc") : [];
  for (const row of assessmentIssuesRaw) {
    const newId = generateId();
    maps.assessment_issues.set(row.id, newId);
    await insertClone(trx, "assessment_issues", {
      ...row,
      id: newId,
      assessmentId: remapId("assessments", row.assessmentId),
      sessionId: row.sessionId ? remapId("course_sessions", row.sessionId) : row.sessionId,
      courseId: row.courseId ? remapId("courses", row.courseId) : row.courseId,
      classId: row.classId ? remapId("classes", row.classId) : row.classId,
      issuedBy: remapActorUserId(row.issuedBy, dstId),
      learnerId: remapId("learners", row.learnerId),
      pathwayId: row.pathwayId ? remapId("pathways", row.pathwayId) : row.pathwayId,
      ageCategoryId: row.ageCategoryId ? remapId("age_categories", row.ageCategoryId) : row.ageCategoryId,
      hubId: row.hubId ? remapId("learning_hubs", row.hubId) : row.hubId,
      reissuedFromIssueId: row.reissuedFromIssueId ? remapId("assessment_issues", row.reissuedFromIssueId) : row.reissuedFromIssueId,
    });
  }

  const assessmentSubmissionsRaw = learnerIds.length ? await trx("assessment_submissions").whereIn("learnerId", learnerIds) : [];
  for (const row of assessmentSubmissionsRaw) {
    const newId = generateId();
    maps.assessment_submissions.set(row.id, newId);
    await insertClone(trx, "assessment_submissions", {
      ...row,
      id: newId,
      issueId: row.issueId ? remapId("assessment_issues", row.issueId) : row.issueId,
      assessmentId: remapId("assessments", row.assessmentId),
      learnerId: remapId("learners", row.learnerId),
      classId: row.classId ? remapId("classes", row.classId) : row.classId,
      gradedBy: remapActorUserId(row.gradedBy, dstId),
      reportPublishedBy: remapActorUserId(row.reportPublishedBy, dstId),
      groupId: row.groupId ? remapId("class_groups", row.groupId) : row.groupId,
      // answers/autoItemResults/itemFeedback reference item-local ids only (scoped within the
      // SAME assessment, which is cloned as a whole with its item ids unchanged) — copy verbatim.
      answers: toJson(row.answers),
      autoItemResults: toJson(row.autoItemResults),
      itemFeedback: toJson(row.itemFeedback),
      indicatorBreakdown: toJson(remapKnownIdKeys(row.indicatorBreakdown, INDICATOR_KEYS)),
      milestoneProgress: toJson(remapKnownIdKeys(row.milestoneProgress, INDICATOR_KEYS)),
    });
  }

  // ===== Step 13: attendance, reports ============================================================
  const attendance = classIds.length ? await trx("attendance").whereIn("classId", classIds) : [];
  for (const row of attendance) {
    await insertClone(trx, "attendance", {
      ...row,
      id: generateId(),
      classId: remapId("classes", row.classId),
      learnerId: remapId("learners", row.learnerId),
      markedBy: remapActorUserId(row.markedBy, dstId),
    });
  }

  const reports = classIds.length ? await trx("reports").whereIn("classId", classIds) : [];
  // content.competencyScores[].band/level embed a FULL performance_bands/progress_levels row
  // (see competency.service.js's _competencyScoresFromIndicatorMarks -> runProgressArcEngine),
  // not just an id — so besides indicatorId/assessmentId/competencyId, the nested band/level
  // object's own curriculumId/ageCategoryId/courseId/pathwayId fields need remapping too. This
  // is a display-only historical snapshot (never re-queried by id at runtime, unlike
  // curriculum_versions.content), but leaving a cross-tenant id sitting in a cloned row is still
  // worth fixing for data hygiene.
  const REPORT_CONTENT_KEYS = {
    ...INDICATOR_KEYS,
    ...ASSESSMENT_KEYS,
    competencyId: "competencies",
    curriculumId: "curricula",
    ageCategoryId: "age_categories",
    courseId: "courses",
    pathwayId: "pathways",
  };
  for (const row of reports) {
    const content = remapKnownIdKeys(row.content, REPORT_CONTENT_KEYS);
    await insertClone(trx, "reports", {
      ...row,
      id: generateId(),
      learnerId: remapId("learners", row.learnerId),
      courseId: row.courseId ? remapId("courses", row.courseId) : row.courseId,
      classId: remapId("classes", row.classId),
      sessionId: row.sessionId ? remapId("course_sessions", row.sessionId) : row.sessionId,
      hubId: row.hubId ? remapId("learning_hubs", row.hubId) : row.hubId,
      generatedBy: remapActorUserId(row.generatedBy, dstId),
      publishedBy: remapActorUserId(row.publishedBy, dstId),
      content: toJson(content),
    });
  }
}

run();
