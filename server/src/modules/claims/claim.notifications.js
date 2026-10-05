const NotificationService = require("../notifications/notification.service");
const UserModel = require("../auth/user.model");
const TeacherModel = require("../teachers/teacher.model");
const AccessService = require("../access/access.service");
const { can } = require("../access/access.service");

// In-app notifications for a claim's journey. Where each one opens is decided client-side from
// its payload — see NotificationBell.jsx's resolveNotificationPath.
//
// None of these may fail the action that triggered them: the claim has already been saved by the
// time they run, so a notification that can't be delivered is logged and dropped.

const money = (claim) => `${claim.currency} ${Math.round(claim.amount).toLocaleString("en-KE")}`;
const kind = (claim) => (claim.type === "advance" ? "advance" : "full payment");

// Who reviews claims at a stage: the workspace owner, plus staff whose role can edit that module
// ("claims" = supervisor review, "claims-approval" = final approval and payment).
async function reviewerIds(ownerAdminId, module) {
  const staff = await UserModel.findAll({ invitedByAdminId: ownerAdminId });
  const allowed = [];
  for (const user of staff) {
    if (user.role !== "collaborator") continue;
    if (can(await AccessService.permissionsFor(user), module, "edit")) allowed.push(user.id);
  }
  return [ownerAdminId, ...allowed];
}

async function educatorUserId(claim) {
  const teacher = await TeacherModel.findById(claim.teacherId);
  if (!teacher?.email) return null;
  return (await UserModel.findByEmail(teacher.email))?.id || null;
}

async function toReviewers(claim, module, event) {
  const ids = await reviewerIds(claim.ownerAdminId, module);
  await Promise.all(ids.map((id) => NotificationService._notify(id, { ...event, payload: { claimId: claim.id, route: `/claims?claim=${claim.id}` } })));
}

async function toEducator(claim, event) {
  const payload = { claimId: claim.id, route: `/teacher-portal/claims/${claim.classId}/${claim.courseId}` };
  await NotificationService._notify(await educatorUserId(claim), { ...event, payload });
}

const guarded = (fn) => async (claim) => {
  try {
    await fn(claim);
  } catch (err) {
    console.error("[claims] could not send a notification:", err.message);
  }
};

module.exports = {
  submitted: guarded((claim) =>
    toReviewers(claim, "claims", {
      type: "claim_submitted",
      title: "New claim to review",
      message: `${claim.teacherName} requested ${kind(claim) === "advance" ? "an advance" : "full payment"} of ${money(claim)} for ${claim.courseName || "a course"}.`,
    })),

  forwarded: guarded(async (claim) => {
    await toReviewers(claim, "claims-approval", {
      type: "claim_awaiting_approval",
      title: "Claim awaiting final approval",
      message: `${claim.supervisorName || "A supervisor"} approved ${claim.teacherName}'s ${kind(claim)} claim of ${money(claim)} for ${claim.courseName || "a course"}.`,
    });
    await toEducator(claim, {
      type: "claim_progress",
      title: "Claim approved by your supervisor",
      message: `Your ${kind(claim)} claim of ${money(claim)} for ${claim.courseName || "your course"} is now with the admin for final approval.`,
    });
  }),

  rejected: guarded((claim) =>
    toEducator(claim, {
      type: "claim_rejected",
      title: "Claim declined",
      message: `Your ${kind(claim)} claim of ${money(claim)} for ${claim.courseName || "your course"} was declined: ${claim.rejectionReason || "no reason given"}`,
    })),

  approved: guarded((claim) =>
    toEducator(claim, {
      type: "claim_approved",
      title: "Claim approved for payment",
      message: `Your ${kind(claim)} claim of ${money(claim)} for ${claim.courseName || "your course"} has been approved and is awaiting payment.`,
    })),

  paid: guarded((claim) =>
    toEducator(claim, {
      type: "claim_paid",
      title: "Claim paid",
      message: `${money(claim)} has been paid for ${claim.courseName || "your course"}${claim.paymentReference ? ` (ref ${claim.paymentReference})` : ""}.`,
    })),
};
