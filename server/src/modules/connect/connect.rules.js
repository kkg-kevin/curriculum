// Digifunzi Connect — every rule that doesn't need the database, in one place (tested in
// test/connect.test.js). The service (connect.service.js and friends) only loads records and calls
// these.

// ── Settings ─────────────────────────────────────────────────────────────────────────────────────
// One row per workspace (connect_settings.settings). Anything missing falls back to these.
const DEFAULT_SETTINGS = Object.freeze({
  // Children under this age have no one-to-one messages (the user's choice, 24 Nov 2026: 13).
  dmMinAge: 13,
  directMessages: true,
  // Group chats a learner starts with their connections (same age rule as one-to-one). Project
  // team chats are always on — that's where under-13s talk.
  groupChats: true,
  // Pictures and files in messages: off | team (project chats only) | all.
  messageFiles: "team",
  // Posts go up straight away (the user's choice, 24 Nov 2026: admins don't approve posts). These
  // stay as switches an admin can turn on: a new member's first N posts wait for a moderator…
  reviewNewMemberPosts: 0,
  // …every post with a picture or file waits for a moderator.
  reviewFiles: false,
  // Every learner post waits for a moderator.
  reviewAll: false,
  // Educators named as Connect moderators may also create communities and challenges.
  educatorsCreate: true,
  // Educators' logins who moderate the whole workspace's Connect (besides admins and staff).
  moderatorUserIds: [],
  // Words refused on top of the built-in list.
  blockedWords: [],
  // Sites learners may link to, on top of the built-in list.
  linkDomains: [],
  // Most posts a learner may send per hour, comments per hour, messages per minute.
  postsPerHour: 10,
  commentsPerHour: 60,
  messagesPerMinute: 20,
});

const MESSAGE_FILE_MODES = ["off", "team", "all"];

function mergeSettings(stored) {
  const s = { ...DEFAULT_SETTINGS, ...(stored && typeof stored === "object" ? stored : {}) };
  s.dmMinAge = clampInt(s.dmMinAge, 8, 18, DEFAULT_SETTINGS.dmMinAge);
  s.reviewNewMemberPosts = clampInt(s.reviewNewMemberPosts, 0, 20, DEFAULT_SETTINGS.reviewNewMemberPosts);
  s.postsPerHour = clampInt(s.postsPerHour, 1, 100, DEFAULT_SETTINGS.postsPerHour);
  s.commentsPerHour = clampInt(s.commentsPerHour, 1, 300, DEFAULT_SETTINGS.commentsPerHour);
  s.messagesPerMinute = clampInt(s.messagesPerMinute, 1, 120, DEFAULT_SETTINGS.messagesPerMinute);
  if (!MESSAGE_FILE_MODES.includes(s.messageFiles)) s.messageFiles = DEFAULT_SETTINGS.messageFiles;
  for (const key of ["directMessages", "groupChats", "reviewFiles", "reviewAll", "educatorsCreate"]) s[key] = !!s[key];
  s.moderatorUserIds = uniqueStrings(s.moderatorUserIds);
  s.blockedWords = uniqueStrings(uniqueStrings(s.blockedWords).map((w) => w.toLowerCase())).slice(0, 300);
  s.linkDomains = uniqueStrings(s.linkDomains).map((d) => d.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)).slice(0, 100);
  return s;
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function uniqueStrings(list) {
  return [...new Set((Array.isArray(list) ? list : []).map((x) => String(x || "").trim()).filter(Boolean))];
}

