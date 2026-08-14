const ClassGroupModel = require("./class-group.model");
const ClassGroupMemberModel = require("./class-group-member.model");
const ClassModel = require("../class.model");
const LearnerHubLinkModel = require("../../learners/learner-hub-link.model");
const LearnerModel = require("../../learners/learner.model");
const AssessmentSubmissionModel = require("../../assessments/submissions/assessment-submission.model");

async function loadGroupOrThrow(groupId) {
  const group = await ClassGroupModel.findById(groupId);
  if (!group) {
    const err = new Error("Group not found");
    err.statusCode = 404;
    throw err;
  }
  return group;
}

const ClassGroupService = {
  async createGroup({ classId, name }) {
    const cls = await ClassModel.findById(classId);
    if (!cls) {
      const err = new Error("Class not found");
      err.statusCode = 404;
      throw err;
    }
    return ClassGroupModel.create({ classId, name });
  },

  // A single group with its members resolved to full Learner records.
  async getGroup(groupId) {
    const group = await ClassGroupModel.findById(groupId);
    if (!group) return null;
    const links = await ClassGroupMemberModel.findByGroupId(groupId);
    const members = await LearnerModel.findAll({ ids: links.map((l) => l.learnerId) });
    return { ...group, members };
  },

  // Every group in a class, each with its members resolved — the teacher's group-management
  // list, and the source getRosterForIssue reshapes into group-mode roster rows from.
  async listGroupsForClass(classId) {
    const groups = await ClassGroupModel.findAll({ classId });
    if (!groups.length) return [];
    const groupIds = groups.map((g) => g.id);
    const links = await ClassGroupMemberModel.findByGroupIds(groupIds);
    const learners = await LearnerModel.findAll({ ids: links.map((l) => l.learnerId) });
    const learnerById = new Map(learners.map((l) => [l.id, l]));
    const membersByGroup = new Map();
    links.forEach((link) => {
      const learner = learnerById.get(link.learnerId);
      if (!learner) return;
      const list = membersByGroup.get(link.groupId) || [];
      list.push(learner);
      membersByGroup.set(link.groupId, list);
    });
    return groups.map((g) => ({ ...g, members: membersByGroup.get(g.id) || [] }));
  },

  // Every actively-enrolled learner in the class who isn't in any group yet — surfaced in the
  // teacher's group UI and the group-mode roster so nobody is silently left out.
  async getUngroupedLearners(classId) {
    const links = await LearnerHubLinkModel.findByClassId(classId);
    const activeLearnerIds = links.filter((l) => l.status === "active").map((l) => l.learnerId);
    if (!activeLearnerIds.length) return [];
    const groups = await ClassGroupModel.findAll({ classId });
    const memberLinks = await ClassGroupMemberModel.findByGroupIds(groups.map((g) => g.id));
    const groupedIds = new Set(memberLinks.map((l) => l.learnerId));
    const ungroupedIds = activeLearnerIds.filter((id) => !groupedIds.has(id));
    if (!ungroupedIds.length) return [];
    return LearnerModel.findAll({ ids: ungroupedIds });
  },

  // The group a learner currently belongs to within one class, or null — called in-process by
  // assessment-submission.service.js's getOrCreateSubmission to resolve a group-mode fan-out
  // target, and exposed over HTTP for the learner-portal "your group" panel. Scoped to this
  // class's own current groups (not just any membership row) so a learner who's moved classes
  // never sees a stale group from before the move.
  async getGroupForLearner(classId, learnerId) {
    const memberships = await ClassGroupMemberModel.findByLearnerId(learnerId);
    if (!memberships.length) return null;
    const classGroupIds = new Set((await ClassGroupModel.findAll({ classId })).map((g) => g.id));
    const match = memberships.find((m) => classGroupIds.has(m.groupId));
    return match ? ClassGroupService.getGroup(match.groupId) : null;
  },

  async renameGroup(groupId, name) {
    await loadGroupOrThrow(groupId);
    await ClassGroupModel.update(groupId, { name });
    return ClassGroupService.getGroup(groupId);
  },

  // Blocked once any submission (any status — unfinished drafts are real work too) references
  // this group, so grading history is never orphaned. The client should hide/disable delete once
  // a group has submission history; this is the enforced backstop.
  async deleteGroup(groupId) {
    await loadGroupOrThrow(groupId);
    const submissions = await AssessmentSubmissionModel.findAll({ groupId });
    if (submissions.length) {
      const err = new Error("This group has submitted work tied to it and can't be deleted");
      err.statusCode = 409;
      throw err;
    }
    await ClassGroupMemberModel.deleteByGroupId(groupId);
    await ClassGroupModel.delete(groupId);
    return { message: "Group deleted" };
  },

  // Enforces "one group per class per learner" by auto-moving the learner out of any sibling
  // group in the same class rather than rejecting — friendlier for a click-to-assign UI than
  // forcing an explicit remove-then-add. See class-group-member.model.js's addExclusive.
  async addMember(groupId, learnerId) {
    const group = await loadGroupOrThrow(groupId);
    const links = await LearnerHubLinkModel.findByClassId(group.classId);
    const isActive = links.some((l) => l.learnerId === learnerId && l.status === "active");
    if (!isActive) {
      const err = new Error("Learner is not actively enrolled in this class");
      err.statusCode = 400;
      throw err;
    }
    const siblingGroups = await ClassGroupModel.findAll({ classId: group.classId });
    const siblingGroupIds = siblingGroups.map((g) => g.id).filter((id) => id !== groupId);
    await ClassGroupMemberModel.addExclusive(groupId, learnerId, siblingGroupIds);
    return ClassGroupService.getGroup(groupId);
  },

  async removeMember(groupId, learnerId) {
    await loadGroupOrThrow(groupId);
    await ClassGroupMemberModel.remove(groupId, learnerId);
    return ClassGroupService.getGroup(groupId);
  },

  // Cascade hook for class.service.js's deleteClass — unlike deleteGroup above, this isn't
  // guarded against existing submissions: the class itself is being deleted outright, and any
  // submission referencing one of these groups simply keeps its (now orphaned) groupId, same
  // tolerance deleteClass already applies to learner-targeted issues/submissions that merely
  // reference the deleted classId.
  async deleteAllForClass(classId) {
    const groups = await ClassGroupModel.findAll({ classId });
    await ClassGroupMemberModel.deleteByGroupIds(groups.map((g) => g.id));
    await ClassGroupModel.deleteByClassId(classId);
  },

  // Cascade hook for learner.service.js's deleteLearner.
  removeLearnerEverywhere(learnerId) {
    return ClassGroupMemberModel.deleteByLearnerId(learnerId);
  },
};

module.exports = ClassGroupService;
