const { z } = require("zod");

const createGroupSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  name: z.string().min(1, "Group name is required").max(150),
});

const renameGroupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(150),
});

const addMemberSchema = z.object({
  learnerId: z.string().min(1, "Learner is required"),
});

module.exports = { createGroupSchema, renameGroupSchema, addMemberSchema };