// ── Catalogues ───────────────────────────────────────────────────────────────────────────────────
// Interests and skills are picked from this list, never typed — nothing personal can hide in them.
const INTERESTS = [
  { key: "python", label: "Python" },
  { key: "scratch", label: "Scratch & block coding" },
  { key: "robotics", label: "Robotics" },
  { key: "ai", label: "Artificial intelligence" },
  { key: "games", label: "Game development" },
  { key: "web", label: "Web development" },
  { key: "apps", label: "Mobile apps" },
  { key: "electronics", label: "Electronics & Arduino" },
  { key: "3d", label: "3D design & printing" },
  { key: "data", label: "Data & science" },
  { key: "art", label: "Digital art & design" },
  { key: "music", label: "Music & sound" },
  { key: "animation", label: "Animation & video" },
  { key: "maths", label: "Maths puzzles" },
  { key: "environment", label: "Environment & green tech" },
  { key: "entrepreneurship", label: "Young entrepreneurs" },
];
const INTEREST_KEYS = INTERESTS.map((i) => i.key);

const CATEGORIES = [
  { key: "general", label: "General discussions" },
  { key: "projects", label: "Projects & creations" },
  { key: "questions", label: "Questions & help" },
  { key: "achievements", label: "Achievements" },
  { key: "ideas", label: "Ideas & innovations" },
  // Only staff post announcements.
  { key: "announcement", label: "Announcements", staffOnly: true },
];
const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
const LEARNER_CATEGORY_KEYS = CATEGORIES.filter((c) => !c.staffOnly).map((c) => c.key);

const REACTIONS = ["like", "love", "wow", "idea", "clap"];

const PROJECT_CATEGORIES = [
  { key: "robotics", label: "Robotics" },
  { key: "game", label: "Game" },
  { key: "app", label: "App" },
  { key: "website", label: "Website" },
  { key: "ai", label: "AI / machine learning" },
  { key: "electronics", label: "Electronics" },
  { key: "animation", label: "Animation / story" },
  { key: "science", label: "Science / data" },
  { key: "other", label: "Something else" },
];
const PROJECT_CATEGORY_KEYS = PROJECT_CATEGORIES.map((c) => c.key);
const PROJECT_STATUSES = ["idea", "building", "testing", "done"];
const PROJECT_TEAM_MAX = 8;

const CHALLENGE_KINDS = [
  { key: "coding", label: "Coding" },
  { key: "robotics", label: "Robotics" },
  { key: "ai", label: "AI" },
  { key: "design", label: "Design" },
  { key: "showcase", label: "Project showcase" },
  { key: "other", label: "Other" },
];
const CHALLENGE_KIND_KEYS = CHALLENGE_KINDS.map((c) => c.key);
const AWARDS = ["winner", "runner_up", "commended", "participant"];

const REPORT_REASONS = [
  { key: "unkind", label: "Unkind or bullying" },
  { key: "inappropriate", label: "Not right for children" },
  { key: "personal_info", label: "Shares personal details" },
  { key: "unsafe", label: "Makes me feel unsafe" },
  { key: "spam", label: "Spam or the same thing again and again" },
  { key: "other", label: "Something else" },
];
const REPORT_REASON_KEYS = REPORT_REASONS.map((r) => r.key);

// The communities a workspace starts with (created once, the first time Connect is opened there).
const DEFAULT_COMMUNITIES = [
  { slug: "python-developers", name: "Python Developers", icon: "code", color: "#25476a", topics: ["python", "data"], description: "Share Python programs, ask for help with bugs and try each other's code puzzles." },
  { slug: "robotics-enthusiasts", name: "Robotics Enthusiasts", icon: "cpu", color: "#2e7db5", topics: ["robotics", "electronics"], description: "Robots, sensors, motors and the things you build with them." },
  { slug: "ai-explorers", name: "Artificial Intelligence Explorers", icon: "zap", color: "#38aae1", topics: ["ai", "data"], description: "Teach machines to see, hear and decide — and talk about doing it safely and fairly." },
  { slug: "game-developers", name: "Game Developers", icon: "play", color: "#feb139", topics: ["games", "scratch", "art"], description: "Make games, share them, play-test each other's and swap ideas for levels and characters." },
  { slug: "web-development", name: "Web Development", icon: "globe", color: "#1a3550", topics: ["web", "apps"], description: "HTML, CSS, JavaScript and the websites and apps you make with them." },
  { slug: "young-innovators", name: "Young Innovators", icon: "sun", color: "#2e7db5", topics: ["entrepreneurship", "environment"], description: "Ideas that solve real problems at home, at school and in your community." },
  { slug: "scratch-creators", name: "Scratch Creators", icon: "box", color: "#feb139", topics: ["scratch", "animation", "games"], description: "Stories, animations and games made with blocks." },
];

