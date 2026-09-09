const asyncHandler = require("express-async-handler");
const PublicProjectService = require("./public-project.service");

// digifunzi-landing's Projects section (/projects, /projects/:slug). Bare array/object
// responses (no { success, data } wrapper) — same convention as public-site.controller.js.
// 404s an unknown id/slug OR a project that isn't for sale / belongs to another admin
// (undifferentiated, so a probing client can't tell which).

const getPublicProjects = asyncHandler(async (req, res) => {
  const records = await PublicProjectService.listProjects();
  res.json(records);
});

const getPublicProject = asyncHandler(async (req, res) => {
  const record = await PublicProjectService.getProject(req.params.idOrSlug);
  if (!record) return res.status(404).json({ message: "Project not found" });
  res.json(record);
});

module.exports = { getPublicProjects, getPublicProject };
