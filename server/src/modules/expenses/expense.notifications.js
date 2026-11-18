const NotificationService = require("../notifications/notification.service");
const UserModel = require("../auth/user.model");
const AccessService = require("../access/access.service");
const { can } = require("../access/access.service");
const { rolesOf } = require("../auth/account-roles");
const { adminIdsOf } = require("../../shared/utils/organisation");

// The bell (and, where the person allows it, an email) for a claim's journey. None of these may
// fail the action that triggered them — the claim is already saved when they run.

const money = (claim, amount = claim.totalAmount) => `${claim.currency || "KES"} ${Number(amount || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
const label = (claim) => `${claim.number ? `${claim.number} · ` : ""}${claim.title}`;

// Where the claimant opens their claim — the portal of the sign-in they made it from.
function claimantRoute(claim) {
  const q = `claim=${claim.id}`;
  if (claim.claimantRole === "teacher") return `/teacher-portal/expenses?${q}`;
  if (claim.claimantRole === "supervisor") return `/supervisor-portal/expenses?tab=mine&${q}`;
  return `/my-expenses?${q}`;
}
const reviewerRoute = (claim) => `/expenses?${`claim=${claim.id}`}`;
const supervisorRoute = (claim) => `/supervisor-portal/expenses?tab=review&claim=${claim.id}`;

// Everyone who can approve and pay in the workspace: its admins and staff whose role grants
// Expenses → Edit — never the claimant themself.
async function approverIds(ownerAdminId, exceptUserId) {
  const ids = new Set(await adminIdsOf(ownerAdminId));
  if (!ids.size) ids.add(ownerAdminId);
  const staff = await UserModel.findAll({ invitedByAdminId: ownerAdminId });
  for (const user of staff) {
    if (!rolesOf(user).includes("collaborator") || user.deactivatedAt || user.removedAt) continue;
    if (can(await AccessService.permissionsFor({ ...user, role: "collaborator" }), "expenses", "edit")) ids.add(user.id);
  }
  ids.delete(exceptUserId);
  return [...ids];
}

async function toApprovers(claim, event) {
  const ids = await approverIds(claim.ownerAdminId, claim.claimantUserId);
  await Promise.all(ids.map((id) => NotificationService.notifyPerson(id, { ...event, ownerAdminId: claim.ownerAdminId, payload: { expenseClaimId: claim.id, route: reviewerRoute(claim) } })));
}

const toClaimant = (claim, event) => NotificationService.notifyPerson(claim.claimantUserId, { ...event, ownerAdminId: claim.ownerAdminId, payload: { expenseClaimId: claim.id, route: claimantRoute(claim) } });

const guarded = (fn) => async (...args) => {
  try {
    await fn(...args);
  } catch (err) {
    console.error("[expenses] could not send a notification:", err.message);
  }
};

module.exports = {
  approverIds,
  claimantRoute,

  submitted: guarded((claim) => {
    const event = {
      type: "expense_submitted",
      title: "Expense claim to review",
      message: `${claim.claimantName || "Someone"} claimed ${money(claim)} — ${label(claim)}.`,
    };
    if (claim.status === "pending_supervisor" && claim.supervisorId) {
      return NotificationService.notifyPerson(claim.supervisorId, { ...event, ownerAdminId: claim.ownerAdminId, payload: { expenseClaimId: claim.id, route: supervisorRoute(claim) } });
    }
    return toApprovers(claim, event);
  }),

  approved: guarded(async (claim, { bySupervisor = false } = {}) => {
    await toApprovers(claim, {
      type: "expense_to_pay",
      title: "Expense claim ready to pay",
      message: `${bySupervisor ? `${claim.supervisorName || "A supervisor"} approved` : "Approved:"} ${claim.claimantName || "someone"}'s claim of ${money(claim, claim.approvedAmount)} — ${label(claim)}.`,
    });
    await toClaimant(claim, {
      type: "expense_approved",
      title: "Expense claim approved",
      message: `${money(claim, claim.approvedAmount)} of your claim ${label(claim)} is approved and waiting to be paid.`,
    });
  }),

  returned: guarded((claim) => toClaimant(claim, {
    type: "expense_returned",
    title: "Expense claim sent back to you",
    message: `${label(claim)} needs a change before it can be approved: ${claim.returnReason || "see the claim"}`,
  })),

  rejected: guarded((claim) => toClaimant(claim, {
    type: "expense_rejected",
    title: "Expense claim declined",
    message: `${label(claim)} was declined: ${claim.rejectionReason || "no reason given"}`,
  })),

  paid: guarded((claim) => toClaimant(claim, {
    type: "expense_paid",
    title: "Expense claim paid",
    message: `${money(claim, claim.approvedAmount)} has been paid back for ${label(claim)}${claim.paymentReference ? ` (ref ${claim.paymentReference})` : ""}.`,
  })),
};
