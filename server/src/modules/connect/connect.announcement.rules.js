// Connect → Announcements (26 Nov 2026): the rules, with no database, so they can be tested
// (test/connect-announcements.test.js). The service is connect.announcements.js.

// Who an announcement can go to. Each login falls into one group (general-events' audienceGroupOf),
// which is also their comment thread: a group only ever sees its own comments, so parents never
// read children's and educators never read parents'.
const GROUPS = [
  { key: "educators", label: "Educators and mentors", base: "/teacher-portal" },
  { key: "parents", label: "Parents", base: "/parent" },
  { key: "learners", label: "Learners (children's own logins)", base: "/learner-portal" },
  { key: "hubs", label: "Learning hubs", base: "/school-portal" },
  { key: "supervisors", label: "Supervisors", base: "/supervisor-portal" },
  { key: "staff", label: "Admins and staff", base: "" },
  { key: "affiliates", label: "Affiliates", base: "/affiliate-portal" },
];
const GROUP_KEYS = GROUPS.map((g) => g.key);
const groupLabel = (key) => GROUPS.find((g) => g.key === key)?.label || key;
// Groups a hub (or class) choice narrows. The others belong to the whole workspace.
const HUB_GROUPS = new Set(["educators", "parents", "learners", "hubs"]);
const CLASS_GROUPS = new Set(["educators", "parents", "learners"]);

const REACTIONS = ["like", "love", "celebrate", "idea", "thanks"];

const uniq = (list, max) => [...new Set((Array.isArray(list) ? list : []).map((v) => String(v || "").trim()).filter(Boolean))].slice(0, max);

// What's kept of the audience the form sends.
function cleanAudience(input = {}) {
  return {
    groups: uniq(input.groups, GROUP_KEYS.length).filter((g) => GROUP_KEYS.includes(g)),
    hubIds: uniq(input.hubIds, 300),
    classIds: uniq(input.classIds, 500),
  };
}

// Problems with an announcement before it's saved, in plain words.
function announcementProblems(a, now = new Date()) {
  const out = [];
  if (!String(a.title || "").trim()) out.push("Give it a title");
  if (!a.audience?.groups?.length) out.push("Choose who it's for");
  if (a.linkUrl && !/^https?:\/\//i.test(a.linkUrl)) out.push("The button's link must start with http:// or https://");
  if (a.linkUrl && !String(a.linkLabel || "").trim()) out.push("Give the button a label");
  if (a.endsAt && new Date(a.endsAt) <= now) out.push("The end date has to be in the future");
  if (a.endsAt && a.publishAt && new Date(a.endsAt) <= new Date(a.publishAt)) out.push("It has to end after it goes out");
  return out;
}

// Where it stands: scheduled (not out yet), live, ended — or deleted.
function stateOf(a, now = new Date()) {
  if (a.deletedAt) return "deleted";
  if (a.status === "scheduled") return "scheduled";
  if (a.status === "ended" || a.endedAt || (a.endsAt && new Date(a.endsAt) <= now)) return "ended";
  return "live";
}

// May this recipient react / comment / confirm now? A child who only got the bell (channel
// "notice") never engages; nothing is taken after it ends.
function canEngage(a, recipient, what, now = new Date()) {
  if (!recipient || recipient.channel !== "feed") return false;
  if (stateOf(a, now) !== "live") return false;
  if (what === "react") return !!a.allowReactions;
  if (what === "comment") return !!a.allowComments;
  if (what === "ack") return !!a.askAck;
  return false;
}

// Where a person opens it, in their own portal.
function routeFor(group, id) {
  const base = GROUPS.find((g) => g.key === group)?.base ?? "";
  return `${base}/announcements/${id}`;
}

// The plain-text gist of rich text (bell message, email, list preview).
function summaryText(html, max = 220) {
  const text = String(html || "")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

// Pinned first, then newest out first.
function sortForReaders(list) {
  return [...list].sort((a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
}

module.exports = { GROUPS, GROUP_KEYS, HUB_GROUPS, CLASS_GROUPS, REACTIONS, groupLabel, cleanAudience, announcementProblems, stateOf, canEngage, routeFor, summaryText, sortForReaders };