// ── Names ────────────────────────────────────────────────────────────────────────────────────────
// What other learners call someone by default: first name and last initial ("Amani K.").
function shortName(firstName, lastName) {
  const first = String(firstName || "").trim().split(/\s+/)[0] || "Learner";
  const initial = String(lastName || "").trim().charAt(0);
  return (initial ? `${first} ${initial.toUpperCase()}.` : first).slice(0, 40);
}

const pairKey = (a, b) => [String(a), String(b)].sort().join(":");

// ── Safety: personal details, contact moves, unkind words, links ─────────────────────────────────
// Children may not share how to find or contact them. Checked on everything a learner writes; the
// message says which kind of thing was found, never repeats it.
const NUMBER_WORDS = new Set([
  "zero", "oh", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "sifuri", "moja", "mbili", "tatu", "nne", "tano", "sita", "saba", "nane", "tisa",
]);

const CONTACT_PATTERNS = [
  /\b(whats\s*app|watsapp|whatsap|telegram|snap\s*chat|snap\s+me|insta(gram)?|tik\s*tok|facebook|messenger|discord|signal\s+me|wechat|imo\s+me)\b/i,
  /\b(call|text|sms|ring|phone|beep|flash)\s+me\b/i,
  /\bmy\s+(phone|number|no\.?|digits|mobile|cell)\b/i,
  /\b(add|follow|dm|message|find)\s+me\s+(on|at)\b/i,
];

const ADDRESS_PATTERNS = [
  /\bi\s+live\s+(at|in|on|near|next\s+to|opposite)\b/i,
  /\bmy\s+(house|home|address|estate|apartment|flat|plot|gate|street|road|school|village)\s+(is|at|in|near|number|no)\b/i,
  /\b(house|plot|apartment|flat|hse)\s*(no\.?|number|#)\s*\d+/i,
  /\bp\.?\s*o\.?\s*box\b/i,
  /\b(meet|see)\s+(me|you|up)\s+(at|in|near|after|outside|tomorrow|tonight|on)\b/i,
  /\blet'?s\s+meet\b/i,
  /\bcome\s+to\s+my\s+(house|home|place)\b/i,
];

const UNKIND_PATTERNS = [
  /\bkill\s+(your|ur)\s*self\b/i,
  /\bk\s*y\s*s\b/i,
  /\bgo\s+die\b/i,
  /\bnobody\s+likes\s+you\b/i,
];

// A short built-in list (English and Swahili). Admins add their own in Settings.
const BUILT_IN_WORDS = [
  "fuck", "fucking", "fucker", "shit", "bitch", "bastard", "asshole", "arsehole", "dick", "pussy", "cunt", "slut", "whore",
  "nigger", "nigga", "faggot", "retard", "porn", "sexy", "nude", "nudes",
  "malaya", "kuma", "mkundu", "msenge", "kumamako", "kumanyoko", "matako", "mboro",
];

const LEET = { "@": "a", 4: "a", 0: "o", 1: "i", "!": "i", 3: "e", $: "s", 5: "s", 7: "t" };

function normaliseForWords(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[@4013!$57]/g, (c) => LEET[c] || c)
    .replace(/(.)\1{2,}/g, "$1$1"); // "fuuuuck" → "fuuck"
}

const BUILT_IN_DOMAINS = [
  "scratch.mit.edu", "github.com", "gitlab.com", "replit.com", "youtube.com", "youtu.be", "code.org",
  "makecode.microbit.org", "makecode.com", "microbit.org", "tinkercad.com", "trinket.io", "codepen.io",
  "wokwi.com", "pictoblox.ai", "thestempedia.com", "appinventor.mit.edu", "khanacademy.org", "wikipedia.org",
  "digifunzi.com",
];

