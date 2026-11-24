// Digifunzi Connect — the rules that need no database (modules/connect/connect.rules.js) and the
// file checks (connect.files.js): personal details refused, who may message whom, which posts wait
// for a check, badges, links, paging — and photos losing their hidden details (GPS).
const test = require("node:test");
const assert = require("node:assert/strict");
// Only the signing key is used; env.js insists on the rest being set.
for (const [k, v] of Object.entries({ JWT_SECRET: "test-secret", CLIENT_URL: "http://localhost", DB_USER: "x", DB_PASSWORD: "x", DB_NAME: "x" })) process.env[k] = process.env[k] || v;
const R = require("../src/modules/connect/connect.rules");
const V = require("../src/modules/connect/connect.validation");

test("phone numbers, emails, addresses and contact moves are refused", () => {
  const refused = [
    "call me 0712 345 678", "my number is +254712345678", "07-12-34-56-78", "zero seven one two three four five six seven eight",
    "email me amani.k@gmail.com", "it's amani at yahoo dot com", "amani @ mail.co.ke", "write to ken at digi dot org", "add me on whatsapp", "snap me later", "text me",
    "I live in Kileleshwa near the mall", "my school is Hillcrest", "house no 42", "let's meet at the mall", "come to my house",
  ];
  for (const text of refused) assert.ok(R.checkText(text), `should refuse: ${text}`);
  assert.equal(R.checkText("0712 345 678").kind, "personal_info");
  assert.equal(R.checkText("add me on instagram").kind, "contact");
  assert.equal(R.checkText("I live at plot 4").kind, "address");
});

test("ordinary learning talk goes through", () => {
  const fine = [
    "My robot can follow a line now!", "How do I loop 10 times in Python?", "Score: 3 out of 5", "I made a game with 2 levels",
    "Version 2.5 is faster", "It took 45 minutes", "Check scratch.mit.edu/projects/123456", "https://github.com/someone/robot",
    "We used an ultrasonic sensor and 4 motors", "Year 2026 was great",
    // Found while testing: " at " followed later by a full stop is not an email.
    "A small robot that follows a black line and stops at obstacles. Built for the Robot Race.",
    "Great job @Ken. Thanks!", "We look at the code at lunch. Then we test it.",
  ];
  for (const text of fine) assert.equal(R.checkText(text), null, `should allow: ${text}`);
});

test("unkind words and links to other sites are refused, admin words added", () => {
  assert.equal(R.checkText("you are a b1tch").kind, "words");
  assert.equal(R.checkText("go and kill yourself").kind, "unkind");
  assert.equal(R.checkText("see my-site.xyz").kind, "link");
  assert.equal(R.checkText("watch on tiktok.com").kind, "contact");
  assert.equal(R.checkText("that is mjinga", { blockedWords: ["mjinga"] }).kind, "words");
  assert.equal(R.checkText("see mysite.com", { linkDomains: ["mysite.com"] }), null);
});

test("links: https on an allowed site only", () => {
  assert.equal(R.allowedLink("scratch.mit.edu/projects/1"), "https://scratch.mit.edu/projects/1");
  assert.equal(R.allowedLink("https://www.youtube.com/watch?v=x"), "https://www.youtube.com/watch?v=x");
  assert.equal(R.allowedLink("https://evil.example.com"), null);
  assert.equal(R.allowedLink("javascript:alert(1)"), null);
  assert.equal(R.allowedLink("https://user:pass@github.com/x"), null);
  assert.equal(R.allowedLink("https://github.com.evil.io/x"), null);
});

