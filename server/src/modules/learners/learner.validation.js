const { z } = require("zod");

// A learner is an independent identity — name, gender, guardian contact — with no school or
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
  // Optional identity fields — deliberately no .default() (see updateLearner's partial-PUT
  // filter in the controller, which relies on absent keys staying undefined, not defaulted).
  dateOfBirth:   z.string().optional().or(z.literal("")),
  nationality:   z.string().optional().or(z.literal("")),
  languages:     z.string().optional().or(z.literal("")),
  // Lets the learner log into the same guardian-owned account by username instead of typing
  // the guardian's email — see auth.service.js's login. Uniqueness is enforced in
  // learner.service.js (own table, so it can't just reuse AuthService's email-uniqueness check).
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "Only letters, numbers, dots, underscores, and hyphens are allowed")
    .optional().or(z.literal("")),
  // Transient — never persisted onto the learner record. When present, creates or resets the
  // guardian's learner-portal login for guardianEmail (see auth.service.js's
  // setOrCreatePassword), then gets stripped before the learner record is saved.
  password:      z.string().min(8, "Password must be at least 8 characters").or(z.literal("")).default(""),
  // Which Progression Ladder rung this learner is currently placed at — superseded by
  // Learning Journey (see currentStageId + learner-journey.model.js) but left as-is since
  // the old ladder UI/data still exists; not read by anything new.
  currentRungId: z.string().optional().nullable().default(null),
  // Profile photo — set via the shared upload pipeline (see uploads module); a bare URL string,
  // not managed as a file upload itself.
  photo: z.string().optional().nullable().default(null),
});

const createLearnerSchema = baseLearnerSchema.superRefine((data, ctx) => {
  if (data.password && !data.guardianEmail) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianEmail"], message: "Guardian email is required to set a password" });
  }
});

const updateLearnerSchema = baseLearnerSchema.partial();

// Enrolling a learner into a hub, or changing an existing enrollment's class/status. `hubId`
// is required to create a new enrollment (matches the POST /:id/hubs/links body); omit it
// when only updating an existing link (PUT /:id/hubs/links/:hubId), since the hub itself
// can't change on an existing enrollment — unlink + re-enroll instead.
const enrollLearnerSchema = z.object({
  hubId:   z.string().min(1, "Learning hub is required"),
  classId: z.string().default(""),
  status:  z.enum(["active", "inactive", "transferred", "graduated"]).default("active"),
});

const updateEnrollmentSchema = z.object({
  classId: z.string().optional(),
  status:  z.enum(["active", "inactive", "transferred", "graduated"]).optional(),
  // Which Developmental Stage (Progress Arc age category) and curriculum-wide Performance Band
  // this learner is placed at, WITHIN THIS HUB — live here rather than on the learner record
  // because a learner enrolled at several hubs can be running a different curriculum (and so a
  // different set of stages/bands) at each one. Set automatically from age once this
  // enrollment resolves a class (see learner.service.js's maybeAutoIssueDiagnostic) or once a
  // standalone diagnostic issued for this hub is graded (see
  // CompetencyService.placeLearnerFromDiagnostic), or manually by a teacher/admin here.
  currentStageId: z.string().optional().nullable(),
  currentBandId:  z.string().optional().nullable(),
});

module.exports = { createLearnerSchema, updateLearnerSchema, enrollLearnerSchema, updateEnrollmentSchema };