const URL_PATTERN = /\b((https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|org|net|io|ai|edu|co|ke|me|app|dev|ly|gg|tv|info|xyz|be)(\/[^\s]*)?)/gi;

function domainAllowed(host, extraDomains = []) {
  const h = String(host || "").toLowerCase().replace(/^www\./, "");
  return [...BUILT_IN_DOMAINS, ...extraDomains].some((d) => h === d || h.endsWith(`.${d}`));
}

// A link a learner may add to a post / project: https, on an allowed site. Returns the cleaned
// link, or null.
function allowedLink(value, extraDomains = []) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (!domainAllowed(url.hostname, extraDomains)) return null;
  url.protocol = "https:";
  return url.toString().slice(0, 500);
}

function hasPhoneNumber(text) {
  // Digits with spaces, dots, dashes or brackets between them count as one number.
  const squashed = String(text || "").replace(/(\d)[\s().-]+(?=\d)/g, "$1");
  if (/\+?\d{9,}/.test(squashed)) return true;
  // "zero seven one two …" — seven number words in a row.
  const words = String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let run = 0;
  for (const w of words) {
    run = NUMBER_WORDS.has(w) || /^\d$/.test(w) ? run + 1 : 0;
    if (run >= 7) return true;
  }
  return false;
}

// A real address ("amani@mail.com" — spaces round the @ allowed, not round the dot, so "@Ken. Thanks"
// isn't one), a spelled-out one ("amani at yahoo dot com" — the word "dot" is needed, so "stops at
// obstacles. Built…" isn't one), or a mail provider named.
const hasEmail = (text) =>
  /[a-z0-9._%+-]+\s?@\s?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/i.test(text)
  || /[a-z0-9._%+-]+\s*(\(at\)|\[at\]|\sat\s)\s*[a-z0-9-]+\s*(\(dot\)|\[dot\]|\sdot\s)\s*[a-z]{2,}/i.test(text)
  || /\b(gmail|yahoo|hotmail|outlook|icloud|ymail)\b/i.test(text);

