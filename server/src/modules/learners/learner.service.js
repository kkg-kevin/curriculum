const LearnerModel = require("./learner.model");
const LearnerHubLinkModel = require("./learner-hub-link.model");
const SchoolModel  = require("../learning-hubs/learning-hub.model");
const ClassModel   = require("../classes/class.model");
const LearnerJourneyModel = require("../curriculum/competency-framework/learner-journey.model");

const generateAdmissionNumber = (schoolCode, year) => {
  const prefix = `${(schoolCode || "GEN").toUpperCase()}-${year}`;
  const count = LearnerHubLinkModel.countByAdmissionPrefix(prefix);
  const seq = String(count + 1).padStart(3, "0");
  return `${prefix}-${seq}`;
};

// Shared by create/update — a username has to be unique across every learner, since it's a
// login identifier (see auth.service.js resolving it back to a guardian account).
function assertUsernameAvailable(username, excludeId) {
  if (!username) return;
  const existing = LearnerModel.findByUsername(username);
  if (existing && existing.id !== excludeId) {
    const err = new Error("This username is already taken");
    err.statusCode = 409;
    throw err;
  }
}

const LearnerService = {
  async createLearner(data) {
    assertUsernameAvailable(data.username);
    return LearnerModel.create(data);
  },

  // When scoped by `schoolId`/`classId`, resolves matching enrollment links first, then merges
  // each learner's *own* schoolId/classId/admissionNumber/status back onto the returned object
  // from that link. This preserves the flat response shape every existing class-roster,
  // attendance, and school-scoped consumer already expects (they filter by query param, not by
  // reading these fields off a learner object) even though the fields no longer live on the
  // learner record itself. A learner can have at most one link per hub and at most one link per
  // class, so this merge is always unambiguous. Unscoped (no schoolId/classId) returns bare
  // identity records — there's no single enrollment to merge.
  async getAllLearners({ schoolId, classId, status, guardianEmail, ids } = {}) {
    if (!schoolId && !classId) {
      // No single admissionNumber applies across hubs, but a hub count is real, cheap to
      // compute here, and lets the flat cross-hub card show something more honest than
      // "no ID" for a learner who simply isn't scoped to one hub in this view.
      return LearnerModel.findAll({ guardianEmail, ids }).map((l) => ({
        ...l,
        hubCount: LearnerHubLinkModel.findByLearnerId(l.id).length,
      }));
    }
    let links = classId ? LearnerHubLinkModel.findByClassId(classId) : LearnerHubLinkModel.findByHubId(schoolId);
    if (schoolId && classId) links = links.filter((l) => l.hubId === schoolId);
    if (status) links = links.filter((l) => l.status === status);
    const linkByLearnerId = new Map(links.map((l) => [l.learnerId, l]));
    if (linkByLearnerId.size === 0) return [];
    const learners = LearnerModel.findAll({ guardianEmail, ids: [...linkByLearnerId.keys()] });
    return learners.map((l) => {
      const link = linkByLearnerId.get(l.id);
      return { ...l, schoolId: link.hubId, classId: link.classId, admissionNumber: link.admissionNumber, status: link.status };
    });
  },

  async getLearnerById(id) {
    const record = LearnerModel.findById(id);
    if (!record) {
      const err = new Error("Learner not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async updateLearner(id, data) {
    assertUsernameAvailable(data.username, id);
    const record = LearnerModel.update(id, data);
    if (!record) {
      const err = new Error("Learner not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async deleteLearner(id) {
    const deleted = LearnerModel.delete(id);
    if (!deleted) {
      const err = new Error("Learner not found");
      err.statusCode = 404;
      throw err;
    }
    LearnerJourneyModel.deleteByLearnerId(id);
    LearnerHubLinkModel.deleteByLearnerId(id);
    return { message: "Learner deleted successfully" };
  },

  // Resolved enrollment list — each entry is the hub's own fields plus the enrollment-specific
  // facts (which class there, that hub's admission number, that hub's enrollment status), same
  // "resolve link rows into full objects" shape as TeacherService.getTeacherHubs, just richer
  // because a learner's placement within a hub is meaningful in a way a teacher's isn't.
  async getLearnerHubs(learnerId) {
    return LearnerHubLinkModel.findByLearnerId(learnerId)
      .map((link) => {
        const hub = SchoolModel.findById(link.hubId);
        if (!hub) return null;
        const cls = link.classId ? ClassModel.findById(link.classId) : null;
        return { ...hub, linkId: link.id, classId: link.classId || "", class: cls, admissionNumber: link.admissionNumber, status: link.status };
      })
      .filter(Boolean);
  },

  async enrollInHub(learnerId, { hubId, classId, status }) {
    if (!LearnerModel.findById(learnerId)) {
      const err = new Error("Learner not found");
      err.statusCode = 404;
      throw err;
    }
    const hub = SchoolModel.findById(hubId);
    if (!hub) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }

    let cls = null;
    let resolvedHubId = hubId;
    if (classId) {
      cls = ClassModel.findById(classId);
      if (!cls) {
        const err = new Error("Class not found");
        err.statusCode = 400;
        throw err;
      }
      if (cls.schoolId !== hubId) {
        const err = new Error("Class does not belong to this learning hub");
        err.statusCode = 400;
        throw err;
      }
      resolvedHubId = cls.schoolId;
    }

    const existing = LearnerHubLinkModel.findOne(learnerId, resolvedHubId);
    if (existing) return LearnerService.getLearnerHubs(learnerId);

    const year = cls?.academicYear || String(new Date().getFullYear());
    const admissionNumber = generateAdmissionNumber(hub.code, year);
    LearnerHubLinkModel.create({ learnerId, hubId: resolvedHubId, classId, admissionNumber, status });
    return LearnerService.getLearnerHubs(learnerId);
  },

  async updateEnrollment(learnerId, hubId, data) {
    const link = LearnerHubLinkModel.findOne(learnerId, hubId);
    if (!link) {
      const err = new Error("This learner is not enrolled at this hub");
      err.statusCode = 404;
      throw err;
    }
    if (data.classId) {
      const cls = ClassModel.findById(data.classId);
      if (!cls || cls.schoolId !== hubId) {
        const err = new Error("Class does not belong to this learning hub");
        err.statusCode = 400;
        throw err;
      }
    }
    LearnerHubLinkModel.update(link.id, data);
    return LearnerService.getLearnerHubs(learnerId);
  },

  async unenrollFromHub(learnerId, hubId) {
    LearnerHubLinkModel.unlink(learnerId, hubId);
    return LearnerService.getLearnerHubs(learnerId);
  },
};

module.exports = LearnerService;
