// What needs someone's attention in a household — shown as chips on the list rows, as the
// "Needs attention" filters above the list, and as alert counts on the family page's tabs.

const sameEmail = (a, b) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();

// Children whose profile names a different parent email from the household's — grouped by that
// parent. Their portal login reaches the child but not this household's invoices.
export function profileParentMismatches(household) {
  const byEmail = new Map();
  for (const item of household.learners || []) {
    const learner = item.learner;
    if (item.status === "removed" || !learner?.guardianEmail || sameEmail(learner.guardianEmail, household.guardianEmail)) continue;
    const key = learner.guardianEmail.trim().toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, { name: learner.guardianName, email: learner.guardianEmail, phone: learner.guardianPhone, children: [] });
    byEmail.get(key).children.push(learner.firstName);
  }
  return [...byEmail.values()];
}

// A child who signed up on the website has no curriculum until the admin places them.
export const isUnplaced = (item) => item.status !== "removed" && !item.curriculumId;
// A placed child's class with no weekly lessons on its timetable.
export const lacksTimetable = (item) => item.status === "active" && !!item.curriculumId && !!item.classId && !item.slotCount;

export const FLAGS = [
  { key: "payment", label: "Awaiting payment", short: "Awaiting payment", test: (h) => h.source === "website" && h.status === "pending" },
  { key: "place", label: "Children to place", short: "To place", count: (h) => (h.learners || []).filter(isUnplaced).length },
  { key: "timetable", label: "No timetable", short: "No timetable", count: (h) => (h.learners || []).filter(lacksTimetable).length },
  { key: "overdue", label: "Overdue", short: "Overdue", test: (h) => !!h.billing?.overdue },
  { key: "parent", label: "Parent mismatch", short: "Parent mismatch", test: (h) => profileParentMismatches(h).length > 0 },
];

// How many of each thing this household has (0 = nothing to do).
export function householdFlags(household) {
  const out = {};
  for (const flag of FLAGS) out[flag.key] = flag.count ? flag.count(household) : flag.test(household) ? 1 : 0;
  return out;
}

export const FLAG_TONES = {
  payment: { color: "#1D4ED8", background: "#EFF6FF" },
  place: { color: "#B45309", background: "#FFFBEB" },
  timetable: { color: "#B45309", background: "#FFFBEB" },
  overdue: { color: "#B91C1C", background: "#FEF2F2" },
  parent: { color: "#92400E", background: "#FFF7E8" },
};