test("one-to-one messages: age, parent's switch, connection, blocks", () => {
  const me = { directMessages: true };
  const other = { directMessages: true, displayName: "Ken" };
  const base = { settings: {}, myAge: 14, otherAge: 15, me, other, connected: true, blocked: false };
  assert.equal(R.directMessageBlocker(base), null);
  assert.match(R.directMessageBlocker({ ...base, myAge: 12 }), /when you're 13/);
  assert.match(R.directMessageBlocker({ ...base, myAge: null }), /when you're 13/); // age unknown = too young
  assert.match(R.directMessageBlocker({ ...base, otherAge: 11 }), /can't have one-to-one/);
  assert.match(R.directMessageBlocker({ ...base, me: { directMessages: false } }), /parent/);
  assert.match(R.directMessageBlocker({ ...base, other: { ...other, directMessages: false } }), /can't have one-to-one/);
  assert.match(R.directMessageBlocker({ ...base, connected: false }), /Connect with Ken first/);
  assert.match(R.directMessageBlocker({ ...base, blocked: true }), /can't message/);
  assert.match(R.directMessageBlocker({ ...base, settings: { directMessages: false } }), /switched off/);
  assert.equal(R.directMessageBlocker({ ...base, myAge: 11, otherAge: 11, settings: { dmMinAge: 10 } }), null);
});

test("group chats follow the same rule for everyone added", () => {
  const me = { directMessages: true };
  const ok = { member: { directMessages: true, displayName: "A" }, age: 14, connected: true, blocked: false };
  assert.equal(R.groupChatBlocker({ settings: {}, myAge: 13, me, others: [ok, ok] }), null);
  assert.match(R.groupChatBlocker({ settings: {}, myAge: 13, me, others: [ok, { ...ok, age: 9 }] }), /can't have one-to-one/);
  assert.match(R.groupChatBlocker({ settings: { groupChats: false }, myAge: 15, me, others: [ok] }), /switched off/);
});

test("files in messages: off, project chats only, or everywhere", () => {
  assert.equal(R.messageFilesAllowed({}, "project"), true);
  assert.equal(R.messageFilesAllowed({}, "direct"), false);
  assert.equal(R.messageFilesAllowed({ messageFiles: "all" }, "direct"), true);
  assert.equal(R.messageFilesAllowed({ messageFiles: "off" }, "project"), false);
});

test("posts go up straight away unless an admin switches checking on", () => {
  // The user's choice (24 Nov 2026): admins don't approve posts.
  assert.equal(R.reviewReason({ settings: {}, postsSent: 0 }), null);
  assert.equal(R.reviewReason({ settings: {}, postsSent: 0, hasFiles: true }), null);
  assert.match(R.reviewReason({ settings: { reviewNewMemberPosts: 3 }, postsSent: 0 }), /first posts/);
  assert.equal(R.reviewReason({ settings: { reviewNewMemberPosts: 3 }, postsSent: 3 }), null);
  assert.match(R.reviewReason({ settings: { reviewFiles: true }, postsSent: 10, hasFiles: true }), /pictures/);
  assert.match(R.reviewReason({ settings: { reviewAll: true }, postsSent: 50 }), /Every post/);
});

test("settings are kept within sensible bounds", () => {
  const s = R.mergeSettings({ dmMinAge: 3, messageFiles: "everything", blockedWords: [" Bad ", "bad", ""], linkDomains: ["https://Example.org/x", "not a domain"] });
  assert.equal(s.dmMinAge, 8);
  assert.equal(s.messageFiles, "team");
  assert.deepEqual(s.blockedWords, ["bad"]);
  assert.deepEqual(s.linkDomains, ["example.org"]);
});

test("badges from figures", () => {
  assert.deepEqual(R.badgesEarned({}), []);
  const all = R.badgesEarned({ posts: 1, answers: 5, teamProjects: 1, doneProjects: 1, showcased: 1, challenges: 1, awards: 1, connections: 5, communities: 3, bestReactions: 10 });
  assert.deepEqual(all.sort(), Object.keys(R.BADGES).sort());
  assert.deepEqual(R.badgesEarned({ answers: 4, connections: 4, communities: 2 }), []);
});

test("names, avatars, pair keys", () => {
  assert.equal(R.shortName("Amani Grace", "kariuki"), "Amani K.");
  assert.equal(R.shortName("", ""), "Learner");
  assert.equal(R.pairKey("b", "a"), R.pairKey("a", "b"));
  assert.deepEqual(R.cleanAvatar({ photo: true }), R.cleanAvatar({})); // a drawn avatar only — the profile photo is used on its own
  assert.deepEqual(R.defaultAvatar("x"), R.defaultAvatar("x"));
});

test("challenges: open dates and entry types", () => {
  const c = { status: "open", startsOn: "2026-12-01", endsOn: "2026-12-10", entryMode: "team", teamMin: 2, teamMax: 4 };
  assert.equal(R.challengeOpen(c, "2026-11-30"), false);
  assert.equal(R.challengeOpen(c, "2026-12-10"), true);
  assert.equal(R.challengeOpen({ ...c, status: "draft" }, "2026-12-05"), false);
  assert.match(R.entryProblem({ challenge: c, mode: "individual" }), /teams/);
  assert.match(R.entryProblem({ challenge: c, mode: "team", teamSize: 1 }), /at least 2/);
  assert.match(R.entryProblem({ challenge: c, mode: "team", teamSize: 5 }), /at most 4/);
  assert.equal(R.entryProblem({ challenge: c, mode: "team", teamSize: 3 }), null);
});

test("paging cursors round-trip and refuse rubbish", () => {
  const row = { createdAt: new Date("2026-11-24T10:00:00.123Z"), id: "abc" };
  const back = R.decodeCursor(R.encodeCursor(row));
  assert.equal(back.id, "abc");
  assert.equal(back.createdAt.toISOString(), "2026-11-24T10:00:00.123Z");
  assert.equal(R.decodeCursor("nonsense"), null);
});

test("request checks: profile names, messages need words or a file, parents must agree", () => {
  assert.throws(() => V.profileSchema.parse({ displayName: "<script>" }));
  assert.equal(V.profileSchema.parse({ displayName: "Amani K." }).displayName, "Amani K.");
  assert.throws(() => V.profileSchema.parse({ interests: ["hacking"] }));
  assert.throws(() => V.messageSchema.parse({ body: "" }));
  assert.ok(V.messageSchema.parse({ fileIds: ["f1"] }));
  assert.throws(() => V.consentSchema.parse({ agree: false }));
  assert.deepEqual(V.projectEditSchema.parse({ status: "done" }), { status: "done" }); // an edit changes only what it sends
});

// ── Files ────────────────────────────────────────────────────────────────────────────────────────
const Files = require("../src/modules/connect/connect.files");

function jpegWithGps() {
  // SOI, APP0 JFIF, APP1 Exif (IFD0: Orientation=6 and a GPS pointer + "GPSDATA" bytes), COM, SOS, data, EOI
  const tiff = Buffer.alloc(8 + 2 + 24 + 4 + 16);
  tiff.write("MM", 0, "latin1"); tiff.writeUInt16BE(42, 2); tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(2, 8);
  tiff.writeUInt16BE(0x0112, 10); tiff.writeUInt16BE(3, 12); tiff.writeUInt32BE(1, 14); tiff.writeUInt16BE(6, 18);
  tiff.writeUInt16BE(0x8825, 22); tiff.writeUInt16BE(4, 24); tiff.writeUInt32BE(1, 26); tiff.writeUInt32BE(38, 30);
  tiff.writeUInt32BE(0, 34);
  tiff.write("GPSDATA-1.2921S", 38, "latin1");
  const exif = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const seg = (marker, data) => { const h = Buffer.from([0xff, marker, 0, 0]); h.writeUInt16BE(data.length + 2, 2); return Buffer.concat([h, data]); };
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "latin1")),
    seg(0xe1, exif),
    seg(0xfe, Buffer.from("taken at home", "latin1")),
    seg(0xda, Buffer.from([1, 2, 3])), Buffer.from([9, 9, 9]), Buffer.from([0xff, 0xd9]),
  ]);
}

test("a JPEG loses its GPS and comments but keeps which way up it goes", () => {
  const input = jpegWithGps();
  assert.ok(input.includes(Buffer.from("GPSDATA")));
  const out = Files.stripMetadata(input, "image/jpeg");
  assert.ok(!out.includes(Buffer.from("GPSDATA")), "GPS removed");
  assert.ok(!out.includes(Buffer.from("taken at home")), "comment removed");
  assert.ok(out.includes(Buffer.from("JFIF")), "JFIF kept");
  assert.ok(out.includes(Buffer.from([0x01, 0x12, 0x00, 0x03])), "orientation kept");
  assert.deepEqual([...out.subarray(-5)], [9, 9, 9, 0xff, 0xd9], "picture data untouched");
});

test("a PNG loses its text and EXIF chunks", () => {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, "latin1"), data, Buffer.alloc(4)]);
  };
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", Buffer.alloc(13)), chunk("tEXt", Buffer.from("Author\0Amani")), chunk("eXIf", Buffer.from("GPS")), chunk("IDAT", Buffer.from([1, 2])), chunk("IEND", Buffer.alloc(0)),
  ]);
  const out = Files.stripMetadata(png, "image/png");
  assert.ok(!out.includes(Buffer.from("Amani")));
  assert.ok(!out.includes(Buffer.from("eXIf")));
  assert.ok(out.includes(Buffer.from("IDAT")) && out.includes(Buffer.from("IEND")));
});

