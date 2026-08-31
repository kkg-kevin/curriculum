const LearningHubModel = require("./learning-hub.model");
const LearningHubCurriculumLinkModel = require("./learning-hub-curriculum-link.model");
const CurriculumModel = require("../curriculum/curriculum.model");
const TeacherHubLinkModel = require("../teachers/teacher-hub-link.model");
const TeacherModel = require("../teachers/teacher.model");
const LearnerModel = require("../learners/learner.model");
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
    const before = await LearningHubModel.findById(id);
    const record = await LearningHubModel.update(id, data);
    if (!record) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }
    if (Object.prototype.hasOwnProperty.call(data, "curriculumId")) {
      await this.syncCoreCurriculum(id, data.curriculumId);
    }
    // Deactivating a hub deactivates everyone who belongs to it; reactivating it brings them
    // back. Only fires on an actual status transition, not every save.
    if (data.status && before && data.status !== before.status) {
      if (data.status === "inactive") await this.cascadeHubDeactivation(id);
      else if (before.status === "inactive" && data.status === "active") await this.cascadeHubReactivation(id);
    }
    return record;
  },

  // Every learner enrolled at this hub, and every teacher assigned to it, loses portal access
  // when the hub is deactivated:
  //  - the learner's enrollment link here goes "inactive", and their ACCOUNT goes inactive too
  //    UNLESS they still have an active enrollment at some other, still-active hub (a shared
  //    learner shouldn't be locked out of a hub that's fine);
  //  - same rule for a teacher: their record goes "inactive" unless they're still linked to
  //    another active hub.
  // Idempotent — re-running against an already-cascaded hub changes nothing.
  async cascadeHubDeactivation(hubId) {
    // Branch hubs are part of this hub — deactivate them too (each then cascades to its own
    // people through this same method). Done first so `otherActiveHubIds` below already excludes
    // them when deciding whether a shared learner/teacher is "still active elsewhere".
    const branches = await LearningHubModel.findAll({ parentHubId: hubId, includeDrafts: true });
    for (const branch of branches) {
      if (branch.status !== "inactive") {
        await LearningHubModel.update(branch.id, { status: "inactive" });
        await this.cascadeHubDeactivation(branch.id);
      }
    }

    const otherActiveHubIds = new Set(
      (await LearningHubModel.findAll({ includeDrafts: true }))
        .filter((h) => h.id !== hubId && h.status !== "inactive")
        .map((h) => h.id)
    );

    // Learners
    const learnerLinks = await LearnerHubLinkModel.findByHubId(hubId);
    for (const link of learnerLinks) {
      if (link.status !== "inactive") {
        await LearnerHubLinkModel.update(link.id, { status: "inactive" });
      }
      const allLinks = await LearnerHubLinkModel.findByLearnerId(link.learnerId);
      const stillActiveElsewhere = allLinks.some(
        (l) => l.hubId !== hubId && l.status === "active" && otherActiveHubIds.has(l.hubId)
      );
      if (!stillActiveElsewhere) {
        const learner = await LearnerModel.findById(link.learnerId);
        if (learner && (learner.accountStatus || "active") === "active") {
          await LearnerModel.update(link.learnerId, { accountStatus: "inactive" });
        }
      }
    }

    // Teachers
    const teacherLinks = await TeacherHubLinkModel.findByHubId(hubId);
    for (const link of teacherLinks) {
      const allLinks = await TeacherHubLinkModel.findByTeacherId(link.teacherId);
      const stillAtActiveHub = allLinks.some((l) => l.hubId !== hubId && otherActiveHubIds.has(l.hubId));
      if (!stillAtActiveHub) {
        const teacher = await TeacherModel.findById(link.teacherId);
        if (teacher && (teacher.status || "active") !== "inactive") {
          await TeacherModel.update(link.teacherId, { status: "inactive" });
        }
      }
    }
  },

  // Reverses cascadeHubDeactivation for this hub: every enrollment here goes back to "active",
  // and every learner/teacher tied to this hub whose account is inactive is reactivated. This
  // reactivates anyone currently inactive who belongs to this hub — it doesn't try to remember
  // exactly who the deactivation cascade touched (that state isn't tracked separately), which
  // matches how the learner/hub toggles already work elsewhere.
  async cascadeHubReactivation(hubId) {
    const branches = await LearningHubModel.findAll({ parentHubId: hubId, includeDrafts: true });
    for (const branch of branches) {
      if (branch.status === "inactive") {
        await LearningHubModel.update(branch.id, { status: "active" });
        await this.cascadeHubReactivation(branch.id);
      }
    }

    const learnerLinks = await LearnerHubLinkModel.findByHubId(hubId);
    for (const link of learnerLinks) {
      if (link.status === "inactive") {
        await LearnerHubLinkModel.update(link.id, { status: "active" });
      }
      const learner = await LearnerModel.findById(link.learnerId);
      if (learner && (learner.accountStatus || "active") !== "active") {
        await LearnerModel.update(link.learnerId, { accountStatus: "active" });
      }
    }

    const teacherLinks = await TeacherHubLinkModel.findByHubId(hubId);
    for (const link of teacherLinks) {
      const teacher = await TeacherModel.findById(link.teacherId);
      if (teacher && (teacher.status || "active") === "inactive") {
        await TeacherModel.update(link.teacherId, { status: "active" });
      }
    }
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
