const { z } = require("zod");

const createClassSchema = z.object({
  schoolId:        z.string().min(1, "School is required"),
  curriculumId:    z.string().min(1, "Curriculum is required"),
  gradeId:         z.string().min(1, "Grade is required"),
  gradeName:       z.string().min(1, "Grade name is required"),
  classTeacherId:  z.string().or(z.literal("")).nullable().default(null),
  academicYear:    z.string().min(1, "Academic year is required"),
  capacity:        z.number().int().positive().nullable().optional().default(null),
  status:          z.enum(["active", "inactive"]).default("active"),
});

const updateClassSchema = createClassSchema.partial();

module.exports = { createClassSchema, updateClassSchema };
