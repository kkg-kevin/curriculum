const db = require("../../config/db");
const { rolesOf } = require("../auth/account-roles");

// A learner's parent, on its own — for the staff learner page's Parent tab. The learner record
// holds the parent's details (guardianName / guardianEmail / guardianPhone); the rest comes from
// that email:
//   login     the parent's own sign-in (a "learner"-role login with an email, no username — see
//             parent.access.js): when it was made, last signed in, last did anything, switched off;
//   children  every learner whose guardian email it is — only the ones this viewer may see (an
//             admin: the workspace's; a hub: its own);
//   signups   (admins) the website enquiries and sign-ups made with that email — bootcamps, Home
//             Learning, Tech Clubs — newest first.
// The parent's own activity (sign-ins and what they did) is read from the activity log by the
// page itself (GET /api/audit?actor=<login id>), for those allowed to read the log.

const lower = (v) => String(v || "").trim().toLowerCase();
const fullName = (l) => [l.firstName, l.lastName].filter(Boolean).join(" ").trim();

const INTEREST = { bootcamp: "Bootcamp", project: "Project", quarky: "Quarky robot", general: "General enquiry", home_learning: "Home Learning", tech_club: "Tech Club" };

async function loginFor(email) {
  if (!email) return null;
  const users = await db("users").whereRaw("LOWER(email) = ?", [email]).whereNull("username")
    .select("id", "name", "email", "role", "extraRoles", "createdAt", "deactivatedAt");
  const parent = users.find((u) => rolesOf(u).includes("learner"));
  if (!parent) return null;
  const [lastActive, lastSignIn] = await Promise.all([
    db("audit_log").where({ actorUserId: parent.id }).whereNot({ action: "login_failed" }).max({ at: "createdAt" }).first(),
    db("audit_log").where({ actorUserId: parent.id, action: "login" }).max({ at: "createdAt" }).first(),
  ]);
  return {
    id: parent.id,
    email: parent.email,
    name: parent.name || null,
    createdAt: parent.createdAt,
    deactivatedAt: parent.deactivatedAt || null,
    lastSignInAt: lastSignIn?.at || null,
    lastActiveAt: lastActive?.at || null,
    // Other roles the same login holds (an educator who is also a parent, say).
    otherRoles: rolesOf(parent).filter((r) => r !== "learner"),
  };
}

const LearnerParentService = {
  // `visibleHubIds`: the hubs this viewer may see learners at; `ownerAdminId` for an admin (who also
  // sees learners the workspace created before any hub); `isAdmin` adds the sign-ups.
  async forLearner(learner, { visibleHubIds, ownerAdminId = null, isAdmin = false }) {
    const email = lower(learner.guardianEmail);
    const details = { name: learner.guardianName || null, email: learner.guardianEmail || null, phone: learner.guardianPhone || null };
    if (!email) return { details, login: null, children: [], hiddenChildren: 0, signups: isAdmin ? [] : undefined };

    const [login, family] = await Promise.all([
      loginFor(email),
      db("learners").whereRaw("LOWER(guardianEmail) = ?", [email])
        .select("id", "firstName", "lastName", "username", "dateOfBirth", "accountStatus", "createdByAdminId", "createdAt"),
    ]);

    const links = family.length ? await db("learner_hub_links").whereIn("learnerId", family.map((l) => l.id)).select("learnerId", "hubId", "status") : [];
    const visible = new Set(visibleHubIds);
    const hubIds = [...new Set(links.map((l) => l.hubId))];
    const hubs = hubIds.length ? await db("learning_hubs").whereIn("id", hubIds).select("id", "name") : [];
    const hubName = new Map(hubs.map((h) => [h.id, h.name]));

    const canSee = (child) => child.id === learner.id
      || links.some((l) => l.learnerId === child.id && visible.has(l.hubId))
      || (ownerAdminId && child.createdByAdminId === ownerAdminId);
    const shown = family.filter(canSee);
    const children = shown.map((child) => ({
      id: child.id,
      name: fullName(child) || "Learner",
      username: child.username || null,
      dateOfBirth: child.dateOfBirth || null,
      accountStatus: child.accountStatus || "active",
      isThisLearner: child.id === learner.id,
      hubs: links.filter((l) => l.learnerId === child.id && visible.has(l.hubId)).map((l) => hubName.get(l.hubId)).filter(Boolean),
    })).sort((a, b) => Number(b.isThisLearner) - Number(a.isThisLearner) || a.name.localeCompare(b.name));

    let signups;
    if (isAdmin) {
      const leads = await db("leads").whereRaw("LOWER(email) = ?", [email]).whereNull("anonymisedAt")
        .select("id", "source", "interestedIn", "learnerName", "status", "bootcampId", "paidAt", "invoiceId", "learnerId", "homeLearningHouseholdId", "clubMembershipId", "createdAt")
        .orderBy("createdAt", "desc").limit(50);
      const bootcampIds = [...new Set(leads.map((l) => l.bootcampId).filter(Boolean))];
      const bootcamps = bootcampIds.length ? await db("bootcamps").whereIn("id", bootcampIds).select("id", "name", "startDate", "endDate") : [];
      const bootcampById = new Map(bootcamps.map((b) => [b.id, b]));
      signups = leads.map((l) => {
        const bootcamp = l.bootcampId ? bootcampById.get(l.bootcampId) : null;
        const signedUp = Boolean(l.learnerId || l.homeLearningHouseholdId || l.clubMembershipId);
        return {
          id: l.id,
          what: bootcamp ? bootcamp.name : INTEREST[l.interestedIn] || l.interestedIn || "Enquiry",
          kind: bootcamp ? "bootcamp" : l.interestedIn || null,
          bootcampId: bootcamp?.id || null,
          dates: bootcamp?.startDate ? { start: bootcamp.startDate, end: bootcamp.endDate } : null,
          childName: l.learnerName || null,
          outcome: signedUp ? "signed_up" : "enquiry",
          paid: l.paidAt ? true : l.invoiceId ? false : null,
          status: l.status,
          createdAt: l.createdAt,
        };
      });
    }

    return { details, login, children, hiddenChildren: family.length - shown.length, signups };
  },
};

module.exports = LearnerParentService;
