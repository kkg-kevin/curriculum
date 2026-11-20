// Competitions — entry and registration rules (modules/competitions/competition-registration.rules.js)
// and the schemas behind the admin form and the website registration (20 Nov 2026).
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/modules/competitions/competition-registration.rules");
const { createCompetitionSchema, registrationSchema } = require("../src/modules/competitions/competition.validation");

const TODAY = "2026-11-20";
const open = (extra = {}) => ({ status: "open", info: { entryModes: ["individual", "group"] }, ...extra });
const track = (extra = {}) => ({ id: "t1", name: "Innovation", entry: { individual: true, group: true, teamMin: 2, teamMax: 4, individualPrice: 1500, teamPrice: 5000 }, ...extra });
const kid = (name, dateOfBirth = "2014-03-01") => ({ name, dateOfBirth });

test("entry modes: the new list, else read from the old single format", () => {
  assert.deepEqual(R.entryModesOf({ info: { entryModes: ["group"] } }), ["group"]);
  assert.deepEqual(R.entryModesOf({ format: "individual" }), ["individual"]);
  assert.deepEqual(R.entryModesOf({ format: "team" }), ["group"]);
  assert.deepEqual(R.entryModesOf({ format: "pairs" }), ["group"]);
  assert.deepEqual(R.entryModesOf({}), ["individual", "group"]);
});

test("a track's entry follows its own settings within what the competition allows", () => {
  const e = R.trackEntry(open({ info: { entryModes: ["individual"] } }), track());
  assert.equal(e.individual, true);
  assert.equal(e.group, false, "the competition doesn't take groups");
  const old = R.trackEntry({ status: "open", format: "pairs" }, { name: "Old" });
  assert.equal(old.group, true);
  assert.equal(old.teamMin, 2);
  assert.equal(old.teamMax, 2, "an old pairs competition's teams are exactly two");
});

test("fees: the individual price, or one fee per team; free when none is set", () => {
  const e = R.trackEntry(open(), track());
  assert.equal(R.feeFor(e, "individual"), 1500);
  assert.equal(R.feeFor(e, "group"), 5000);
  assert.equal(R.feeFor(R.trackEntry(open(), { name: "Free" }), "group"), 0);
});

test("fees set once for the competition apply to every track; a track's own older price still wins", () => {
  const c = open({ info: { entryModes: ["individual", "group"], individualPrice: 1000, teamPrice: 3000 } });
  const e = R.trackEntry(c, { name: "Any" });
  assert.equal(R.feeFor(e, "individual"), 1000);
  assert.equal(R.feeFor(e, "group"), 3000, "one fee per team");
  assert.equal(R.feeFor(R.trackEntry(c, track()), "group"), 5000);
  assert.equal(R.feeFor(R.trackEntry(c, { name: "Cleared", entry: { individualPrice: null, teamPrice: null } }), "individual"), 1000);
});

test("ages: the track's own, else the competition's", () => {
  assert.deepEqual(R.trackAges(open({ info: { ageMin: 7, ageMax: 18 } }), track({ ageMin: 10 })), { ageMin: 10, ageMax: 18 });
});

test("track addresses come from their names, numbered when two share one", () => {
  assert.deepEqual(R.trackSlugs([{ name: "AI Challenge" }, { name: "Robotics" }, { name: "AI challenge" }, { name: "" }]), ["ai-challenge", "robotics", "ai-challenge-2", "track-4"]);
});

test("registration window: open status, between the open and close dates", () => {
  assert.equal(R.registrationWindow(open(), TODAY).open, true);
  assert.equal(R.registrationWindow({ status: "closed" }, TODAY).open, false);
  assert.equal(R.registrationWindow(open({ registrationOpenDate: "2026-12-01" }), TODAY).open, false);
  assert.equal(R.registrationWindow(open({ registrationCloseDate: "2026-11-19" }), TODAY).open, false);
  assert.equal(R.registrationWindow(open({ registrationCloseDate: TODAY }), TODAY).open, true, "the close date itself still counts");
});

