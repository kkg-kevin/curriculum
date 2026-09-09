const UserModel = require("../auth/user.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const CurriculumModel = require("../curriculum/curriculum.model");
const CourseModel = require("../courses/course.model");
const AssessmentModel = require("../assessments/assessment.model");

// One-time operational tool: after the 2026-09-07 tenant-isolation migration backfilled every
// pre-existing learning_hubs/curricula/courses/assessments row to a single admin (see
// 20260907090000_add_owner_admin_id_to_root_tables.js's own comment — there was no createdBy
// field anywhere to recover real per-row ownership from), this lets an admin manually move a
// root entity they can currently see to a different admin, one at a time, at their own pace.
// Deliberately NOT a bulk/cascade operation — a hub's linked curriculum, and that curriculum's
// courses/assessments, are each independently-owned root entities (see the migration comment),
// so moving a hub does not imply moving what happens to be linked to it right now; the caller
// reassigns each entity explicitly.
const ENTITY_MODELS = {
  hub: { model: LearningHubModel, label: "learning hub" },
  curriculum: { model: CurriculumModel, label: "curriculum" },
  course: { model: CourseModel, label: "course" },
  assessment: { model: AssessmentModel, label: "assessment" },
};

function notFound(message) {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
}

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

const ReassignOwnerService = {
  // Resolves the target admin by email up front so a typo produces a clear 404 instead of
  // silently writing a bad ownerAdminId — same posture as createAdmin's own email-uniqueness
  // check in auth.service.js.
  async resolveTargetAdmin(email) {
    const user = await UserModel.findByEmail(email);
    if (!user || user.role !== "admin") {
      throw notFound("No admin account found with that email");
    }
    return user;
  },

  async reassign({ entityType, entityId, targetAdminEmail, currentOwnerAdminId }) {
    const entry = ENTITY_MODELS[entityType];
    if (!entry) throw badRequest(`Unknown entity type "${entityType}"`);

    const record = await entry.model.findById(entityId);
    if (!record) throw notFound(`That ${entry.label} was not found`);
    if (record.ownerAdminId !== currentOwnerAdminId) {
      throw notFound(`That ${entry.label} was not found`);
    }

    const targetAdmin = await this.resolveTargetAdmin(targetAdminEmail);
    if (targetAdmin.id === currentOwnerAdminId) {
      throw badRequest("That entity already belongs to this admin");
    }

    const updated = await entry.model.update(entityId, { ownerAdminId: targetAdmin.id });
    return { ...updated, movedTo: { id: targetAdmin.id, name: targetAdmin.name, email: targetAdmin.email } };
  },
};

module.exports = ReassignOwnerService;
