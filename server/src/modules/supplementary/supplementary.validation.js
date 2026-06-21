const { z } = require("zod");

const createSupplementarySchema = z.object({
  name:             z.string().min(1, "Name is required").max(100),
  code:             z.string().min(1, "Code is required").max(20).regex(/^[A-Z0-9-]+$/i, "Only letters, numbers, hyphens"),
  description:      z.string().max(500).default(""),
  type:             z.enum(["complementary", "substitutional"], { required_error: "Type is required" }),
  schoolId:         z.string().min(1, "School is required"),
  schoolName:       z.string().min(1),
  baseCurriculumId: z.string().min(1, "Base curriculum is required"),
  termIndex:        z.number().int().min(0),
  termName:         z.string().min(1),
});

const updateSupplementarySchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  code:        z.string().min(1).max(20).regex(/^[A-Z0-9-]+$/i).optional(),
  description: z.string().max(500).optional(),
});

const updateGradesSchema = z.object({
  grades: z.array(
    z.object({
      gradeId:   z.string(),
      gradeName: z.string(),
      courses:   z.array(z.object({ id: z.string(), name: z.string() })),
    })
  ),
});

const updateMappingSchema = z.object({
  mapping: z.object({
    affectedPeriods: z.array(z.object({
      basePeriodIndex: z.number().int().min(0),
      basePeriodName:  z.string(),
    })).optional(),
    replacements: z.array(z.object({
      level:           z.enum(["period", "grade", "course"]),
      basePeriodIndex: z.number().int().min(0),
      basePeriodName:  z.string(),
      baseGradeId:     z.string().optional(),
      baseGradeName:   z.string().optional(),
      baseCourseId:    z.string().optional(),
      baseCourseName:  z.string().optional(),
    })).optional(),
  }),
});

const updateAssignmentsSchema = z.object({
  assignments: z.array(z.object({
    schoolId:   z.string().min(1),
    schoolName: z.string().min(1),
  })),
});

module.exports = {
  createSupplementarySchema,
  updateSupplementarySchema,
  updateGradesSchema,
  updateMappingSchema,
  updateAssignmentsSchema,
};
