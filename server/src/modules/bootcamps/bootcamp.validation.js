const { z } = require("zod");

const SALE_STATUSES = ["internal", "for_sale"];
const FORMATS = ["holiday", "weekend", "after_school", "online"];

// One priced course from the selected curriculum's pathways. `courseId` is checked against the
// curriculum in bootcamp.service.js (a Zod string here can't confirm it actually belongs there).
const coursePriceSchema = z.object({
  courseId:      z.string().min(1),
  priceAmount:   z.coerce.number().int().min(0).max(10000000).optional().nullable(),
  priceCurrency: z.string().trim().max(8).optional().default("KES"),
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
  priceNote:     z.string().trim().max(300).optional().default(""),
  highlights:    z.array(z.string().trim().min(1).max(200)).max(20).optional().default([]),
  // Per-course prices for this bootcamp's curriculum — set from the curriculum's pathways.
  // Empty/no curriculum means no course pricing, same optional posture as highlights.
  coursePricing: z.array(coursePriceSchema).max(200).optional().default([]),
});

// Every check below only fires when both sides of the comparison are actually present — a
// partial update patch (or a bootcamp that hasn't set its dates yet) must not be blocked by a
// rule about a field it doesn't currently carry.
function applyDateRefinements(data, ctx) {
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
}

const createBootcampSchema = bootcampFields.superRefine(applyDateRefinements);
const updateBootcampSchema = bootcampFields.partial().superRefine(applyDateRefinements);

module.exports = {
  createBootcampSchema,
  updateBootcampSchema,
  BOOTCAMP_SALE_STATUSES: SALE_STATUSES,
  BOOTCAMP_FORMATS: FORMATS,
};
