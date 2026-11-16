const db = require("../../config/db");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const HouseholdModel = require("../home-learning/home-learning.model");
const ClubMembershipModel = require("../tech-clubs/club.model");
const { PathwaySubscriptionModel } = require("../pathway-subscriptions/pathway-subscription.model");
const { kenyaToday } = require("../../shared/utils/age");
const { accessAfterLeaving, leavesEmpty } = require("./learner-move.rules");

// The places a learner holds in this workspace, one per programme record, and how each ends.
//   - home_learning: their Home Learning enrolment (one per child), in a household
//   - tech_club:     a child row of a club membership
//   - pathway:       a child row of a pathway subscription (with its classless hub link)
//   - bootcamp:      a hub link whose class is a bootcamp run's cohort class
//   - hub:           any other hub link (a school or hub class, or a hub with no class)
// A place already ended (link "transferred", enrolment / child "removed") isn't listed.
// Ending is never a delete: the hub link goes "transferred" and leaves its class (class rosters
// read links without looking at their status), the programme's own row is marked removed through
// its own code, and the learner's history stays theirs.

const classLabel = (cls) => (cls ? [cls.gradeName, cls.streamName].filter(Boolean).join(" · ") || "Class" : null);
const fullName = (l) => [l?.firstName, l?.lastName].filter(Boolean).join(" ");

async function workspaceHubs(ownerAdminId) {
  return new Map((await LearningHubModel.findAll({ ownerAdminId, includeDrafts: true })).map((h) => [h.id, h]));
}

async function placesOf(ownerAdminId, learnerId) {
  const hubs = await workspaceHubs(ownerAdminId);
  const links = (await LearnerHubLinkModel.findByLearnerId(learnerId)).filter((l) => hubs.has(l.hubId));
  const consumed = new Set(); // hub link ids that belong to a programme place
  const places = [];

  const classIds = [...new Set(links.map((l) => l.classId).filter(Boolean))];

  // Home Learning
  const hlRows = (await HouseholdModel.findEnrollmentsByLearner(learnerId)).filter((e) => e.ownerAdminId === ownerAdminId && e.status !== "removed");
  for (const e of hlRows) {
    const household = await HouseholdModel.findById(e.householdId, ownerAdminId);
    if (!household) continue;
    const link = links.find((l) => hubs.get(l.hubId)?.isHomeLearning);
    if (link) consumed.add(link.id);
    if (e.classId) classIds.push(e.classId);
    places.push({
      key: `hl:${household.id}`, programme: "home_learning", recordId: household.id,
      label: `${household.guardianName}'s household`, detail: null,
      hubId: link?.hubId || null, classId: e.classId || null, curriculumId: e.curriculumId || null,
      // The place counts as active only while the household is too.
      status: e.status === "active" ? household.status : e.status,
      activeChildren: await HouseholdModel.countActive(household.id, ownerAdminId),
      containerStatus: household.status,
    });
  }

  // Tech Clubs
  for (const child of await ClubMembershipModel.findChildrenByLearner(learnerId)) {
    if (child.ownerAdminId !== ownerAdminId || child.status !== "active") continue;
    const membership = await ClubMembershipModel.findById(child.membershipId, ownerAdminId);
    if (!membership || membership.status === "cancelled") continue;
    const link = links.find((l) => l.hubId === membership.hubId);
    if (link) consumed.add(link.id);
    if (child.classId) classIds.push(child.classId);
    places.push({
      key: `club:${membership.id}`, programme: "tech_club", recordId: membership.id,
      label: hubs.get(membership.hubId)?.name || "A club", detail: null, classIdForLabel: child.classId || null,
      hubId: membership.hubId, classId: child.classId || null,
      status: membership.status === "active" ? "active" : membership.status,
      activeChildren: await ClubMembershipModel.countActiveChildren(membership.id, ownerAdminId),
      containerStatus: membership.status,
    });
  }

  // Pathway plans
  for (const sub of await PathwaySubscriptionModel.subscriptionsOfLearner(learnerId)) {
    if (sub.ownerAdminId !== ownerAdminId || sub.childStatus !== "active" || sub.status === "cancelled") continue;
    const link = links.find((l) => l.hubId === sub.hubId && !l.classId);
    if (link) consumed.add(link.id);
    const plan = sub.packageId ? await db("pathway_packages").where({ id: sub.packageId }).first("name") : null;
    places.push({
      key: `pathway:${sub.id}`, programme: "pathway", recordId: sub.id,
      label: sub.pathwayName, detail: [plan?.name, hubs.get(sub.hubId)?.name].filter(Boolean).join(" · ") || null,
      hubId: sub.hubId || null, classId: null, curriculumId: sub.curriculumId, pathwayTemplateId: sub.pathwayTemplateId,
      status: sub.status === "active" ? "active" : sub.status,
      activeChildren: (await PathwaySubscriptionModel.activeLearnerIds(sub.id)).length,
      containerStatus: sub.status,
      accessUntil: sub.accessUntil || null,
    });
  }

  // Everything else: hub links — a bootcamp run's cohort class, or a hub / school class.
  const rest = links.filter((l) => !consumed.has(l.id) && l.status !== "transferred" && !hubs.get(l.hubId)?.isHomeLearning);
  const runs = rest.length ? await db("bootcamp_hubs").whereIn("hubId", rest.map((l) => l.hubId)).select("bootcampId", "hubId", "classIds") : [];
  const bootcampIds = [...new Set(runs.map((r) => r.bootcampId))];
  const bootcamps = new Map((bootcampIds.length ? await db("bootcamps").whereIn("id", bootcampIds).select("id", "name") : []).map((b) => [b.id, b]));
  const runOf = (link) => {
    if (!link.classId) return null;
    return runs.find((r) => {
      const ids = Array.isArray(r.classIds) ? r.classIds : (() => { try { return JSON.parse(r.classIds || "[]"); } catch { return []; } })();
      return r.hubId === link.hubId && ids.includes(link.classId);
    }) || null;
  };
  for (const link of rest) {
    const run = runOf(link);
    const hubName = hubs.get(link.hubId)?.name || "A hub";
    places.push({
      key: `link:${link.hubId}`, programme: run ? "bootcamp" : "hub", recordId: run ? run.bootcampId : link.hubId,
      label: run ? `${bootcamps.get(run.bootcampId)?.name || "A bootcamp"} — ${hubName}` : hubName, detail: null, classIdForLabel: link.classId || null,
      hubId: link.hubId, classId: link.classId || null,
      status: link.status || "active", activeChildren: null, containerStatus: null,
    });
  }

  // Class names and curricula, in one go.
  const allClassIds = [...new Set([...classIds, ...places.map((p) => p.classId)].filter(Boolean))];
  const classes = new Map((allClassIds.length ? await db("classes").whereIn("id", allClassIds).select("id", "gradeName", "streamName", "curriculumId") : []).map((c) => [c.id, c]));
  for (const p of places) {
    const cls = classes.get(p.classId);
    if (cls && !p.curriculumId) p.curriculumId = cls.curriculumId || null;
    if (!p.detail) p.detail = cls ? classLabel(cls) : (p.programme === "tech_club" ? "Awaiting a class" : p.programme === "hub" ? "No class" : null);
    delete p.classIdForLabel;
    p.leavesEmpty = leavesEmpty(p);
  }
  return places;
}

