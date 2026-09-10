const LearningHubModel = require("../learning-hubs/learning-hub.model");
const { LEARNING_HUB_TYPES } = require("../learning-hubs/learning-hub.validation");
const { requirePublicContentAdminId } = require("../../shared/utils/public-content");

// The public marketing site's enrolment flow (digifunzi-landing's /enroll) lets a parent pick a
// non-school learning-hub type and see the real operational schedule of matching hubs before
// enrolling. This serves the designated PUBLIC_CONTENT_ADMIN_ID's `active` learning hubs whose
// `hubType` is NOT "school" (schools run their own admissions; the website enrols into the other
// hub types) — same tenant-scoping posture as pathways / projects / store (503 if unset).
//
// The projection is deliberately narrow: name, hubType, a town label, and the schedule
// (opensAt / closesAt / days). No email, no code, no spaces/pricing, no ownerAdminId — nothing
// operational beyond "when is it open".

// Non-school hub types, in a stable display order, with website-friendly labels.
const PUBLIC_HUB_TYPES = LEARNING_HUB_TYPES.filter((t) => t !== "school");

const TYPE_LABELS = {
  co_working_space: "Co-working space",
  innovation_lab: "Innovation lab",
  makerspace: "Makerspace",
  tech_club: "Tech club",
};

const DAY_ORDER = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

// mysql2 auto-parses the `operatingHours` JSON column; a hub that never set it holds null.
function scheduleOf(hub) {
  const h = hub.operatingHours || {};
  const days = Array.isArray(h.days) ? h.days : [];
  return {
    opensAt: h.opensAt || "",
    closesAt: h.closesAt || "",
    // Sorted into week order regardless of how they were stored.
    days: DAY_ORDER.filter((d) => days.includes(d)),
  };
}

function townOf(hub) {
  const a = hub.address || {};
  return [a.city, a.county].filter(Boolean).join(", ");
}

const DELIVERY_LABELS = { in_person: "In person", virtual: "Online", hybrid: "In person or online" };

function projectHub(hub) {
  const deliveryMode = hub.deliveryMode || "in_person";
  const isVirtual = deliveryMode === "virtual";
  return {
    id: hub.id,
    name: hub.name,
    hubType: hub.hubType,
    hubTypeLabel: TYPE_LABELS[hub.hubType] || hub.hubType,
    deliveryMode,
    deliveryLabel: DELIVERY_LABELS[deliveryMode] || deliveryMode,
    isVirtual,
    // A purely virtual hub has no town — it's "Online". A hybrid still has a place.
    town: isVirtual ? "Online" : townOf(hub),
    schedule: scheduleOf(hub),
  };
}

async function activeNonSchoolHubs(hubType) {
  const ownerAdminId = requirePublicContentAdminId();
  const rows = await LearningHubModel.findAll({ ownerAdminId, status: "active" });
  return rows.filter(
    (h) => h.hubType !== "school" && (!hubType || h.hubType === hubType),
  );
}

const PublicHubService = {
  // GET /api/public/hubs/types — the non-school hub types a parent can choose from, each with
  // how many active hubs of that type exist. A type with 0 hubs is still listed (so the picker
  // is stable) but the website can grey it out.
  async listTypes() {
    const hubs = await activeNonSchoolHubs();
    const counts = new Map();
    for (const h of hubs) counts.set(h.hubType, (counts.get(h.hubType) || 0) + 1);
    return PUBLIC_HUB_TYPES.map((type) => ({
      type,
      label: TYPE_LABELS[type] || type,
      hubCount: counts.get(type) || 0,
    }));
  },

  // GET /api/public/hubs?type=<hubType> — the designated admin's active non-school hubs
  // (optionally filtered to one type), newest first, with the schedule. An unknown `type` just
  // yields an empty array.
  async listHubs(hubType) {
    const hubs = await activeNonSchoolHubs(hubType);
    return hubs.map(projectHub).sort((a, b) => a.name.localeCompare(b.name));
  },
};

module.exports = PublicHubService;
