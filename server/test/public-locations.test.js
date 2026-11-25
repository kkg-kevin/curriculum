const test = require("node:test");
const assert = require("node:assert/strict");
const { _townOf: townOf } = require("../src/modules/public-site/public-location.service");

test("a hub's town is its city, else its county; online-only hubs are Online", () => {
  assert.deepEqual(townOf({ deliveryMode: "in_person", address: { city: "Thika", county: "Kiambu" } }), { town: "Thika", slug: "thika", county: "Kiambu" });
  assert.deepEqual(townOf({ deliveryMode: "hybrid", address: { city: " Kahawa Sukari ", county: "Kiambu" } }), { town: "Kahawa Sukari", slug: "kahawa-sukari", county: "Kiambu" });
  assert.deepEqual(townOf({ address: { city: "", county: "Kitui" } }), { town: "Kitui", slug: "kitui", county: "" });
  assert.deepEqual(townOf({ deliveryMode: "virtual", address: { city: "Nairobi" } }), { town: "Online", slug: "online", county: "" });
  assert.equal(townOf({ deliveryMode: "in_person", address: {} }), null);
  assert.equal(townOf({ deliveryMode: "in_person" }), null);
});
