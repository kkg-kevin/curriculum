const asyncHandler = require("express-async-handler");
const CurriculumVersionService = require("./curriculum-versions.service");

const getAllVersions = asyncHandler(async (req, res) => {
  const versions = await CurriculumVersionService.getAllVersions(req.params.id);
  res.json({ success: true, data: versions, count: versions.length });
});

const getVersionById = asyncHandler(async (req, res) => {
  const version = await CurriculumVersionService.getVersionById(
    req.params.id,
    req.params.vId
  );
  res.json({ success: true, data: version });
});

const createVersion = asyncHandler(async (req, res) => {
  const { versionLabel, changeNotes } = req.body;
  const version = await CurriculumVersionService.createVersion(req.params.id, {
    versionLabel,
    changeNotes,
  });
  res.status(201).json({ success: true, data: version });
});

const publishVersion = asyncHandler(async (req, res) => {
  const version = await CurriculumVersionService.publishVersion(
    req.params.id,
    req.params.vId
  );
  res.json({ success: true, data: version });
});

const revertVersion = asyncHandler(async (req, res) => {
  const result = await CurriculumVersionService.revertVersion(
    req.params.id,
    req.params.vId
  );
  res.json({ success: true, data: result });
});

module.exports = { getAllVersions, getVersionById, createVersion, publishVersion, revertVersion };
