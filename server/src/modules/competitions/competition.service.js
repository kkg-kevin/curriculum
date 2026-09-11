const CompetitionModel = require("./competition.model");
const CurriculumModel = require("../curriculum/curriculum.model");

// A competition can optionally belong to an Event. An Event IS a `curricula` row with
// isEvent: true (see event.service.js) — so "resolve the event name" means resolve the
// curriculum. Kept as a display-only enrichment, never stored, so it can't drift.
async function resolveEventName(eventId) {
  if (!eventId) return null;
  const curriculum = await CurriculumModel.findById(eventId);
  return curriculum?.isEvent ? curriculum.name : null;
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
    eventName: await resolveEventName(competition.eventId),
  };
}

// A competition's eventId, when set, must point at an Event (isEvent curriculum) the SAME
// admin owns — a competition can't be attached to another tenant's event. Mirrors
// curriculum.controller.js's linkCourse same-tenant check.
async function assertEventOwnedBy(eventId, ownerAdminId) {
  if (!eventId) return;
  const curriculum = await CurriculumModel.findById(eventId);
  if (!curriculum || !curriculum.isEvent || curriculum.ownerAdminId !== ownerAdminId) {
    const err = new Error("That event doesn't exist or belongs to a different admin");
    err.statusCode = 400;
    throw err;
  }
}

const CompetitionService = {
  async createCompetition(data) {
    await assertEventOwnedBy(data.eventId, data.ownerAdminId);
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
    // eventId may be absent from a partial patch — only re-check when it's actually changing.
    if ("eventId" in data) await assertEventOwnedBy(data.eventId, ownerAdminId);
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

  // Every competition linked to a given Event — feeds the Event view's "Competitions"
  // section. An Event's id is its curriculum id.
  async getByEvent(eventId) {
    const records = await CompetitionModel.findAll({ eventId });
    return Promise.all(records.map(enrich));
  },

  // Called from CurriculumService.deleteCurriculum when an Event is deleted — detach its
  // competitions rather than orphan them with a dangling eventId. A competition survives its
  // event (unlike the event's classes), same "the record has a life of its own" posture as
  // EventModel.delete leaving classes standing.
  async unlinkEvent(eventId) {
    if (!eventId) return;
    const records = await CompetitionModel.findAll({ eventId });
    await Promise.all(records.map((c) => CompetitionModel.update(c.id, { eventId: null })));
  },
};

module.exports = CompetitionService;
