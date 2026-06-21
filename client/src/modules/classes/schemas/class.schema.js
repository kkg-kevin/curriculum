import { z } from "zod";

export const createClassSchema = z.object({
  schoolId:       z.string().min(1, "School is required"),
  curriculumId:   z.string().min(1, "Curriculum is required"),
  gradeId:        z.string().min(1, "Grade is required"),
  gradeName:      z.string().min(1),
  classTeacherId: z.string().nullable().optional(),
  academicYear:   z.string().min(1, "Academic year is required"),
  capacity:       z.coerce.number().int().positive().nullable().optional(),
  status:         z.enum(["active", "inactive"]).default("active"),
});

export const updateClassSchema = createClassSchema.partial();
