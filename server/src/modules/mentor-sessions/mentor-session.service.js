const MentorSessionModel = require("./mentor-session.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const TeacherModel = require("../teachers/teacher.model");
const TeacherHubLinkModel = require("../teachers/teacher-hub-link.model");
const LearnerModel = require("../learners/learner.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");

// A logged session's hub must belong to the calling admin's tenant AND be a non-school hub type
// — "school" hubs already have their own billing flow (a school invoices its own learners'
// guardians, see billing.service.js), and mixing the two would double up how a school hub's
// revenue is tracked. Mentor sessions are specifically for the co_working_space / innovation_lab
// / makerspace / tech_club hub types (see learning-hub.validation.js's LEARNING_HUB_TYPES).
async function assertLoggableHub(hubId, ownerAdminId) {
  const hub = await LearningHubModel.findById(hubId);
  if (!hub || hub.ownerAdminId !== ownerAdminId) {
    const err = new Error("That learning hub doesn't exist or belongs to a different admin");
    err.statusCode = 400;
    throw err;
  }
  if (hub.hubType === "school") {
    const err = new Error("Mentor sessions are only for non-school hubs — school hubs bill learners directly");
    err.statusCode = 400;
    throw err;
  }
  return hub;
}

// The mentor must actually be assigned to this hub (teacher_hub_links) — otherwise any teacher
// account, anywhere in the tenant, could be logged as having earned revenue at a hub they have
// no real connection to.
async function assertTeacherAtHub(teacherId, hubId) {
  const teacher = await TeacherModel.findById(teacherId);
  if (!teacher) {
    const err = new Error("Mentor not found");
    err.statusCode = 400;
    throw err;
  }
  const links = await TeacherHubLinkModel.findByTeacherId(teacherId);
  if (!links.some((l) => l.hubId === hubId)) {
    const err = new Error("That mentor isn't assigned to this hub");
    err.statusCode = 400;
    throw err;
  }
}

// Same posture for the learner — must be enrolled at this hub (learner_hub_links).
async function assertLearnerAtHub(learnerId, hubId) {
  const learner = await LearnerModel.findById(learnerId);
  if (!learner) {
    const err = new Error("Learner not found");
    err.statusCode = 400;
    throw err;
  }
  const link = await LearnerHubLinkModel.findOne(learnerId, hubId);
  if (!link) {
    const err = new Error("That learner isn't enrolled at this hub");
    err.statusCode = 400;
    throw err;
  }
}

const MentorSessionService = {
  async createSession(data) {
    await assertLoggableHub(data.hubId, data.ownerAdminId);
    await assertTeacherAtHub(data.teacherId, data.hubId);
    await assertLearnerAtHub(data.learnerId, data.hubId);
    return MentorSessionModel.create(data);
  },

  async getAllSessions(filters) {
    return MentorSessionModel.findAll(filters);
  },

  async getSessionById(id) {
    const record = await MentorSessionModel.findById(id);
    if (!record) {
      const err = new Error("Mentor session not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async updateSession(id, data, ownerAdminId) {
    const existing = await MentorSessionModel.findById(id);
    if (!existing) {
      const err = new Error("Mentor session not found");
      err.statusCode = 404;
      throw err;
    }
    // hubId/teacherId/learnerId aren't editable after the fact — a logged session is a record of
    // what happened; re-pointing it at a different hub/mentor/learner would rewrite history rather
    // than correct a mistake. Only the fee/date/duration/payment/notes fields can be amended.
    const patch = { ...data };
    delete patch.hubId;
    delete patch.teacherId;
    delete patch.learnerId;
    return MentorSessionModel.update(id, patch);
  },

  async deleteSession(id) {
    const deleted = await MentorSessionModel.delete(id);
    if (!deleted) {
      const err = new Error("Mentor session not found");
      err.statusCode = 404;
      throw err;
    }
    return { message: "Mentor session deleted" };
  },

  // Derived rollup for a hub's revenue view — never a stored balance, always computed fresh off
  // the sessions themselves (same "derive, don't duplicate" posture as billing.service.js's
  // Customers view). Only `paid` sessions count as realized revenue; `unpaid`/`waived` are
  // reported separately so a hub can see what's outstanding.
  async getHubRevenueSummary(hubId, ownerAdminId) {
    const sessions = await MentorSessionModel.findAll({ hubId, ownerAdminId });
    const totals = { paid: 0, unpaid: 0, waived: 0, sessionCount: sessions.length };
    for (const s of sessions) {
      totals[s.paymentStatus] += s.feeAmount || 0;
    }
    return { ...totals, sessions };
  },
};

module.exports = MentorSessionService;
