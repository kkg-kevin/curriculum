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
  // Which Progression Ladder rung this learner is currently placed at — superseded by
  // Learning Journey (see currentStageId + learner-journey.model.js) but left as-is since
  // the old ladder UI/data still exists; not read by anything new.
  currentRungId: z.string().optional().nullable().default(null),
  // Which Developmental Stage (Progress Arc age category) this learner is in — set
  // manually by a teacher/admin. Used by Learning Journey to resolve a default starting
  // course per Learning Area when no placement/diagnostic result exists yet.
  currentStageId: z.string().optional().nullable().default(null),
});

const updateLearnerSchema = createLearnerSchema.partial();

module.exports = { createLearnerSchema, updateLearnerSchema };