test("files are judged by their bytes, never their name", () => {
  assert.equal(Files.sniff(jpegWithGps(), "x.png").mimeType, "image/jpeg");
  assert.equal(Files.sniff(Buffer.from("%PDF-1.7 ..."), "a.pdf").mimeType, "application/pdf");
  assert.equal(Files.sniff(Buffer.from("print('hi')\n"), "a.py").mimeType, "text/plain");
  assert.equal(Files.sniff(Buffer.from([0x50, 0x4b, 3, 4, 0, 0]), "game.sb3").ext, ".sb3");
  assert.equal(Files.sniff(Buffer.from([0x50, 0x4b, 3, 4, 0, 0]), "files.zip"), null); // no general archives
  assert.equal(Files.sniff(Buffer.from("MZ\x90\0binary"), "photo.jpg"), null); // a program called .jpg
  assert.equal(Files.sniff(Buffer.from([0x68, 0, 0x69]), "a.txt"), null); // not text
  assert.equal(Files.sniff(Buffer.from("<html><script>"), "page.svg"), null);
});

test("file links are signed and run out", () => {
  const url = Files.signedUrl("file-1", Date.parse("2026-11-24T10:00:00Z"));
  const [, , , id, exp, sig] = url.split("/");
  assert.equal(id, "file-1");
  assert.ok(Files.verifySignature("file-1", exp, sig, Date.parse("2026-11-24T10:00:00Z")));
  assert.ok(!Files.verifySignature("file-2", exp, sig, Date.parse("2026-11-24T10:00:00Z")));
  assert.ok(!Files.verifySignature("file-1", exp, sig, Number(exp) + 1));
  assert.ok(!Files.verifySignature("file-1", exp, "x".repeat(sig.length)));
});