test("a valid individual and a valid team pass", () => {
  assert.deepEqual(R.registrationProblems({ competition: open(), track: track(), input: { entryType: "individual", participants: [kid("Amani Otieno")] }, today: TODAY }), []);
  assert.deepEqual(R.registrationProblems({ competition: open(), track: track(), input: { entryType: "group", teamName: "Bots", participants: [kid("A B"), kid("C D")] }, today: TODAY }), []);
});

test("refusals are worded for the person registering", () => {
  const p = (input, extra = {}) => R.registrationProblems({ competition: open(extra.c), track: extra.t || track(), input, today: TODAY });
  assert.match(p({ entryType: "group", teamName: "", participants: [kid("A"), kid("B")] })[0], /name/);
  assert.match(p({ entryType: "group", teamName: "X", participants: [kid("A")] })[0], /2 to 4 members/);
  assert.match(p({ entryType: "group", teamName: "X", participants: [kid("A"), kid("B")] }, { t: track({ entry: { individual: true, group: false } }) })[0], /individuals only/);
  assert.match(p({ entryType: "individual", participants: [kid("Old", "2000-01-01")] }, { t: track({ ageMax: 16 }) })[0], /is 26 — this track is for ages/);
  assert.match(p({ entryType: "group", teamName: "X", participants: [kid("Sam"), kid("sam")] })[0], /listed twice/);
  assert.match(p({ entryType: "individual", participants: [kid("A")] }, { t: track({ registerUrl: "https://partner.example/form" }) })[0], /its own form/);
  assert.match(R.registrationProblems({ competition: open(), track: null, input: {}, today: TODAY })[0], /isn't part/);
});

test("registration numbers and entry labels", () => {
  assert.equal(R.registrationNumberFor(2026, 7), "CR-2026-000007");
  assert.equal(R.entryLabel({ entryType: "group", teamName: "Bots" }), "Team Bots");
  assert.equal(R.entryLabel({ entryType: "individual", participants: [{ name: "Amani" }] }), "Amani");
});

test("the admin form takes the information section and full tracks", () => {
  const ok = createCompetitionSchema.parse({
    name: "Robotics Challenge",
    info: { ageMin: 7, ageMax: 18, entryModes: ["individual", "group"], mode: "both", milestones: [{ label: "Finals", date: "2027-04-04" }], prizes: ["Trophies"], extras: [{ label: "Kit", value: "micro:bit" }] },
    tracks: [{ name: "AI", entry: { individual: true, group: true, teamMin: 2, teamMax: 3, individualPrice: 1500, teamPrice: 4000 }, judging: [{ name: "Creativity", weight: 40 }], faqs: [{ question: "Who?", answer: "Anyone" }] }],
  });
  assert.equal(ok.tracks[0].entry.teamMax, 3);
  assert.throws(() => createCompetitionSchema.parse({ name: "X", info: { entryModes: [] } }));
  assert.throws(() => createCompetitionSchema.parse({ name: "X", tracks: [{ name: "T", entry: { individual: false, group: false } }] }));
  assert.throws(() => createCompetitionSchema.parse({ name: "X", tracks: [{ name: "T", entry: { teamMin: 4, teamMax: 2 } }] }));
});

test("the website registration form", () => {
  const ok = registrationSchema.parse({ trackId: "t1", entryType: "group", teamName: "Bots", contactName: "Jane Doe", contactEmail: "JANE@Example.com", contactPhone: "0712345678", contactRole: "teacher", participants: [kid("A B"), kid("C D")] });
  assert.equal(ok.contactEmail, "jane@example.com");
  assert.throws(() => registrationSchema.parse({ trackId: "t1", entryType: "individual", contactName: "J", contactEmail: "x", contactPhone: "1", participants: [] }));
});
