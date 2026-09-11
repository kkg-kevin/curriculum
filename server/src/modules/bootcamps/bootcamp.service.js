const BootcampModel = require("./bootcamp.model");
const CurriculumModel = require("../curriculum/curriculum.model");

// A bootcamp can optionally belong to an Event. An Event IS a `curricula` row with
// isEvent: true (see event.service.js) — so "resolve the event name" means resolve the
// curriculum. Kept as a display-only enrichment, never stored, so it can't drift.
async function resolveEventName(eventId) {
  if (!eventId) return null;
  const curriculum = await CurriculumModel.findById(eventId);
  return curriculum?.isEvent ? curriculum.name : null;
}

// createRecord/updateRecord return the record with `highlights` as whatever was written — a
// JSON string on create (it returns the stringified insert payload), a real array on a
// re-read. Normalise to an array so the response shape is consistent either way.
function highlightsArray(highlights) {
  if (Array.isArray(highlights)) return highlights;
  if (typeof highlights === "string") {
    try {
      const parsed = JSON.parse(highlights);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function enrich(bootcamp) {
  if (!bootcamp) return bootcamp;
  return {
    ...bootcamp,
    highlights: highlightsArray(bootcamp.highlights),
    eventName: await resolveEventName(bootcamp.eventId),
  };
}

// A bootcamp's eventId, when set, must point at an Event (isEvent curriculum) the SAME admin
// owns — a bootcamp can't be attached to another tenant's event. Mirrors
// competition.service.js's assertEventOwnedBy.
async function assertEventOwnedBy(eventId, ownerAdminId) {
  if (!eventId) return;
  const curriculum = await CurriculumModel.findById(eventId);
  if (!curriculum || !curriculum.isEvent || curriculum.ownerAdminId !== ownerAdminId) {
    const err = new Error("That event doesn't exist or belongs to a different admin");
    err.statusCode = 400;
    throw err;
  }
}

const BootcampService = {
  async createBootcamp(data) {
    await assertEventOwnedBy(data.eventId, data.ownerAdminId);
    const record = await BootcampModel.create(data);
    return enrich(record);
  },

  async getAllBootcamps(filters) {
    const records = await BootcampModel.findAll(filters);
    return Promise.all(records.map(enrich));
  },

  async getBootcampById(id) {
    const record = await BootcampModel.findById(id);
    if (!record) {
      const err = new Error("Bootcamp not found");
      err.statusCode = 404;
      throw err;
    }
    return enrich(record);
  },

  async updateBootcamp(id, data, ownerAdminId) {
    const existing = await BootcampModel.findById(id);
    if (!existing) {
      const err = new Error("Bootcamp not found");
      err.statusCode = 404;
      throw err;
    }
    // eventId may be absent from a partial patch — only re-check when it's actually changing.
    if ("eventId" in data) await assertEventOwnedBy(data.eventId, ownerAdminId);
    const record = await BootcampModel.update(id, data);
    return enrich(record);
  },

  async deleteBootcamp(id) {
    const deleted = await BootcampModel.delete(id);
    if (!deleted) {
      const err = new Error("Bootcamp not found");
      err.statusCode = 404;
      throw err;
    }
    return { message: "Bootcamp deleted successfully" };
  },

  // Every bootcamp linked to a given Event — feeds the Event view's "Bootcamps" section. An
  // Event's id is its curriculum id.
  async getByEvent(eventId) {
    const records = await BootcampModel.findAll({ eventId });
    return Promise.all(records.map(enrich));
  },

  // Called from CurriculumService.deleteCurriculum when an Event is deleted — detach its
  // bootcamps rather than orphan them with a dangling eventId. A bootcamp survives its event
  // (unlike the event's classes), same "the record has a life of its own" posture as
  // EventModel.delete leaving classes standing.
  async unlinkEvent(eventId) {
    if (!eventId) return;
    const records = await BootcampModel.findAll({ eventId });
    await Promise.all(records.map((b) => BootcampModel.update(b.id, { eventId: null })));
  },
};

module.exports = BootcampService;
