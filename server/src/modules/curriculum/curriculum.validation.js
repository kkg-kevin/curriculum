const { z } = require("zod");

const periodSchema = z
  .object({
    name: z.string().min(1, "Period name is required"),
    startDate: z.string().default(""),
    endDate: z.string().default(""),
    breakStartDate: z.string().default(""),
    breakEndDate: z.string().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate <= data.startDate) {
      ctx.addIssue({ code: "custom", message: "End date must be after start date", path: ["endDate"] });
    }

    const hasBreakStart = !!data.breakStartDate;
    const hasBreakEnd   = !!data.breakEndDate;

    if (hasBreakStart && !hasBreakEnd) {
      ctx.addIssue({ code: "custom", message: "Break end date is required", path: ["breakEndDate"] });
    }
    if (!hasBreakStart && hasBreakEnd) {
      ctx.addIssue({ code: "custom", message: "Break start date is required", path: ["breakStartDate"] });
    }
    if (hasBreakStart && hasBreakEnd) {
      if (data.breakEndDate <= data.breakStartDate) {
        ctx.addIssue({ code: "custom", message: "Break end must be after break start", path: ["breakEndDate"] });
      }
      if (data.startDate && data.breakStartDate < data.startDate) {
        ctx.addIssue({ code: "custom", message: "Break must start within the period", path: ["breakStartDate"] });
      }
      if (data.endDate && data.breakEndDate > data.endDate) {
        ctx.addIssue({ code: "custom", message: "Break must end before period ends", path: ["breakEndDate"] });
      }
    }
  });

// Sellable-Bootcamp fields. Only meaningful when `isProgram === true` and `saleStatus ===
// "for_sale"` — curriculum.service.js's assertSellableBootcamp enforces that pairing; the
// schema just validates shapes/ranges so a bad payload never reaches the DB. Everything is
// optional with an internal-only default, so an existing curriculum payload that never sends
// any of these validates exactly as before. Mirrors assessment.validation.js's saleFields.
const SALE_STATUSES = ["internal", "for_sale"];
const SALE_FORMATS = ["holiday", "weekend", "after_school", "online"];

const saleFields = {
  saleStatus:    z.enum(SALE_STATUSES).optional().default("internal"),
  // A stored "/uploads/x.png" path or an absolute URL — same shape as course.coverImage.
  coverImage:    z.string().max(500).optional().nullable(),
  // Whole currency units, no fractional pricing. Coerced so the portal's number input
  // (which yields a string) is accepted.
  priceAmount:   z.coerce.number().int().min(0).max(10000000).optional().nullable(),
  priceCurrency: z.string().trim().max(8).optional().default("KES"),
  priceNote:     z.string().trim().max(300).optional().default(""),
  saleTagline:   z.string().trim().max(200).optional().default(""),
  saleFormat:    z.enum(SALE_FORMATS).optional().nullable(),
  durationLabel: z.string().trim().max(60).optional().default(""),
  ageMin:        z.coerce.number().int().min(0).max(25).optional().nullable(),
  ageMax:        z.coerce.number().int().min(0).max(25).optional().nullable(),
  highlights:    z.array(z.string().trim().min(1).max(200)).max(20).optional().default([]),
};

const saleAgeRefinement = (d) => d.ageMin == null || d.ageMax == null || d.ageMax >= d.ageMin;
const saleAgeRefinementOptions = {
  message: "Maximum age must be greater than or equal to minimum age",
  path: ["ageMax"],
};

const classSchema = z.object({
  id:   z.string().min(1),
  // The curriculum's own name for this grade (e.g. "Grade 4") — what this session's earlier
  // "level" free-text field was meant to be standardized alongside, now done properly below.
  name: z.string().min(1, "Class name is required"),
  // Which of the 14 fixed System Levels (settings/system-levels) this grade maps onto — the
  // real cross-curriculum anchor. "Grade 4" here and "Year 5" in a different curriculum can
  // both point at the same systemLevelId and be recognized as the same developmental position.
  systemLevelId: z.string().nullable().optional().default(null),
  // Compact form of `name` for cards/tables (e.g. "G4").
  shortLabel: z.string().trim().optional().default(""),
  // Which of THIS curriculum's own Developmental Stages (Progress Arc / AgeCategoryModel) this
  // grade falls under — the "Phase" column. Curriculum-scoped, not global, since Developmental
  // Stages are themselves authored per curriculum.
  developmentalStageId: z.string().nullable().optional().default(null),
});

