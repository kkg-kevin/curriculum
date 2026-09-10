const CompetitionModel = require("./competition.model");
const CurriculumModel = require("../curriculum/curriculum.model");

// A competition can optionally belong to a Program. A Program IS a `curricula` row with
// isProgram: true (see program.service.js) — so "resolve the program name" means resolve the
// curriculum. Kept as a display-only enrichment, never stored, so it can't drift.
async function resolveProgramName(programId) {
  if (!programId) return null;
  const curriculum = await CurriculumModel.findById(programId);
  return curriculum?.isProgram ? curriculum.name : null;
}

// createRecord/updateRecord return the record with `tracks` as whatever was written — a JSON
// string on create (it returns the stringified insert payload), a real array on a re-read.
// Normalise to an array so trackCount and the response shape are consistent either way.
function tracksArray(tracks) {
  if (Array.isArray(tracks)) return tracks;
  if (typeof tracks === "string") {
    try {
      const parsed = JSON.parse(tracks);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function enrich(competition) {
  if (!competition) return competition;
  const tracks = tracksArray(competition.tracks);
  return {
    ...competition,
    tracks,
    trackCount: tracks.length,
    programName: await resolveProgramName(competition.programId),
  };
}

// A competition's programId, when set, must point at a Program (isProgram curriculum) the SAME
// admin owns — a competition can't be attached to another tenant's program. Mirrors
// curriculum.controller.js's linkCourse same-tenant check.
async function assertProgramOwnedBy(programId, ownerAdminId) {
  if (!programId) return;
  const curriculum = await CurriculumModel.findById(programId);
  if (!curriculum || !curriculum.isProgram || curriculum.ownerAdminId !== ownerAdminId) {
    const err = new Error("That program doesn't exist or belongs to a different admin");
    err.statusCode = 400;
    throw err;
  }
}

const CompetitionService = {
  async createCompetition(data) {
    await assertProgramOwnedBy(data.programId, data.ownerAdminId);
    const record = await CompetitionModel.create(data);
    return enrich(record);
  },

  async getAllCompetitions(filters) {
    const records = await CompetitionModel.findAll(filters);
    return Promise.all(records.map(enrich));
  },

  async getCompetitionById(id) {
    const record = await CompetitionModel.findById(id);
    if (!record) {
      const err = new Error("Competition not found");
      err.statusCode = 404;
      throw err;
    }
    return enrich(record);
  },

  async updateCompetition(id, data, ownerAdminId) {
    const existing = await CompetitionModel.findById(id);
    if (!existing) {
      const err = new Error("Competition not found");
      err.statusCode = 404;
      throw err;
    }
    // programId may be absent from a partial patch — only re-check when it's actually changing.
    if ("programId" in data) await assertProgramOwnedBy(data.programId, ownerAdminId);
    const record = await CompetitionModel.update(id, data);
    return enrich(record);
  },

  async deleteCompetition(id) {
    const deleted = await CompetitionModel.delete(id);
    if (!deleted) {
      const err = new Error("Competition not found");
      err.statusCode = 404;
      throw err;
    }
    return { message: "Competition deleted successfully" };
  },

  // Every competition linked to a given Program — feeds the Program view's "Competitions"
  // section. A Program's id is its curriculum id.
  async getByProgram(programId) {
    const records = await CompetitionModel.findAll({ programId });
    return Promise.all(records.map(enrich));
  },

  // Called from CurriculumService.deleteCurriculum when a Program is deleted — detach its
  // competitions rather than orphan them with a dangling programId. A competition survives its
  // program (unlike the program's classes), same "the record has a life of its own" posture as
  // ProgramModel.delete leaving classes standing.
  async unlinkProgram(programId) {
    if (!programId) return;
    const records = await CompetitionModel.findAll({ programId });
    await Promise.all(records.map((c) => CompetitionModel.update(c.id, { programId: null })));
  },
};

module.exports = CompetitionService;
