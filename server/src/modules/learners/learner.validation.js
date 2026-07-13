const { z } = require("zod");

const createLearnerSchema = z.object({
  firstName:     z.string().min(1, "First name is required"),
  lastName:      z.string().min(1, "Last name is required"),
  gender:        z.enum(["male", "female", "other"]),
  schoolId:      z.string().min(1, "School is required"),
  classId:       z.string().min(1, "Class is required"),
  guardianName:  z.string().min(1, "Guardian name is required"),
  guardianPhone: z.string().min(1, "Guardian phone is required"),
  guardianEmail: z.string().email("Invalid guardian email").optional().or(z.literal("")),
  status:        z.enum(["active", "inactive", "transferred", "graduated"]).default("active"),
  // Which Progression Ladder rung (Learning Journey) this learner is currently placed at —
  // set manually by a teacher/admin, optionally informed by a diagnostic assessment result.
  currentRungId: z.string().optional().nullable().default(null),
});

const updateLearnerSchema = createLearnerSchema.partial();

module.exports = { createLearnerSchema, updateLearnerSchema };
