const asyncHandler = require("express-async-handler");
const PublicCompetitionService = require("./public-competition.service");

// digifunzi-landing's Competitions section (/competitions, /competitions/:slug). Bare
// array/object responses (no { success, data } wrapper) — same convention as the other public
// controllers. 404s an unknown id/slug OR a competition that isn't public / is still draft /
// belongs to another admin (undifferentiated).

const getPublicCompetitions = asyncHandler(async (req, res) => {
  const records = await PublicCompetitionService.listCompetitions();
  res.json(records);
});

const getPublicCompetition = asyncHandler(async (req, res) => {
  const record = await PublicCompetitionService.getCompetition(req.params.idOrSlug);
  if (!record) return res.status(404).json({ message: "Competition not found" });
  res.json(record);
});

module.exports = { getPublicCompetitions, getPublicCompetition };
