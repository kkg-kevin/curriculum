const NotificationService = require("../notifications/notification.service");
const UserModel = require("../auth/user.model");
const TeacherModel = require("../teachers/teacher.model");
const AccessService = require("../access/access.service");
const { can } = require("../access/access.service");
const { rolesOf } = require("../auth/account-roles");

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
    if (!rolesOf(user).includes("collaborator")) continue;
    if (can(await AccessService.permissionsFor({ ...user, role: "collaborator" }), module, "edit")) allowed.push(user.id);
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
  await Promise.all(ids.map((id) => NotificationService._notify(id, { ...event, ownerAdminId: claim.ownerAdminId, payload: { claimId: claim.id, route: `/claims?claim=${claim.id}` } })));
}

// The supervisor the claim was sent to — they review in their own portal.
async function toSupervisor(claim, event) {
  await NotificationService.notifyPerson(claim.supervisorId, { ...event, ownerAdminId: claim.ownerAdminId, payload: { claimId: claim.id, route: `/supervisor-portal?claim=${claim.id}` } });
}

async function toEducator(claim, event) {
  const payload = { claimId: claim.id, route: `/teacher-portal/claims/${claim.classId}/${claim.courseId}` };
  await NotificationService.notifyPerson(await educatorUserId(claim), { ...event, ownerAdminId: claim.ownerAdminId, payload });
}

const guarded = (fn) => async (...args) => {
  try {
    await fn(...args);
  } catch (err) {
    console.error("[claims] could not send a notification:", err.message);
  }
};

module.exports = {
  // A new claim goes to whoever reviews it: the educator's supervisor, or — when they have
  // none — the workspace's own approvers.
  submitted: guarded((claim) => {
    const event = {
      type: "claim_submitted",
      title: "New claim to review",
      message: `${claim.teacherName} requested ${kind(claim) === "advance" ? "an advance" : "full payment"} of ${money(claim)} for ${claim.courseName || "a course"}.`,
    };
    return claim.status === "pending_supervisor" && claim.supervisorId ? toSupervisor(claim, event) : toReviewers(claim, "claims-approval", event);
  }),

  // The supervisor approved it: over to the admin to pay, and the educator hears the good news.
  forwarded: guarded(async (claim) => {
    await toReviewers(claim, "claims-approval", {
      type: "claim_awaiting_approval",
      title: "Claim ready to pay",
      message: `${claim.supervisorName || "A supervisor"} approved ${claim.teacherName}'s ${kind(claim)} claim of ${money(claim)} for ${claim.courseName || "a course"}.`,
    });
    await toEducator(claim, {
      type: "claim_approved",
      title: "Claim approved by your supervisor",
      message: `Your ${kind(claim)} claim of ${money(claim)} for ${claim.courseName || "your course"} has been approved and is awaiting payment.`,
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

  // Paying a claim by M-Pesa (payments/mpesa/mpesa.operations.js): Safaricom's answer, to the
  // people who approve and pay claims. (The educator hears through `paid` above.)
  payoutSent: guarded((claim, { receipt, receiverName, note } = {}) =>
    toReviewers(claim, "claims-approval", {
      type: "claim_payout_sent",
      title: "Claim paid by M-Pesa",
      message: `${money(claim)} reached ${receiverName || claim.teacherName || "the educator"} for ${claim.courseName || "their course"}${receipt ? ` (M-Pesa ${receipt})` : ""}.${note ? ` ${note}` : ""}`,
    })),

  payoutFailed: guarded((claim, reason) =>
    toReviewers(claim, "claims-approval", {
      type: "claim_payout_failed",
      title: "M-Pesa payment of a claim didn't go through",
      message: `Paying ${money(claim)} to ${claim.teacherName || "the educator"} for ${claim.courseName || "their course"}: ${reason || "M-Pesa didn't complete it"}. The claim is still approved.`,
    })),
};
