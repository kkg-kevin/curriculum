const { z } = require("zod");

// Revoking by hand always says why — the reason is what marks it as a deliberate decision.
const revokeSchema = z.object({
  reason: z.string().trim().min(3, "Say why this certificate is being revoked").max(300),
});

// Always the whole form (a PUT): a field left empty is cleared.
const settingsSchema = z.object({
  signatoryName:  z.string().trim().max(150).nullable().optional(),
  signatoryTitle: z.string().trim().max(150).nullable().optional(),
  signatureImage: z.string().trim().max(500).nullable().optional(),
});

const listSchema = z.object({
  hubId:  z.string().optional(),
  kind:   z.enum(["course", "pathway", "bootcamp"]).optional(),
  status: z.enum(["issued", "revoked"]).optional(),
  q:      z.string().trim().max(100).optional(),
});

module.exports = { revokeSchema, settingsSchema, listSchema };