// Ends one place. `stop`: the household / membership / subscription it leaves empty is cancelled
// too (no billing for nobody). Returns what the move record says it left.
async function endPlace(ctx, place, { stop = false } = {}) {
  const { ownerAdminId, learner, req } = ctx;
  const link = place.hubId ? await LearnerHubLinkModel.findOne(learner.id, place.hubId) : null;
  const from = {
    programme: place.programme, recordId: place.recordId, hubId: place.hubId || null, classId: place.classId || link?.classId || null,
    admissionNumber: link?.admissionNumber || null, label: [place.label, place.detail].filter(Boolean).join(" · "),
  };
  const endLink = async () => {
    const current = place.hubId ? await LearnerHubLinkModel.findOne(learner.id, place.hubId) : null;
    if (current) await LearnerHubLinkModel.update(current.id, { status: "transferred", classId: null });
  };

  if (place.programme === "hub" || place.programme === "bootcamp") {
    await endLink();
  } else if (place.programme === "home_learning") {
    const HomeLearningService = require("../home-learning/home-learning.service");
    await HomeLearningService.removeEnrollment(ownerAdminId, place.recordId, learner.id);
    await endLink();
    if (stop && place.leavesEmpty && place.containerStatus !== "cancelled") {
      await HomeLearningService.update(ownerAdminId, place.recordId, { status: "cancelled" });
    }
  } else if (place.programme === "tech_club") {
    const ClubService = require("../tech-clubs/club.service");
    await ClubService.removeChild(ownerAdminId, place.recordId, learner.id);
    await endLink();
    if (stop && place.leavesEmpty && place.containerStatus !== "cancelled") {
      await ClubService.update(ownerAdminId, place.recordId, { status: "cancelled" });
    }
  } else if (place.programme === "pathway") {
    const sub = await PathwaySubscriptionModel.findById(place.recordId, ownerAdminId);
    await db("pathway_subscription_children").where({ subscriptionId: place.recordId, learnerId: learner.id }).update({ status: "removed", updatedAt: new Date() });
    // They keep what was paid for: the access row is cut loose from the subscription (so its later
    // periods, lapses and cancellation no longer move it), ending with the last paid period.
    const today = kenyaToday();
    for (const row of await db("learner_pathway_access").where({ learnerId: learner.id, subscriptionId: place.recordId })) {
      await db("learner_pathway_access").where({ id: row.id }).update({
        subscriptionId: null,
        accessUntil: accessAfterLeaving({ rowAccessUntil: row.accessUntil, paidUntil: sub?.accessUntil || null, today }),
        updatedAt: new Date(),
      });
    }
    if (link && !link.classId) await endLink();
    if (stop && place.leavesEmpty && sub && sub.status !== "cancelled") {
      await require("../pathway-subscriptions/pathway-subscription.service").setStatus(ownerAdminId, sub.id, "cancelled", req.user.id);
    }
  }
  return from;
}

module.exports = { placesOf, endPlace, workspaceHubs, classLabel, fullName };