// The first problem found in `text`, or null. `kind` is one of personal_info, contact, address,
// unkind, words, link.
function checkText(text, { blockedWords = [], linkDomains = [] } = {}) {
  const value = String(text || "");
  if (!value.trim()) return null;
  if (hasEmail(value)) return { kind: "personal_info", message: "That looks like an email address. To keep everyone safe, Connect doesn't allow sharing email addresses." };
  if (hasPhoneNumber(value)) return { kind: "personal_info", message: "That looks like a phone number. To keep everyone safe, Connect doesn't allow sharing phone numbers." };
  if (CONTACT_PATTERNS.some((p) => p.test(value))) return { kind: "contact", message: "Keep chats on Connect — please don't ask people to contact you on other apps or by phone." };
  if (ADDRESS_PATTERNS.some((p) => p.test(value))) return { kind: "address", message: "Please don't share where you live or go to school, or plan to meet up. Keep your location private." };
  if (UNKIND_PATTERNS.some((p) => p.test(value))) return { kind: "unkind", message: "That could really hurt someone. Connect is a kind place — please change what you wrote." };
  const normal = normaliseForWords(value);
  const tokens = new Set(normal.split(/[^a-z]+/).filter(Boolean));
  const words = [...BUILT_IN_WORDS, ...blockedWords];
  const bad = words.find((w) => (w.includes(" ") ? normal.includes(w) : tokens.has(w)));
  if (bad) return { kind: "words", message: "Some words in that aren't allowed on Connect. Please change what you wrote." };
  for (const match of value.matchAll(URL_PATTERN)) {
    const candidate = match[0];
    // "e.g." and numbers like "3.5" aren't links; only things with a known ending reach here.
    let host = candidate.replace(/^https?:\/\//i, "").split("/")[0];
    if (!domainAllowed(host, linkDomains)) {
      return { kind: "link", message: "Links are only allowed to learning sites like Scratch, GitHub or YouTube. Remove the link to post this." };
    }
  }
  return null;
}

// ── Messages: who may talk to whom ───────────────────────────────────────────────────────────────
// One-to-one: messages switched on (Settings and the parent's switch), connected, nobody blocked.
// No age limit (the user removed it, 26 Nov 2026): parents can read every message instead.
function directMessageBlocker({ settings, myAge, otherAge, me, other, connected, blocked }) {
  const s = mergeSettings(settings);
  const name = other?.displayName || "They";
  if (!s.directMessages) return "One-to-one messages are switched off on Connect.";
  if (!me?.directMessages) return "Your parent has switched one-to-one messages off for you.";
  if (blocked) return `You can't message ${name}.`;
  if (!other?.directMessages) return `${name} can't have one-to-one messages. You can work together in a project team.`;
  if (!connected) return `Connect with ${name} first — once they say yes you can message each other.`;
  return null;
}

// A group chat a learner starts: the same rule for them and every person they add.
function groupChatBlocker({ settings, myAge, me, others }) {
  const s = mergeSettings(settings);
  if (!s.groupChats || !s.directMessages) return "Group chats are switched off on Connect. You can chat with your project teams.";
  if (!me?.directMessages) return "Your parent has switched messages with other learners off for you.";
  for (const o of others) {
    const reason = directMessageBlocker({ settings: s, myAge, otherAge: o.age, me, other: o.member, connected: o.connected, blocked: o.blocked });
    if (reason) return reason;
  }
  return null;
}

// May a picture / file go into this conversation?
function messageFilesAllowed(settings, conversationKind) {
  const mode = mergeSettings(settings).messageFiles;
  if (mode === "all") return true;
  if (mode === "team") return conversationKind === "project";
  return false;
}

// ── Posts that wait for a moderator ──────────────────────────────────────────────────────────────
// Why a learner's post waits, or null when it goes straight up.
function reviewReason({ settings, postsSent = 0, hasFiles = false }) {
  const s = mergeSettings(settings);
  if (s.reviewAll) return "Every post is checked by a teacher before others see it.";
  if (s.reviewFiles && hasFiles) return "Posts with pictures or files are checked by a teacher first.";
  if (postsSent < s.reviewNewMemberPosts) return "Your first posts are checked by a teacher before others see them.";
  return null;
}

// ── Badges (Connect's own) ───────────────────────────────────────────────────────────────────────
const BADGES = {
  first_post: { label: "First post", description: "Shared something with the community", icon: "edit-3" },
  helper: { label: "Helper", description: "Answered 5 questions", icon: "life-buoy" },
  team_player: { label: "Team player", description: "In a project team of two or more", icon: "users" },
  maker: { label: "Maker", description: "Finished a project", icon: "tool" },
  showcase: { label: "Showcased", description: "A project chosen for the showcase", icon: "star" },
  challenger: { label: "Challenger", description: "Took part in a challenge", icon: "flag" },
  champion: { label: "Champion", description: "Won or placed in a challenge", icon: "award" },
  connector: { label: "Connector", description: "Made 5 connections", icon: "link" },
  explorer: { label: "Explorer", description: "Joined 3 communities", icon: "compass" },
  crowd_pleaser: { label: "Crowd pleaser", description: "A post with 10 reactions", icon: "heart" },
};

// Which badges these figures earn.
function badgesEarned(stats = {}) {
  const earned = [];
  const add = (key, ok) => ok && earned.push(key);
  add("first_post", (stats.posts || 0) >= 1);
  add("helper", (stats.answers || 0) >= 5);
  add("team_player", (stats.teamProjects || 0) >= 1);
  add("maker", (stats.doneProjects || 0) >= 1);
  add("showcase", (stats.showcased || 0) >= 1);
  add("challenger", (stats.challenges || 0) >= 1);
  add("champion", (stats.awards || 0) >= 1);
  add("connector", (stats.connections || 0) >= 5);
  add("explorer", (stats.communities || 0) >= 3);
  add("crowd_pleaser", (stats.bestReactions || 0) >= 10);
  return earned;
}

// ── Avatars ──────────────────────────────────────────────────────────────────────────────────────
const AVATAR_ICONS = ["smile", "star", "zap", "cpu", "code", "rocket", "sun", "moon", "music", "feather", "globe", "box", "compass", "anchor", "heart", "aperture"];
const AVATAR_COLORS = ["#25476a", "#2e7db5", "#38aae1", "#feb139", "#1a3550", "#7A4F00", "#1F6F9E", "#4B5563"];

// The drawn avatar a learner picks — shown only when they have no profile photo (a learner's profile
// photo is always their Connect picture: the user's choice, 24 Nov 2026).
function cleanAvatar(value) {
  const icon = AVATAR_ICONS.includes(value?.icon) ? value.icon : "smile";
  const color = AVATAR_COLORS.includes(value?.color) ? value.color : AVATAR_COLORS[0];
  return { icon, color };
}

// A default avatar from the learner id, so two new members rarely look the same.
function defaultAvatar(seed) {
  let h = 0;
  for (const c of String(seed || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { icon: AVATAR_ICONS[h % AVATAR_ICONS.length], color: AVATAR_COLORS[(h >> 4) % AVATAR_COLORS.length] };
}

// ── Challenges ───────────────────────────────────────────────────────────────────────────────────
// Whether a challenge takes entries today ("YYYY-MM-DD" Kenyan dates).
function challengeOpen(challenge, today) {
  if (!challenge || challenge.status !== "open") return false;
  const start = challenge.startsOn ? String(challenge.startsOn).slice(0, 10) : null;
  const end = challenge.endsOn ? String(challenge.endsOn).slice(0, 10) : null;
  if (start && today < start) return false;
  if (end && today > end) return false;
  return true;
}

// Why this entry can't be made, or null.
function entryProblem({ challenge, mode, teamSize = 1 }) {
  const m = challenge.entryMode || "individual";
  if (mode === "individual" && m === "team") return "This challenge is for teams — enter with a project team.";
  if (mode === "team" && m === "individual") return "This challenge is for individuals.";
  if (mode === "team") {
    if (challenge.teamMin && teamSize < challenge.teamMin) return `Teams need at least ${challenge.teamMin} people.`;
    if (challenge.teamMax && teamSize > challenge.teamMax) return `Teams can have at most ${challenge.teamMax} people.`;
  }
  return null;
}

// ── Paging ───────────────────────────────────────────────────────────────────────────────────────
// A cursor is the last item's createdAt + id, so new posts arriving never shift a page.
function encodeCursor(row) {
  if (!row) return null;
  return Buffer.from(`${new Date(row.createdAt).toISOString()}|${row.id}`).toString("base64url");
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const [at, id] = Buffer.from(String(cursor), "base64url").toString().split("|");
    const date = new Date(at);
    if (!id || Number.isNaN(date.getTime())) return null;
    return { createdAt: date, id };
  } catch {
    return null;
  }
}

module.exports = {
  DEFAULT_SETTINGS, mergeSettings, MESSAGE_FILE_MODES,
  INTERESTS, INTEREST_KEYS, CATEGORIES, CATEGORY_KEYS, LEARNER_CATEGORY_KEYS, REACTIONS,
  PROJECT_CATEGORIES, PROJECT_CATEGORY_KEYS, PROJECT_STATUSES, PROJECT_TEAM_MAX,
  CHALLENGE_KINDS, CHALLENGE_KIND_KEYS, AWARDS, REPORT_REASONS, REPORT_REASON_KEYS, DEFAULT_COMMUNITIES,
  BADGES, badgesEarned, AVATAR_ICONS, AVATAR_COLORS, cleanAvatar, defaultAvatar,
  shortName, pairKey, checkText, allowedLink, hasPhoneNumber, hasEmail, domainAllowed,
  directMessageBlocker, groupChatBlocker, messageFilesAllowed, reviewReason,
  challengeOpen, entryProblem, encodeCursor, decodeCursor,
};
