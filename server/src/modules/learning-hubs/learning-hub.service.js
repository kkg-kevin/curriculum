const LearningHubModel = require("./learning-hub.model");
const LearningHubCurriculumLinkModel = require("./learning-hub-curriculum-link.model");
const CurriculumModel = require("../curriculum/curriculum.model");
const TeacherHubLinkModel = require("../teachers/teacher-hub-link.model");
const TeacherModel = require("../teachers/teacher.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const ClassModel = require("../classes/class.model");
const ClassService = require("../classes/class.service");
const RoomModel = require("../rooms/room.model");
const RoomService = require("../rooms/room.service");

async function assertCurriculumExists(curriculumId) {
  const curriculum = await CurriculumModel.findById(curriculumId);
  if (!curriculum) {
    const err = new Error("Curriculum not found");
    err.statusCode = 404;
    throw err;
  }
  return curriculum;
}

function sortAttachments(links) {
  return [...links].sort((a, b) => {
    if (a.slot === b.slot) return a.createdAt > b.createdAt ? 1 : -1;
    return a.slot === "core" ? -1 : 1;
  });
}

const LearningHubService = {
  async createLearningHub(data) {
    const record = await LearningHubModel.create(data);
    if (data.curriculumId) {
      await this.syncCoreCurriculum(record.id, data.curriculumId);
    }
    return record;
  },

  // Read-only mirror of TeacherService's link management — teachers are linked to a hub from
  // the teacher side, this just reads the same table back out for hub-scoped consumers
  // (e.g. a school portal's "our teachers" list).
  async getHubTeachers(hubId) {
    const links = await TeacherHubLinkModel.findByHubId(hubId);
    const teachers = await Promise.all(links.map((l) => TeacherModel.findById(l.teacherId)));
    return teachers.filter(Boolean);
  },

  async getAllLearningHubs(filters) {
    return LearningHubModel.findAll(filters);
  },

  async getLearningHubById(id) {
    const record = await LearningHubModel.findById(id);
    if (!record) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async updateLearningHub(id, data) {
    const record = await LearningHubModel.update(id, data);
    if (!record) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }
    if (Object.prototype.hasOwnProperty.call(data, "curriculumId")) {
      await this.syncCoreCurriculum(id, data.curriculumId);
    }
    return record;
  },

  async syncCoreCurriculum(hubId, curriculumId) {
    const existing = await LearningHubCurriculumLinkModel.findCoreByHubId(hubId);
    if (!curriculumId) {
      if (existing) await LearningHubCurriculumLinkModel.delete(existing.id);
      return null;
    }

    await assertCurriculumExists(curriculumId);
    const now = new Date();
    if (existing && existing.curriculumId === curriculumId) {
      return existing;
    }

    return LearningHubCurriculumLinkModel.upsertBySlot({
      hubId,
      curriculumId,
      slot: "core",
      role: "core",
      status: "active",
      startedAt: existing?.startedAt || now,
      endedAt: null,
    });
  },

  async attachSecondaryCurriculum(hubId, curriculumId, role) {
    if (!["complementary", "substitutional"].includes(role)) {
      const err = new Error("Secondary curriculum role must be complementary or substitutional");
      err.statusCode = 400;
      throw err;
    }

    const hub = await LearningHubModel.findById(hubId);
    const core = await LearningHubCurriculumLinkModel.findCoreByHubId(hubId);
    if (!hub || (!core && !hub.curriculumId)) {
      const err = new Error("A secondary curriculum can only be attached to a hub that already has a core curriculum");
      err.statusCode = 400;
      throw err;
    }
    await assertCurriculumExists(curriculumId);
    const existing = await LearningHubCurriculumLinkModel.findSecondaryByHubId(hubId);
    const now = new Date();
    if (existing && existing.curriculumId === curriculumId && existing.role === role) {
      return existing;
    }

    return LearningHubCurriculumLinkModel.upsertBySlot({
      hubId,
      curriculumId,
      slot: "secondary",
      role,
      status: "active",
      startedAt: existing?.curriculumId === curriculumId ? existing.startedAt : now,
      endedAt: null,
    });
  },

  async updateSecondaryCurriculumStatus(hubId, curriculumId, status) {
    if (!["active", "inactive", "completed"].includes(status)) {
      const err = new Error("Invalid curriculum status");
      err.statusCode = 400;
      throw err;
    }
    const link = await LearningHubCurriculumLinkModel.findByHubAndCurriculumId(hubId, curriculumId);
    if (!link) {
      const err = new Error("Hub curriculum link not found");
      err.statusCode = 404;
      throw err;
    }
    if (link.slot !== "secondary") {
      const err = new Error("Only secondary curricula can be updated through this action");
      err.statusCode = 400;
      throw err;
    }
    const patch = {
      status,
      endedAt: status === "active" ? null : new Date(),
      startedAt: status === "active" && !link.startedAt ? new Date() : link.startedAt,
    };
    return LearningHubCurriculumLinkModel.update(link.id, patch);
  },

  async detachCurriculum(hubId, curriculumId) {
    const link = await LearningHubCurriculumLinkModel.findByHubAndCurriculumId(hubId, curriculumId);
    if (!link) {
      const hub = await LearningHubModel.findById(hubId);
      if (hub?.curriculumId === curriculumId) {
        await LearningHubModel.clearCurriculumIdByHubId(hubId);
        return true;
      }
      return false;
    }
    if (link.slot === "core") {
      await LearningHubModel.clearCurriculumIdByHubId(hubId);
    }
    return LearningHubCurriculumLinkModel.delete(link.id);
  },

  async getHubCurricula(hubId) {
    const hub = await LearningHubModel.findById(hubId);
    if (!hub) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }

    const links = sortAttachments(await LearningHubCurriculumLinkModel.findByHubId(hubId));
    const core = links.find((l) => l.slot === "core") || (hub.curriculumId ? {
      id: null,
      hubId,
      curriculumId: hub.curriculumId,
      slot: "core",
      role: "core",
      status: "active",
      startedAt: null,
      endedAt: null,
    } : null);
    const secondary = links.find((l) => l.slot === "secondary") || null;
    const curriculumIds = [...new Set([core?.curriculumId, secondary?.curriculumId].filter(Boolean))];
    const curricula = await Promise.all(curriculumIds.map((curriculumId) => CurriculumModel.findById(curriculumId)));
    const curriculumById = new Map(curricula.filter(Boolean).map((curriculum) => [curriculum.id, curriculum]));

    return [core, secondary].filter(Boolean).map((link) => ({
      ...link,
      curriculum: curriculumById.get(link.curriculumId) || null,
    }));
  },

  async getEffectiveCurriculumIds(hubId) {
    const hub = await LearningHubModel.findById(hubId);
    const links = sortAttachments(await LearningHubCurriculumLinkModel.findByHubId(hubId));
    const core = links.find((l) => l.slot === "core");
    const secondary = links.find((l) => l.slot === "secondary");

    if (secondary?.status === "active" && secondary.role === "substitutional") {
      return [secondary.curriculumId];
    }

    const ids = [];
    const coreCurriculumId = core?.curriculumId || hub?.curriculumId || null;
    if ((core?.status || "active") === "active" && coreCurriculumId) ids.push(coreCurriculumId);
    if (secondary?.status === "active" && secondary.role === "complementary" && secondary.curriculumId) {
      ids.push(secondary.curriculumId);
    }
    if (!coreCurriculumId && !secondary?.curriculumId) return [];
    return [...new Set(ids)];
  },

  async getEffectiveCurricula(hubId) {
    const ids = await this.getEffectiveCurriculumIds(hubId);
    const curricula = await Promise.all(ids.map((id) => CurriculumModel.findById(id)));
    return curricula.filter(Boolean);
  },

  async deleteLearningHub(id) {
    const deleted = await LearningHubModel.delete(id);
    if (!deleted) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }
    await LearningHubCurriculumLinkModel.deleteByHubId(id);
    await TeacherHubLinkModel.deleteByHubId(id);
    await LearnerHubLinkModel.deleteByHubId(id);
    // Classes are keyed by schoolId === this hub's id, with no other owner once the hub is gone —
    // routed through ClassService.deleteClass (not ClassModel.delete) so every cascade it already
    // handles (timetable, course schedules, attendance, class-owned assessment issues) runs too,
    // instead of duplicating that logic here.
    const classes = await ClassModel.findAll({ schoolId: id });
    for (const cls of classes) {
      await ClassService.deleteClass(cls.id);
    }
    // Rooms have no other owner once the hub is gone — routed through RoomService.deleteRoom
    // (not RoomModel.delete) so its own cascade (nulling roomId on any remaining timetable
    // slots) runs too, same reasoning as the classes loop above.
    const rooms = await RoomModel.findAll({ hubId: id });
    for (const room of rooms) {
      await RoomService.deleteRoom(room.id);
    }
    // Branch hubs become standalone rather than left pointing at a deleted parent — same
    // tolerance removing a curriculum doesn't leave hubs' curriculumId dangling either.
    const branches = await LearningHubModel.findAll({ parentHubId: id, includeDrafts: true });
    await Promise.all(branches.map((b) => LearningHubModel.update(b.id, { parentHubId: null })));
    return { message: "Learning hub deleted successfully" };
  },
};

module.exports = LearningHubService;
