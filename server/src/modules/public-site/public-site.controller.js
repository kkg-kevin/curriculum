const asyncHandler = require("express-async-handler");
const PublicSiteService = require("./public-site.service");
const {
  bootcampSchema,
  updateBootcampSchema,
  projectSchema,
  updateProjectSchema,
} = require("./public-site.validation");

// ---- Public reads (spec §4.1/§4.2) -------------------------------------------------------
// Bare array/object responses, not { success, data } — this matches digifunzi-landing's
// src/services/api.js (publicApi.listBootcamps().then(r => r.data)) and its mock adapter's
// shape exactly, so USE_MOCK can flip to false with no frontend change needed.

const getPublicBootcamps = asyncHandler(async (req, res) => {
  const records = await PublicSiteService.listBootcamps({ publishedOnly: true });
  res.json(records);
});

const getPublicBootcamp = asyncHandler(async (req, res) => {
  const record = await PublicSiteService.getBootcamp(req.params.idOrSlug);
  if (!record || !record.isPublished) return res.status(404).json({ message: "Bootcamp not found" });
  res.json(record);
});

const getPublicProjects = asyncHandler(async (req, res) => {
  const records = await PublicSiteService.listProjects({ publishedOnly: true });
  res.json(records);
});

const getPublicProject = asyncHandler(async (req, res) => {
  const record = await PublicSiteService.getProject(req.params.idOrSlug);
  if (!record || !record.isPublished) return res.status(404).json({ message: "Project not found" });
  res.json(record);
});

// Pathways — read-only projection of the `pathway_templates` catalog (authored in the main
// portal's Settings → Pathways). No admin CRUD here; the frontend just needs to browse them.
// getPublicPathway 404s an unknown id/slug OR a pathway whose every course is inactive/deleted
// (nothing to show), matching how getPublicBootcamp 404s an unpublished record.

const getPublicPathways = asyncHandler(async (req, res) => {
  const records = await PublicSiteService.listPathways();
  res.json(records);
});

const getPublicPathway = asyncHandler(async (req, res) => {
  const record = await PublicSiteService.getPathway(req.params.idOrSlug);
  if (!record) return res.status(404).json({ message: "Pathway not found" });
  res.json(record);
});

// ---- Admin CRUD (normal { success, data } convention) ------------------------------------

const createBootcamp = asyncHandler(async (req, res) => {
  const data = bootcampSchema.parse(req.body);
  const record = await PublicSiteService.createBootcamp(data);
  res.status(201).json({ success: true, data: record });
});

const listBootcamps = asyncHandler(async (req, res) => {
  const records = await PublicSiteService.listBootcamps({});
  res.json({ success: true, data: records, count: records.length });
});

const updateBootcamp = asyncHandler(async (req, res) => {
  const data = updateBootcampSchema.parse(req.body);
  const record = await PublicSiteService.updateBootcamp(req.params.id, data);
  res.json({ success: true, data: record });
});

const deleteBootcamp = asyncHandler(async (req, res) => {
  await PublicSiteService.deleteBootcamp(req.params.id);
  res.json({ success: true, message: "Bootcamp deleted" });
});

const createProject = asyncHandler(async (req, res) => {
  const data = projectSchema.parse(req.body);
  const record = await PublicSiteService.createProject(data);
  res.status(201).json({ success: true, data: record });
});

const listProjects = asyncHandler(async (req, res) => {
  const records = await PublicSiteService.listProjects({});
  res.json({ success: true, data: records, count: records.length });
});

const updateProject = asyncHandler(async (req, res) => {
  const data = updateProjectSchema.parse(req.body);
  const record = await PublicSiteService.updateProject(req.params.id, data);
  res.json({ success: true, data: record });
});

const deleteProject = asyncHandler(async (req, res) => {
  await PublicSiteService.deleteProject(req.params.id);
  res.json({ success: true, message: "Project deleted" });
});

module.exports = {
  getPublicBootcamps,
  getPublicBootcamp,
  getPublicProjects,
  getPublicProject,
  getPublicPathways,
  getPublicPathway,
  createBootcamp,
  listBootcamps,
  updateBootcamp,
  deleteBootcamp,
  createProject,
  listProjects,
  updateProject,
  deleteProject,
};
