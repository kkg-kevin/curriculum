// Connect → Announcements (26 Nov 2026): the rules in connect.announcement.rules.js.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/modules/connect/connect.announcement.rules");

const now = new Date("2026-11-26T09:00:00Z");

test("the audience keeps only known groups, without repeats", () => {
  const a = R.cleanAudience({ groups: ["parents", "parents", "nobody", "educators"], hubIds: ["h1", "h1", "", null], classIds: "x" });
  assert.deepEqual(a, { groups: ["parents", "educators"], hubIds: ["h1"], classIds: [] });
});

test("an announcement needs a title, an audience and a labelled https button", () => {
  assert.deepEqual(R.announcementProblems({ title: "Hi", audience: { groups: ["parents"] } }, now), []);
  assert.ok(R.announcementProblems({ title: " ", audience: { groups: [] } }, now).length === 2);
  assert.ok(R.announcementProblems({ title: "Hi", audience: { groups: ["staff"] }, linkUrl: "javascript:alert(1)", linkLabel: "Go" }, now).some((p) => /http/.test(p)));
  assert.ok(R.announcementProblems({ title: "Hi", audience: { groups: ["staff"] }, linkUrl: "https://x.test" }, now).some((p) => /label/.test(p)));
  assert.ok(R.announcementProblems({ title: "Hi", audience: { groups: ["staff"] }, endsAt: "2026-11-25T00:00:00Z" }, now).length === 1);
  assert.ok(R.announcementProblems({ title: "Hi", audience: { groups: ["staff"] }, publishAt: "2026-12-05T00:00:00Z", endsAt: "2026-12-01T00:00:00Z" }, now).length === 1);
});

test("where it stands: scheduled, live, ended, deleted", () => {
  assert.equal(R.stateOf({ status: "scheduled" }, now), "scheduled");
  assert.equal(R.stateOf({ status: "published" }, now), "live");
  assert.equal(R.stateOf({ status: "published", endsAt: "2026-11-26T08:00:00Z" }, now), "ended");
  assert.equal(R.stateOf({ status: "ended" }, now), "ended");
  assert.equal(R.stateOf({ status: "published", deletedAt: now }, now), "deleted");
});

test("people engage only as the team allowed, only while live, never by the bell alone", () => {
  const a = { status: "published", allowReactions: true, allowComments: false, askAck: true };
  const feed = { channel: "feed" };
  assert.equal(R.canEngage(a, feed, "react", now), true);
  assert.equal(R.canEngage(a, feed, "comment", now), false);
  assert.equal(R.canEngage(a, feed, "ack", now), true);
  assert.equal(R.canEngage(a, { channel: "notice" }, "react", now), false, "a child without Connect only gets the bell");
  assert.equal(R.canEngage({ ...a, status: "ended" }, feed, "react", now), false);
  assert.equal(R.canEngage(a, null, "react", now), false);
});

test("each group opens it in its own portal", () => {
  assert.equal(R.routeFor("educators", "a1"), "/teacher-portal/announcements/a1");
  assert.equal(R.routeFor("parents", "a1"), "/parent/announcements/a1");
  assert.equal(R.routeFor("learners", "a1"), "/learner-portal/announcements/a1");
  assert.equal(R.routeFor("staff", "a1"), "/announcements/a1");
});

test("the gist of rich text, and pinned ones first", () => {
  assert.equal(R.summaryText("<p>Hello <b>team</b></p><p>See you &amp; bring laptops</p>"), "Hello team See you & bring laptops");
  assert.equal(R.summaryText("x".repeat(300), 10).length, 10);
  const sorted = R.sortForReaders([
    { id: "old", publishedAt: "2026-11-01" },
    { id: "new", publishedAt: "2026-11-20" },
    { id: "pin", pinned: true, publishedAt: "2026-10-01" },
  ]);
  assert.deepEqual(sorted.map((a) => a.id), ["pin", "new", "old"]);
});
