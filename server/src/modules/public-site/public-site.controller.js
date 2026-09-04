const asyncHandler = require("express-async-handler");
const PublicSiteService = require("./public-site.service");

// Read-only projection of the `pathway_templates` catalog (authored in the main portal's
// Settings → Pathways). No admin CRUD here; the frontend just needs to browse them. Bare
// array/object responses, not { success, data } — matches digifunzi-landing's
// src/services/api.js expectations. getPublicPathway 404s an unknown id/slug OR a pathway
// whose every course is inactive/deleted (nothing to show).

const getPublicPathways = asyncHandler(async (req, res) => {
  const records = await PublicSiteService.listPathways();
  res.json(records);
});

const getPublicPathway = asyncHandler(async (req, res) => {
  const record = await PublicSiteService.getPathway(req.params.idOrSlug);
  if (!record) return res.status(404).json({ message: "Pathway not found" });
  res.json(record);
});

module.exports = { getPublicPathways, getPublicPathway };
