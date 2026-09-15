// Shared by bootcamp-hub.service.js and competition-hub.service.js — the genuinely identical
// logic between the two hub-offering modules (see event.service.js, which this pattern
// replaces: an offering used to be one shared `events` table, now it's two parallel tables
// because a bootcamp and a competition are still otherwise-independent domains, same posture as
// bootcamp.service.js/competition.service.js being duplicated rather than unified).

// Dates are plain "YYYY-MM-DD" strings throughout, which sort lexicographically the same as
// chronologically, so a direct string comparison is safe here — same convention event.service.js
// used for computeStatus.
function computeStatus(startDate, endDate) {
  const today = new Date().toISOString().slice(0, 10);
  if (today < startDate) return "upcoming";
  if (today > endDate) return "completed";
  return "active";
}

// createRecord/updateRecord return the record with `classIds` as whatever was just written — a
// JSON string on create/update (they return the stringified insert/update payload), a real
// array on a fresh read. Normalise to an array so callers never have to care which path fed them
// — same fix as event.service.js's classIdsArray.
function classIdsArray(classIds) {
  if (Array.isArray(classIds)) return classIds;
  if (typeof classIds === "string") {
    try {
      const parsed = JSON.parse(classIds);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// The per-cohort Class payload for ClassService.bulkCreateClasses — one per curriculum cohort,
// direct port of event.service.js's createEvent mapping. academicYear is derived from the
// offering's own startDate (not the hub's or the curriculum's), same as an Event deployment did.
//
// `streamLabel` (typically the bootcamp/competition's own name) disambiguates two DIFFERENT
// offerings that happen to share the same curriculum + academic year at the same hub — e.g. two
// bootcamps both built on the same curriculum, both starting in 2026. Without it,
// class.service.js's assertStreamAvailable (keyed on schoolId+curriculumId+gradeId+academicYear,
// with no notion of "which bootcamp/competition" a class belongs to — `classes` carries no
// offering back-reference) would see the second offering's classes as duplicates of the first's
// and refuse them with "A class for this grade already exists at this hub", even though they're
// two unrelated cohorts that should both be allowed to run there side by side. Omitted (undefined)
// for the one caller that must NOT set it — the generic /bulk route's own "Set Up Year" flow,
// where colliding really does mean "this exact grade already has a class here" and streamName is
// the user's own explicit disambiguation, not an automatic one.
function cohortClassPayload(hub, curriculum, startDate, streamLabel) {
  return (curriculum.classes || []).map((cls) => ({
    schoolId: hub.id,
    curriculumId: curriculum.id,
    gradeId: cls.id,
    gradeName: cls.name,
    academicYear: String(new Date(startDate).getFullYear()),
    capacity: null,
    status: "active",
    ...(streamLabel ? { streamName: streamLabel } : {}),
  }));
}

module.exports = { computeStatus, classIdsArray, cohortClassPayload };
