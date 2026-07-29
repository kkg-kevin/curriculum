const { z } = require("zod");

const createClassSchema = z.object({
  schoolId:        z.string().min(1, "School is required"),
  curriculumId:    z.string().min(1, "Curriculum is required"),
  gradeId:         z.string().min(1, "Grade is required"),
  gradeName:       z.string().min(1, "Grade name is required"),
  academicYear:    z.string().min(1, "Academic year is required"),
  capacity:        z.number().int().positive().nullable().optional().default(null),
  status:          z.enum(["active", "inactive"]).default("active"),
  // A short code unique to this one class instance (e.g. "HUB-A-G1"), distinct from gradeName —
  // two hubs both running "Grade 1" off the same curriculum are the same gradeId but need their
  // own tag to be told apart in reports/attendance. Optional at creation since bulk flows
  // (Set Up Year, Program deployment) create several classes at once with no per-class input;
  // set later from the class's own edit page.
  tag:             z.string().trim().min(1, "Tag cannot be empty").nullable().optional().default(null),
});

const updateClassSchema = createClassSchema.partial();

module.exports = { createClassSchema, updateClassSchema };
