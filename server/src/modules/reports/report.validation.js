const { z } = require("zod");

const generateReportSchema = z.object({
  learnerId: z.string().min(1),
  courseId:  z.string().min(1),
  classId:   z.string().min(1),
});

const updateRemarksSchema = z.object({
  remarks: z.string().max(5000).optional().default(""),
});

module.exports = {
  generateReportSchema,
  updateRemarksSchema,
};
