const { z } = require("zod");

const SALE_STATUSES = ["internal", "for_sale"];
const FORMATS = ["holiday", "weekend", "after_school", "online"];
const DESCRIPTION_MAX_WORDS = 150;

function wordCount(text) {
  const trimmed = (text || "").trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// One priced module within a course — see coursePriceSchema's own comment for why a course is
// priced as a whole OR by its modules, never both.
const modulePriceSchema = z.object({
  moduleId:      z.string().min(1),
  priceAmount:   z.coerce.number().int().min(0).max(10000000).optional().nullable(),
  priceCurrency: z.string().trim().max(8).optional().default("KES"),
});

// One priced course from the selected curriculum's pathways. `courseId` is checked against the
// curriculum in bootcamp.service.js (a Zod string here can't confirm it actually belongs there).
//
// `modulePricing` is the per-course "price by module instead" addition: a course with more than
// one module (see course_modules table) can be broken into individually-priced modules rather
// than one course-wide price — e.g. a parent who only wants Module 1 of a 3-module course. It's
// nested inside coursePricing (not a separate top-level pricing mode) because it's a per-course
// choice, not a whole-bootcamp one — most courses still just get one price. `priceAmount` and
// `modulePricing` are mutually exclusive on the SAME course entry (see
// assertCourseEntryPricingValid in bootcamp.service.js), same either/or posture as the
// whole-bootcamp-vs-by-course choice one level up.
const coursePriceSchema = z.object({
  courseId:      z.string().min(1),
  priceAmount:   z.coerce.number().int().min(0).max(10000000).optional().nullable(),
  priceCurrency: z.string().trim().max(8).optional().default("KES"),
  modulePricing: z.array(modulePriceSchema).max(100).optional().default([]),
});

// Dates are plain "YYYY-MM-DD" strings, same convention as competitions.
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").or(z.literal(""));

const bootcampFields = z.object({
  name:          z.string().trim().min(1, "Bootcamp name is required").max(150),
  description:   z.string().trim().max(3000).optional().default(""),
  tagline:       z.string().trim().max(200).optional().default(""),
  // A stored "/uploads/x.png" path or an absolute URL — same shape as course.coverImage.
  coverImage:    z.string().max(500).optional().nullable(),
  // curriculumId is never client-forced into the general payload beyond an id string — the
  // controller checks it belongs to the same admin (same posture as competition.curriculumId).
  curriculumId:  z.string().max(36).optional().nullable(),
  // This run's own window — required before it can be run at a hub (see
  // bootcamp-hub.service.js's createOffering), but left optional/blank here so a
  // not-yet-scheduled bootcamp can still exist as a plain marketing listing.
  startDate:             dateStr.optional().default(""),
  endDate:               dateStr.optional().default(""),
  registrationOpenDate:  dateStr.optional().default(""),
  registrationCloseDate: dateStr.optional().default(""),
  saleStatus:    z.enum(SALE_STATUSES).optional().default("internal"),
  format:        z.enum(FORMATS).optional().nullable(),
  durationLabel: z.string().trim().max(60).optional().default(""),
  ageMin:        z.coerce.number().int().min(0).max(25).optional().nullable(),
  ageMax:        z.coerce.number().int().min(0).max(25).optional().nullable(),
  // Whole currency units, no fractional pricing. Coerced so the portal's number input
  // (which yields a string) is accepted.
  priceAmount:   z.coerce.number().int().min(0).max(10000000).optional().nullable(),
  priceCurrency: z.string().trim().max(8).optional().default("KES"),
  // Applies regardless of which pricing mode is active (whole-bootcamp price or per-course) —
  // see bootcamp.service.js's assertPricingModeExclusive for why those two are mutually
  // exclusive, and CreateBootcampPage.jsx for why notes are the one field shared across both.
  priceNotes:    z.array(z.string().trim().min(1).max(200)).max(20).optional().default([]),
  highlights:    z.array(z.string().trim().min(1).max(200)).max(20).optional().default([]),
  // Per-course prices for this bootcamp's curriculum — set from the curriculum's pathways.
  // Empty/no curriculum means no course pricing, same optional posture as highlights.
  coursePricing: z.array(coursePriceSchema).max(200).optional().default([]),
  // The public anonymous diagnostic (see public-bootcamp-diagnostic.service.js) — same fields as
  // a pathway's own diagnosticAssessmentId/publicDiagnosticEnabled (competency.validation.js),
  // reusing this bootcamp's OWN ageMin/ageMax above rather than a second age range. Whether
  // publicDiagnosticEnabled can actually be true (assessment must exist and be fully
  // auto-gradable) is checked in bootcamp.service.js's assertPublicDiagnosticAllowed, not here —
  // same split as the pathway version.
  diagnosticAssessmentId: z.string().max(36).optional().nullable(),
  publicDiagnosticEnabled: z.coerce.boolean().optional().default(false),
});

// Every check below only fires when both sides of the comparison are actually present — a
// partial update patch (or a bootcamp that hasn't set its dates yet) must not be blocked by a
// rule about a field it doesn't currently carry.
function applyBootcampRefinements(data, ctx) {
  if (data.ageMin != null && data.ageMax != null && data.ageMax < data.ageMin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ageMax"],
      message: "Maximum age must be greater than or equal to minimum age",
    });
  }
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must be on or after the start date" });
  }
  // Deliberately no check that registrationCloseDate <= startDate — rolling/late registration
  // after kickoff is legitimate.
  if (data.registrationOpenDate && data.registrationCloseDate && data.registrationCloseDate < data.registrationOpenDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["registrationCloseDate"],
      message: "Registration close date must be on or after the open date",
    });
  }
  // Word count, not character count — the 3000-char cap on `description` above already stops a
  // truly unbounded wall of text; this keeps the marketing copy itself skimmable on the public
  // bootcamp page (see BootcampDetailPage.jsx's "About this bootcamp" section).
  if (data.description !== undefined && wordCount(data.description) > DESCRIPTION_MAX_WORDS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["description"],
      message: `Keep the description to ${DESCRIPTION_MAX_WORDS} words or fewer`,
    });
  }
  // Each priced course is priced as a whole OR by its modules, never both — mirrors
  // assertPricingModeExclusive one level up (whole bootcamp vs by-course).
  (data.coursePricing || []).forEach((entry, i) => {
    if (entry.priceAmount != null && (entry.modulePricing || []).length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["coursePricing", i, "priceAmount"],
        message: "Price the whole course or its modules, not both — clear one before setting the other",
      });
    }
  });
}

const createBootcampSchema = bootcampFields.superRefine(applyBootcampRefinements);
const updateBootcampSchema = bootcampFields.partial().superRefine(applyBootcampRefinements);

module.exports = {
  createBootcampSchema,
  updateBootcampSchema,
  BOOTCAMP_SALE_STATUSES: SALE_STATUSES,
  BOOTCAMP_FORMATS: FORMATS,
  BOOTCAMP_DESCRIPTION_MAX_WORDS: DESCRIPTION_MAX_WORDS,
};
