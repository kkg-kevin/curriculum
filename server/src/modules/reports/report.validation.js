const { z } = require("zod");

const generateReportSchema = z.object({
  learnerId: z.string().min(1),
  courseId:  z.string().min(1),
  classId:   z.string().min(1),
});

// Either or both: the teacher's remarks and the optional "How to help at home" note.
const updateRemarksSchema = z.object({
  remarks: z.string().max(5000).optional(),
  homeNote: z.string().max(2000).optional(),
});

module.exports = {
  generateReportSchema,
  updateRemarksSchema,
};
