import { z } from "zod";

export const BOOTCAMP_SALE_STATUSES = [
  { value: "internal",  label: "Internal only" },
  { value: "for_sale",  label: "For sale" },
];
export const BOOTCAMP_FORMATS = [
  { value: "holiday",      label: "Holiday" },
  { value: "weekend",      label: "Weekend" },
  { value: "after_school", label: "After school" },
  { value: "online",       label: "Online" },
];

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").or(z.literal(""));

// Mirrors server/src/modules/bootcamps/bootcamp.validation.js's BOOTCAMP_DESCRIPTION_MAX_WORDS —
// word count (not the 3000-char cap below), so the public bootcamp page's "About this bootcamp"
// copy stays skimmable. Exported so CreateBootcampPage.jsx's live word counter uses the same
// number instead of a second hardcoded 150.
export const BOOTCAMP_DESCRIPTION_MAX_WORDS = 150;

// `text` is rich text (TipTap HTML) — strip tags first so markup itself never counts as words.
export function wordCount(text) {
  const trimmed = (text || "").replace(/<[^>]*>/g, " ").trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

const modulePriceSchema = z.object({
  moduleId:      z.string().min(1),
  priceAmount:   z.coerce.number().int().min(0).max(10000000).nullable().default(null),
  priceCurrency: z.string().trim().max(8).default("KES"),
});

// One pathway's own diagnostic. Mirrors server bootcamp.validation.js's pathwayDiagnosticSchema.
const pathwayDiagnosticSchema = z.object({
  pathwayId:    z.string().min(1),
  assessmentId: z.string().min(1),
});

// `modulePricing` is the per-course "price by module instead" addition — a course with more than
// one module can be broken into individually-priced modules rather than one course-wide price.
// Mutually exclusive with this same entry's own `priceAmount` (see the schema-level superRefine
// below), mirroring the whole-bootcamp-vs-by-course either/or one level up.
const coursePriceSchema = z.object({
  courseId:      z.string().min(1),
  priceAmount:   z.coerce.number().int().min(0).max(10000000).nullable().default(null),
  priceCurrency: z.string().trim().max(8).default("KES"),
  modulePricing: z.array(modulePriceSchema).max(100).default([]),
});

export const bootcampSchema = z
  .object({
    name:          z.string().trim().min(1, "Bootcamp name is required").max(150, "Max 150 characters"),
    // Rich text (TipTap HTML) — capped generously above the old 3000-char plain-text limit
    // (the 150-word limit above is the real content-length guard; see wordCount above).
    description:   z.string().trim().max(15000).default(""),
    tagline:       z.string().trim().max(200).default(""),
    coverImage:    z.string().nullable().default(null),
    curriculumId:  z.string().nullable().default(null),
    // Which of curriculumId's pathways this bootcamp actually runs — not every pathway under a
    // curriculum is relevant to a given bootcamp. Empty means "every pathway", same as before
    // this field existed — see server bootcamp.validation.js's matching comment.
    pathwayIds:    z.array(z.string()).default([]),
    startDate:             dateStr.default(""),
    endDate:               dateStr.default(""),
    registrationOpenDate:  dateStr.default(""),
    registrationCloseDate: dateStr.default(""),
    saleStatus:    z.enum(["internal", "for_sale"]).default("internal"),
    format:        z.enum(["holiday", "weekend", "after_school", "online"]).nullable().default(null),
    durationLabel: z.string().trim().max(60).default(""),
    ageMin:        z.coerce.number().int().min(0).max(25).nullable().default(null),
    ageMax:        z.coerce.number().int().min(0).max(25).nullable().default(null),
    priceAmount:   z.coerce.number().int().min(0).max(10000000).nullable().default(null),
    priceCurrency: z.string().trim().max(8).default("KES"),
    // Applies regardless of which pricing mode is active — see CreateBootcampPage.jsx.
    priceNotes:    z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    highlights:    z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    coursePricing: z.array(coursePriceSchema).max(200).default([]),
    // A diagnostic per pathway included in this bootcamp — see pathwayIds above. Whether each one
    // can actually be offered (assessment must exist and be fully auto-gradable) is enforced
    // server-side (bootcamp.service.js's assertPathwayDiagnosticsValid), not here.
    pathwayDiagnostics: z.array(pathwayDiagnosticSchema).max(50).default([]),
  })
  .superRefine((d, ctx) => {
    if (d.ageMin != null && d.ageMax != null && d.ageMax < d.ageMin) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ageMax"], message: "Maximum age must be greater than or equal to minimum age" });
    }
    if (d.startDate && d.endDate && d.endDate < d.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must be on or after the start date" });
    }
    if (d.registrationOpenDate && d.registrationCloseDate && d.registrationCloseDate < d.registrationOpenDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["registrationCloseDate"], message: "Registration close date must be on or after the open date" });
    }
    // Price the whole bootcamp OR individual courses, never both — mirrors
    // bootcamp.service.js's assertPricingModeExclusive. Flagged on both fields so the error
    // shows up next to whichever one the admin touches last.
    if (d.priceAmount != null && (d.coursePricing || []).length > 0) {
      const message = "Price the whole bootcamp or individual courses, not both — clear one before setting the other";
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["priceAmount"], message });
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["coursePricing"], message });
    }
    if (wordCount(d.description) > BOOTCAMP_DESCRIPTION_MAX_WORDS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["description"],
        message: `Keep the description to ${BOOTCAMP_DESCRIPTION_MAX_WORDS} words or fewer`,
      });
    }
    // Each priced course is priced as a whole OR by its modules, never both — mirrors
    // bootcamp.service.js's assertCourseEntryPricingValid.
    (d.coursePricing || []).forEach((entry, i) => {
      if (entry.priceAmount != null && (entry.modulePricing || []).length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["coursePricing", i, "priceAmount"],
          message: "Price the whole course or its modules, not both — clear one before setting the other",
        });
      }
    });
    // At most one diagnostic per pathway — mirrors bootcamp.service.js's
    // assertPathwayDiagnosticsValid duplicate check.
    (d.pathwayDiagnostics || []).forEach((entry, i) => {
      const firstIndex = (d.pathwayDiagnostics || []).findIndex((other) => other.pathwayId === entry.pathwayId);
      if (firstIndex !== i) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pathwayDiagnostics", i, "pathwayId"],
          message: "Each pathway can only have one diagnostic assigned",
        });
      }
    });
  });
