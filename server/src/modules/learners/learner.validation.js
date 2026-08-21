const { z } = require("zod");

// A learner is an independent identity - name, gender, guardian contact - with no school or
// class field on the record itself. Enrollment (which hub, which class, admission number,
// enrollment status) is a separate many-to-many fact tracked in learner-hub-link.model.js,
// same shape as how teacher.validation.js has no hubId field.
const baseLearnerSchema = z.object({
  firstName:     z.string().min(1, "First name is required"),
  lastName:      z.string().min(1, "Last name is required"),
  gender:        z.enum(["male", "female", "other"]),
  guardianName:  z.string().min(1, "Guardian name is required"),
  guardianPhone: z.string().min(1, "Guardian phone is required"),
  guardianEmail: z.string().email("Invalid guardian email").optional().or(z.literal("")),
  // Account-level access control for the learner record itself. This stays separate from the
  // per-hub enrollment status tracked in learner_hub_links.
  accountStatus: z.enum(["active", "inactive"]).optional(),
  // Optional identity fields - deliberately no .default() (see updateLearner's partial-PUT
  // filter in the controller, which relies on absent keys staying undefined, not defaulted).
  dateOfBirth:   z.string().optional().or(z.literal("")),
  nationality:   z.string().optional().or(z.literal("")),
  languages:     z.string().optional().or(z.literal("")),
  // Lets the learner log into the same guardian-owned account by username instead of typing
  // the guardian's email - see auth.service.js's login. Uniqueness is enforced in
  // learner.service.js (own table, so it can't just reuse AuthService's email-uniqueness check).
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "Only letters, numbers, dots, underscores, and hyphens are allowed")
    .optional().or(z.literal("")),
  // Transient - never persisted onto the learner record. When present, creates or resets the
  // guardian's learner-portal login for guardianEmail (see auth.service.js's
  // setOrCreatePassword), then gets stripped before the learner record is saved.
  password:      z.string().min(8, "Password must be at least 8 characters").or(z.literal("")).default(""),
  // Transient - never persisted. When present, creates or resets the LEARNER's OWN separate
  // portal login (distinct from the guardian's `password` above), keyed by `username` instead
  // of email - see auth.service.js's setOrCreatePasswordByUsername.
  learnerPassword: z.string().min(8, "Password must be at least 8 characters").or(z.literal("")).default(""),
  // Which Progression Ladder rung this learner is currently placed at - superseded by
  // Learning Journey (see currentStageId + learner-journey.model.js) but left as-is since
  // the old ladder UI/data still exists; not read by anything new.
  currentRungId: z.string().optional().nullable().default(null),
  // Profile photo - set via the shared upload pipeline (see uploads module); a bare URL string,
  // not managed as a file upload itself.
  photo: z.string().optional().nullable().default(null),
});

const createLearnerSchema = baseLearnerSchema.superRefine((data, ctx) => {
  if (data.password && !data.guardianEmail) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianEmail"], message: "Guardian email is required to set a password" });
  }
  if (data.learnerPassword && !data.username) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["username"], message: "Username is required to set a learner-portal password" });
  }
});

const updateLearnerSchema = baseLearnerSchema.partial();

// One row of a bulk import sheet - same identity fields as baseLearnerSchema, minus the
// per-learner password fields (a bulk import shares one `defaultPassword` across every row
// instead, see bulkImportLearnersSchema below) and minus currentRungId/photo (never sensible to
// set from a spreadsheet).
const bulkImportRowSchema = z.object({
  firstName:     z.string().min(1, "First name is required"),
  lastName:      z.string().min(1, "Last name is required"),
  gender:        z.enum(["male", "female", "other"]),
  guardianName:  z.string().min(1, "Guardian name is required"),
  guardianPhone: z.string().min(1, "Guardian phone is required"),
  guardianEmail: z.string().email("Invalid guardian email").optional().or(z.literal("")),
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "Only letters, numbers, dots, underscores, and hyphens are allowed")
    .optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  nationality: z.string().optional().or(z.literal("")),
  languages:   z.string().optional().or(z.literal("")),
});

// hubId enrolls every successfully-created row the same one-shot way createLearner's own hubId
// param does - see learner.controller.js's bulkImportLearners. classId is REQUIRED (unlike
// createLearner's own optional classId) - a bulk import only ever happens from within one
// specific hub, and picking the class up front (rather than falling back to "first active
// class at this hub", the single-learner default) is what keeps a school from accidentally
// dropping an entire spreadsheet of learners into the wrong class. defaultPassword, when
// present, is applied to EVERY row that has a guardianEmail (guardian login) and/or a username
// (learner's own login) - far more practical for a whole-class import than one password per row.
// `learners` is deliberately NOT z.array(bulkImportRowSchema) here - validating every row through
// one array schema means a single malformed row throws before the request handler even starts,
// aborting the whole batch instead of the one bad row. The envelope only checks each entry is an
// object (catches "learners" being the wrong shape entirely); learner.controller.js's
// bulkImportLearners re-parses each row individually against bulkImportRowSchema inside its
// per-row try/catch, so one bad row becomes one per-row failure, not a 400 for everyone else.
const bulkImportLearnersSchema = z.object({
  hubId:   z.string().optional().or(z.literal("")),
  classId: z.string().min(1, "A class is required for bulk import"),
  defaultPassword: z.string().min(8, "Password must be at least 8 characters").or(z.literal("")).default(""),
  learners: z.array(z.record(z.string(), z.unknown()))
    .min(1, "At least one learner row is required")
    .max(500, "Import is limited to 500 learners at a time"),
});

// Enrolling a learner into a hub, or changing an existing enrollment's class/status. `hubId`
// is required to create a new enrollment (matches the POST /:id/hubs/links body); omit it
// when only updating an existing link (PUT /:id/hubs/links/:hubId), since the hub itself
// can't change on an existing enrollment - unlink + re-enroll instead.
const enrollLearnerSchema = z.object({
  hubId:   z.string().min(1, "Learning hub is required"),
  classId: z.string().default(""),
  status:  z.enum(["active", "inactive", "transferred", "graduated"]).default("active"),
});

const updateEnrollmentSchema = z.object({
  classId: z.string().optional(),
  status:  z.enum(["active", "inactive", "transferred", "graduated"]).optional(),
  // Which Developmental Stage (Progress Arc age category) and curriculum-wide Performance Band
  // this learner is placed at, WITHIN THIS HUB - live here rather than on the learner record
  // because a learner enrolled at several hubs can be running a different curriculum (and so a
  // different set of stages/bands) at each one. Set automatically from age once this
  // enrollment resolves a class (see learner.service.js's maybeAutoIssueDiagnostic) or once a
  // standalone diagnostic issued for this hub is graded (see
  // CompetencyService.placeLearnerFromDiagnostic), or manually by a teacher/admin here.
  currentStageId: z.string().optional().nullable(),
  currentBandId:  z.string().optional().nullable(),
});

// Moves a learner from the hub in the URL (:hubId) to toHubId in one action - see
// learner.service.js#transferHub. classId is optional, same as enrollLearnerSchema, and
// auto-assigns to the destination hub's first active class when omitted.
const transferHubSchema = z.object({
  toHubId:   z.string().min(1, "Destination hub is required"),
  toClassId: z.string().default(""),
});

module.exports = { createLearnerSchema, updateLearnerSchema, enrollLearnerSchema, updateEnrollmentSchema, transferHubSchema, bulkImportLearnersSchema, bulkImportRowSchema };
