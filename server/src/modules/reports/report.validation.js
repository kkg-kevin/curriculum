const { z } = require("zod");

const generateReportSchema = z.object({
  learnerId: z.string().min(1),
  courseId:  z.string().min(1),
  classId:   z.string().min(1),
  // A module's combined report (19 Nov 2026) instead of the course's final one.
  moduleId:  z.string().min(1).nullable().optional(),
});

// Either or both: the teacher's remarks and the optional "How to help at home" note.
const updateRemarksSchema = z.object({
  remarks: z.string().max(5000).optional(),
  homeNote: z.string().max(2000).optional(),
});

// "File as not handed in" for one learner — a course's sessions, or one module's (19 Nov 2026).
const fileNotSubmittedSchema = z.object({
  learnerId: z.string().min(1),
  courseId:  z.string().min(1),
  classId:   z.string().min(1),
  moduleId:  z.string().min(1).nullable().optional(),
});

// A whole class at once (19 Nov 2026): draft every ready learner's report, or publish every draft —
// a course's final reports, or one module's.
const bulkReportsSchema = z.object({
  action:   z.enum(["generate", "publish", "issue"]),
  courseId: z.string().min(1),
  classId:  z.string().min(1),
  moduleId: z.string().min(1).nullable().optional(),
});

module.exports = {
  bulkReportsSchema,
  fileNotSubmittedSchema,
  generateReportSchema,
  updateRemarksSchema,
};
