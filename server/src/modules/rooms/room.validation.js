const { z } = require("zod");

const createRoomSchema = z.object({
  hubId:     z.string().min(1, "Learning hub is required"),
  name:      z.string().trim().min(1, "Room name is required").max(100),
  capacity:  z.number().int().positive().nullable().optional().default(null),
  notes:     z.string().max(500).optional().default(""),
  status:    z.enum(["active", "inactive"]).default("active"),
});

const updateRoomSchema = createRoomSchema.partial();

module.exports = { createRoomSchema, updateRoomSchema };
