// Competition entry and registration rules (20 Nov 2026) — pure, tested in
// test/competition-registrations.test.js. The user's choices: individuals and groups can both
// enter; one person registers a whole team; a team pays one fee; prices are set per track; a track
// may still send people to an outside form; registering creates no accounts.
const { slugify } = require("../../shared/utils/slugify");
const { ageFrom, kenyaToday } = require("../../shared/utils/age");

const ENTRY_LABELS = { individual: "Individual", group: "Team" };

// Competitions made before 20 Nov 2026 had one `format`; read it as entry modes.
function entryModesOf(competition) {
  const modes = competition?.info?.entryModes;
  if (Array.isArray(modes) && modes.length) return modes.filter((m) => m === "individual" || m === "group");
  const format = competition?.format;
  if (format === "individual") return ["individual"];
  if (format === "pairs" || format === "team") return ["group"];
  return ["individual", "group"];
}

const priceOrNull = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Math.max(0, Number(v)));

// How a track is entered: its own settings, else the competition's (an old "pairs" competition's
// teams are exactly two). A mode the competition doesn't allow is never open on a track.
function trackEntry(competition, track) {
  const allowed = new Set(entryModesOf(competition));
  const e = track?.entry || {};
  const pairs = !track?.entry && competition?.format === "pairs";
  const teamMin = Math.max(2, Number(e.teamMin) || 2);
  const teamMax = Math.max(teamMin, Number(e.teamMax) || (pairs ? 2 : 5));
  return {
    individual: allowed.has("individual") && e.individual !== false,
    group: allowed.has("group") && e.group !== false,
    teamMin,
    teamMax: pairs ? 2 : teamMax,
    // The competition's fees (Competition information → Entry fees, 20 Nov 2026 — the same for every
    // track); a price saved on a track before then still wins for that track.
    individualPrice: priceOrNull(e.individualPrice) ?? priceOrNull(competition?.info?.individualPrice),
    teamPrice: priceOrNull(e.teamPrice) ?? priceOrNull(competition?.info?.teamPrice),
    currency: e.currency || competition?.info?.currency || "KES",
  };
}

// A track's ages: its own, else the competition's.
function trackAges(competition, track) {
  const pick = (k) => (track?.[k] != null && track[k] !== "" ? Number(track[k]) : competition?.info?.[k] != null && competition.info[k] !== "" ? Number(competition.info[k]) : null);
  return { ageMin: pick("ageMin"), ageMax: pick("ageMax") };
}

// The fee for an entry: the individual price, or one fee per team. Free when no price is set.
function feeFor(entry, entryType) {
  const price = entryType === "group" ? entry.teamPrice : entry.individualPrice;
  return price == null ? 0 : price;
}

// Each track's address on the website (/competitions/:slug/tracks/:trackSlug): from its name,
// with -2, -3 … when two tracks share one.
function trackSlugs(tracks) {
  const seen = new Map();
  return (tracks || []).map((t, i) => {
    const base = slugify(t?.name) || `track-${i + 1}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

// Is registration open today? Status open, inside the registration window when one is set.
function registrationWindow(competition, today = kenyaToday()) {
  if (!competition || competition.status !== "open") return { open: false, reason: "Registration for this competition is closed." };
  if (competition.registrationOpenDate && today < competition.registrationOpenDate) {
    return { open: false, reason: `Registration opens on ${competition.registrationOpenDate}.`, opensOn: competition.registrationOpenDate };
  }
  if (competition.registrationCloseDate && today > competition.registrationCloseDate) {
    return { open: false, reason: "Registration for this competition has closed." };
  }
  return { open: true, closesOn: competition.registrationCloseDate || null };
}

// Everything wrong with a registration, worded for the person filling the form. [] = fine.
function registrationProblems({ competition, track, input, today = kenyaToday() }) {
  const problems = [];
  if (!track) return ["That track isn't part of this competition."];
  if (track.registerUrl) return ["This track takes registrations on its own form — use its Register Now button."];
  const window = registrationWindow(competition, today);
  if (!window.open) return [window.reason];
  const entry = trackEntry(competition, track);
  const type = input.entryType;
  if (type === "individual" && !entry.individual) problems.push("This track is for teams only.");
  if (type === "group" && !entry.group) problems.push("This track is for individuals only.");
  const people = input.participants || [];
  if (type === "individual" && people.length !== 1) problems.push("An individual entry has one participant.");
  if (type === "group") {
    if (!String(input.teamName || "").trim()) problems.push("Give your team a name.");
    if (people.length < entry.teamMin || people.length > entry.teamMax) {
      problems.push(entry.teamMin === entry.teamMax
        ? `A team has exactly ${entry.teamMin} members.`
        : `A team has ${entry.teamMin} to ${entry.teamMax} members.`);
    }
  }
  const { ageMin, ageMax } = trackAges(competition, track);
  const names = new Set();
  people.forEach((p, i) => {
    const who = people.length > 1 ? `${p.name || `Member ${i + 1}`}` : "The participant";
    const age = ageFrom(p.dateOfBirth, today);
    if (age === null) problems.push(`${who}: enter a real date of birth.`);
    else if (ageMin != null && age < ageMin) problems.push(`${who} is ${age} — this track is for ages ${ageMin}${ageMax != null ? `–${ageMax}` : "+"}.`);
    else if (ageMax != null && age > ageMax) problems.push(`${who} is ${age} — this track is for ages ${ageMin != null ? `${ageMin}–` : "up to "}${ageMax}.`);
    const key = String(p.name || "").trim().toLowerCase();
    if (key && names.has(key)) problems.push(`${p.name} is listed twice.`);
    names.add(key);
  });
  return problems;
}

// "CR-2026-000123"
const registrationNumberFor = (year, n) => `CR-${year}-${String(n).padStart(6, "0")}`;

// What the entry is called on the invoice and in lists.
function entryLabel({ entryType, teamName, participants }) {
  if (entryType === "group") return `Team ${teamName || ""}`.trim();
  return participants?.[0]?.name || "Individual entry";
}

module.exports = {
  ENTRY_LABELS,
  entryModesOf,
  trackEntry,
  trackAges,
  feeFor,
  trackSlugs,
  registrationWindow,
  registrationProblems,
  registrationNumberFor,
  entryLabel,
};
