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

const classSchema = z.object({
  id:    z.string().min(1),
  name:  z.string().min(1, "Class name is required"),
  // A standardized tag (e.g. "Level 1") independent of whatever this curriculum calls the
  // grade, so grades can be compared/tracked across curricula that name them differently.
  level: z.string().trim().optional().default(""),
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

module.exports = { createCurriculumSchema, updateCurriculumSchema, periodSchema, linkCourseSchema, assignAdminSchema };