const createCurriculumSchema = z.object({
  name: z.string().min(1, "Curriculum name is required").max(100, "Max 100 characters"),
  code: z
    .string()
    .min(1, "Curriculum code is required")
    .max(20, "Max 20 characters")
    .regex(/^[A-Z0-9-]+$/i, "Only letters, numbers, and hyphens"),
  academicYear: z.string().optional().default(""),
  description: z.string().max(500).default(""),
  status: z.enum(["draft", "active"]).default("draft"),
  educationLevel: z.string().optional().default(""),
  gradeFrom: z.string().optional().default(""),
  gradeTo: z.string().optional().default(""),
  framework: z.string().optional().default(""),
  curriculumType: z.string().optional().default(""),
  // Separate from curriculumType (Core/Complementary/Substitutional — a school's curriculum-
  // stack classification). This instead marks a short-run cohort curriculum (a bootcamp) that
  // gets listed under Programs instead of the main Curriculum list — see program.service.js.
  isProgram: z.boolean().optional().default(false),
  academicCycleModel: z.string().optional().default("terms"),
  periods: z.array(periodSchema).optional().default([]),
  classes: z.array(classSchema).optional().default([]),
  ...saleFields,
}).superRefine((data, ctx) => {
  if (!saleAgeRefinement(data)) ctx.addIssue({ code: z.ZodIssueCode.custom, ...saleAgeRefinementOptions });
});

// curriculumAdminId (the one account delegated to author this curriculum — mirrors
// class.classTeacherId, a single outward-pointing field rather than a separate link table,
// since there's only ever one at a time) is deliberately absent from both schemas below. It's
// only ever written by the dedicated assign/unassign handlers in curriculum.controller.js, never
// through general create/update — so even a curriculumAdmin PUTting their own curriculum's
// basic info can't reassign or clear it, without needing an extra field-stripping guard.
const updateCurriculumSchema = z.object({
  name: z.string().min(1, "Curriculum name is required").max(100, "Max 100 characters").optional(),
  code: z
    .string()
    .min(1, "Curriculum code is required")
    .max(20, "Max 20 characters")
    .regex(/^[A-Z0-9-]+$/i, "Only letters, numbers, and hyphens")
    .optional(),
  academicYear: z.string().optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["draft", "active"]).optional(),
  educationLevel: z.string().optional(),
  gradeFrom: z.string().optional(),
  gradeTo: z.string().optional(),
  framework: z.string().optional(),
  curriculumType: z.string().optional(),
  isProgram: z.boolean().optional(),
  academicCycleModel: z.string().optional(),
  periods: z.array(periodSchema).optional(),
  classes: z.array(classSchema).optional(),
  // Sale fields — same shapes as create, but nothing is defaulted on update so a partial
  // PUT that never mentions them leaves the stored columns untouched.
  saleStatus:    z.enum(SALE_STATUSES).optional(),
  coverImage:    z.string().max(500).optional().nullable(),
  priceAmount:   z.coerce.number().int().min(0).max(10000000).optional().nullable(),
  priceCurrency: z.string().trim().max(8).optional(),
  priceNote:     z.string().trim().max(300).optional(),
  saleTagline:   z.string().trim().max(200).optional(),
  saleFormat:    z.enum(SALE_FORMATS).optional().nullable(),
  durationLabel: z.string().trim().max(60).optional(),
  ageMin:        z.coerce.number().int().min(0).max(25).optional().nullable(),
  ageMax:        z.coerce.number().int().min(0).max(25).optional().nullable(),
  highlights:    z.array(z.string().trim().min(1).max(200)).max(20).optional(),
}).superRefine((data, ctx) => {
  if (data.ageMin != null && data.ageMax != null && data.ageMax < data.ageMin) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, ...saleAgeRefinementOptions });
  }
});

const linkCourseSchema = z.object({
  courseId: z.string().min(1, "courseId is required"),
});

// Assigning a curriculum admin always sets up their login too — a curriculumAdminId with no
// working login would be useless, unlike Teacher/Learner which can exist before one is added.
const assignAdminSchema = z.object({
  name:     z.string().min(1, "Name is required").max(150),
  email:    z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

module.exports = {
  createCurriculumSchema,
  updateCurriculumSchema,
  periodSchema,
  linkCourseSchema,
  assignAdminSchema,
  SALE_STATUSES,
  SALE_FORMATS,
};
