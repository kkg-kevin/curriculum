const { z } = require("zod");

// competitionId comes from the route param, ownerAdminId from the session — neither is part of
// the client payload.
const createOfferingSchema = z.object({
  hubId: z.string().min(1, "Learning hub is required"),
});

module.exports = { createOfferingSchema };
