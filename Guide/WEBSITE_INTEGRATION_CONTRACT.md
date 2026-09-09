# Website ⇄ Curriculum System — Integration Contract

**Reconciled contract.** This merges the Curriculum system's view (this repo) with
`digifunzi-landing`'s `System Integration` doc. Where the two differed, the
resolution is recorded inline and the backend has been changed to match — see
§8 changelog.

> **⚠️ Bootcamps removed (4 Sep 2026); Projects + Store reintroduced differently
> (9 Sep 2026).** `GET /api/public/bootcamps[/:idOrSlug]` and the admin-only
> `/api/site/*` authoring API are **gone** — "bootcamp" duplicated the existing
> **Program** concept. **`GET /api/public/projects[/:idOrSlug]` is back, but as a
> different feature**: it now serves the designated admin's `type: "project"`
> **assessments** flipped "For sale" in the Assessment Builder — not the old
> `public_projects` marketing table (which is still dropped). See §3.3/§3.4.
> **`GET /api/public/store[/:idOrSlug]` is new**: the designated admin's shared
> **`inventory`** items flipped "For sale" in the portal's Inventory panel — the
> Quarky robot, kits, accessories. See §3.5/§3.6. The live public reads are
> `/api/public/{pathways,projects,store}[/:idOrSlug]` and the
> `/api/public/diagnostics/*` set, plus the two `POST` lead/contact endpoints.

- **Website:** `digifunzi-landing` — standalone Vite + React SPA.
  Deployed at **`https://africa.digifunzi.com`** (Truehost cPanel subdomain).
  Own origin for canonical/sitemap: `VITE_SITE_URL`.
- **Curriculum backend (this repo):** Node/Express + MySQL.
  Prod `https://nodeapp.digifunzi.com`, dev `http://localhost:5000`.
  The website sets `VITE_API_URL` to this.
- **Curriculum admin portal:** React + Vite, `https://curriculum.digifunzi.com`.

**Traffic is one-way.** The browser calls the backend's `/api/public/*` endpoints
over HTTPS. The backend never calls the website.

**No auth.** The website holds no JWT, cookie or API key. Every `/api/public/*`
route is unauthenticated (server-side rate-limited).

**Response envelope for public reads:** bare arrays / objects — **no**
`{ success, data }` wrapper. Read errors are `{ "message": "..." }` with a real
HTTP status. (The two POST endpoints are the one exception — see §4.)

---

## 1. Architecture of the link

```
              digifunzi-landing (website)                    Curriculum backend (this repo)
              https://africa.digifunzi.com                   https://nodeapp.digifunzi.com
              ────────────────────────────                   ─────────────────────────────
 visitor ──►  Pathways pages                         ──GET──►  /api/public/*      (no auth)
 visitor ──►  Enroll form / Contact form             ──POST─►  /api/public/leads
                                                              /api/public/contact
                                                                    │
                                                                    ├─► writes `leads` table
                                                                    └─► notifies every admin in-app
 build   ──►  scripts/prerender.js (from :4199)      ──GET──►  /api/public/pathways
                                                                    │
 staff   ──►  Admin portal → Enquiries page          ──GET──►  /api/leads         (admin JWT)
 staff   ──►  Admin portal → Enquiries page          ─PATCH─►  /api/leads/:id/status
```

- Pathway content the website reads is **authored inside this system** (the
  portal's Settings → Pathways). Bootcamps/Projects pages have no backing
  content API right now — see the notice at the top of this doc.
- The website's only write is a **lead** (Enroll / Contact submission). Nothing
  it sends creates a User or Learner account.
- A lead's `referenceId` is a **bare string** — no FK, no validation. It may be a
  slug or a uuid; the backend stores whatever it's given (see §4.1). It's only
  resolvable against pathways now (bootcamp/project catalogs are gone).

---

## 2. Status

Backend module: `server/src/modules/public-site/` + `server/src/modules/leads/`.

| Method | Path | Purpose | Status |
|---|---|---|---|
| `GET` | `/api/public/bootcamps` | Bootcamp list | ❌ removed 4 Sep 2026 — 404s |
| `GET` | `/api/public/bootcamps/:idOrSlug` | Bootcamp detail | ❌ removed 4 Sep 2026 — 404s |
| `GET` | `/api/public/projects` | Project list — the designated admin's **for-sale `type: project` assessments** (§3.3) | ✅ live (9 Sep 2026) — scoped to `PUBLIC_CONTENT_ADMIN_ID` (503 if unset) |
| `GET` | `/api/public/projects/:idOrSlug` | Project detail (build steps, deliverables, kit) | ✅ live — same scoping (§3.4) |
| `GET` | `/api/public/store` | Store list — the designated admin's **for-sale `inventory` items** (§3.10) | ✅ live (9 Sep 2026) — scoped to `PUBLIC_CONTENT_ADMIN_ID` (503 if unset) |
| `GET` | `/api/public/store/:idOrSlug` | Store item detail (highlights, "what you get", specs) | ✅ live — same scoping (§3.11) |
| `GET` | `/api/public/pathways` | Pathway list — the designated admin's **operational** pathways (§3.5) | ✅ live — scoped to `PUBLIC_CONTENT_ADMIN_ID` (503 if unset) |
| `GET` | `/api/public/pathways/:idOrSlug` | Pathway detail (ordered courses + `diagnostic`) | ✅ live — same scoping |
| `POST` | `/api/public/leads` | Enrol-interest capture → notify admins | ✅ live |
| `POST` | `/api/public/contact` | General enquiry → notify admins | ✅ live (separate endpoint kept — see §4.2) |
| `GET` | `/api/public/diagnostics/:pathwayIdOrSlug/availability` | Does this pathway offer a public diagnostic | ✅ live — see §3.8 |
| `GET` | `/api/public/diagnostics/:pathwayIdOrSlug?age=` | Diagnostic question set for an age | ✅ live — see §3.8 |
| `GET` | `/api/public/diagnostics/attempts/:attemptId` | The permanent, shareable graded report for a completed attempt | ✅ live — see §3.9 |
| `POST` | `/api/public/diagnostics/:pathwayIdOrSlug/submit` | Submit answers → instant graded report + `attemptId`. **No contact info, no lead.** | ✅ live — see §4.3 |
| `PATCH` | `/api/public/leads/:id` | ~~post-report contact details~~ | ❌ removed 9 Sep 2026 — the diagnostic no longer creates a lead |
| `GET/POST/PUT/DELETE` | `/api/site/*` | Admin content authoring | ❌ removed 4 Sep 2026 — 404s |

> **"Is the pathways endpoint merged?"** (website §5) — yes. It's in the
> `learning-areas → pathways` work, now merged to `master` (commit `98e3938`).

---

## 3. Read endpoints — exact shapes

`:idOrSlug` resolves by `id` (uuid) first, then by slug. Slugs are derived
server-side from `name` via `server/src/shared/utils/slugify.js`. Website cards
link by **slug**.

### 3.1–3.2 Bootcamps — REMOVED (4 Sep 2026)

`GET /api/public/bootcamps[/:idOrSlug]` no longer exist — they 404. "Bootcamp"
duplicated the existing **Program** concept. See the notice at the top of this
doc.

### 3.3 `GET /api/public/projects` → `200`, array  ·  `503` if unconfigured  *(NEW 9 Sep 2026)*

**A "project" is a `type: "project"` assessment** authored in the portal's
**Assessment Builder** and flipped **"For sale on the website"** in its Selling
panel. This is a *deliberate, different* feature from the removed course-catalog
endpoint above — it reads the `assessments` table, scoped to
`PUBLIC_CONTENT_ADMIN_ID` (503 if unset), `saleStatus = 'for_sale'` only.

```jsonc
[
  {
    "id": "uuid",
    "slug": "smart-home-starter",       // slugify(name), computed at read time
    "name": "Smart Home Starter",
    "tagline": "Make a model room that reacts to you",   // saleTagline, "" if unset
    "level": "beginner" | "intermediate" | "advanced" | null,
    "ageMin": integer | null,
    "ageMax": integer | null,
    "coverImage": "string | null",       // absolutized (§6) — an upload URL or null
    "price": {                           // null when no price is set → show "Enquire for pricing"
      "amount": 1800,                    // whole currency units (KES 1,800), no fractional pricing
      "currency": "KES",
      "note": "One-time purchase — lifetime access."
    },
    "deliverableCount": integer,         // # of the assessment's deliverables
    "milestoneCount": integer            // # of its milestones
  }
]
```

Newest first. Slug collisions (two of the admin's for-sale projects, same
computed name) collapse to one — prefer the one with a cover image, then a
price, then the first. **The assessment's grading content (`items`, `rubric`,
`indicators`, correct answers, `indicatorMarks`) is NEVER exposed.**

### 3.4 `GET /api/public/projects/:idOrSlug` → `200` | `404`

List item **plus** the marketing detail:

```jsonc
{
  "id": "uuid", "slug": "...", "name": "...", "tagline": "...",
  "level": "beginner" | null, "ageMin": 8, "ageMax": 12,
  "coverImage": "https://.../uploads/x.png" | null,
  "price": { "amount": 1800, "currency": "KES", "note": "..." } | null,
  "deliverableCount": 2, "milestoneCount": 4,
  "description": "string",              // assessment.description — rich-text HTML → plain text
  "overview": "string",                 // assessment.overview ("Project Overview") — HTML → text
  "deliverables": [ { "name": "string", "description": "string" } ],   // "what you'll build"
  "milestones":   [ { "name": "string", "description": "string" } ],   // ordered — the build steps
  "requirements": ["Quarky robot ×1", "A laptop"]   // names of the assessment's linked inventory
}
```

`404 { "message": "Project not found" }` for an unknown id/slug, a project owned
by a different admin, or one that isn't `for_sale` — undifferentiated.

**Buying:** no checkout. The website's "Enquire to buy" button links to
`/enroll?interestedIn=project&referenceId=<slug>` → `POST /api/public/leads`
(§4.1). The Enquiries page resolves the slug to the project name server-side
(`referenceType: "project"`).

### 3.5 `GET /api/public/pathways` → `200`, array  ·  `503` if unconfigured

```jsonc
[
  {
    "id": "uuid",                   // the operational pathway's own id
    "slug": "robotics",             // computed from name at read time — no slug column
    "name": "Robotics",
    "description": "string",
    "color": "#25476a",             // brand colour, default "#25476a"
    "courseCount": integer          // courses in this pathway that still resolve to an active `courses` row
  }
]
```

**Source: the designated admin's OPERATIONAL pathways** (changed 9 Sep 2026 — see
§8 changelog). These are the `pathways` rows authored in the portal's **Curriculum
→ Competency Framework** — the same records that carry the real courses, age
range and diagnostic. *(Previously this read a separate `pathway_templates`
"reusable template library" from Settings → Pathways, which turned out to be a
hand-maintained list that drifted from the actual curriculum. That table still
exists for the portal's own template feature; the public site just no longer
reads it, and there is no marketing-template ↔ diagnostic link to configure.)*

**Scoped to `PUBLIC_CONTENT_ADMIN_ID`.** `pathways` has no `ownerAdminId` of its
own — it's tenant-scoped transitively through `curriculumId → curricula.ownerAdminId`.
The endpoint reads across **every curriculum the designated admin owns**. If
`PUBLIC_CONTENT_ADMIN_ID` is unset both `/api/public/pathways` endpoints return
`503 { "success": false, "message": "Public content is not configured" }`.

Two of the admin's pathways can share a computed slug (names are unique only
*within* one curriculum, and an admin can own several). When that happens **only
one appears** — the one with active courses, else the one with a public
diagnostic, else the first.

**Every such pathway is public the moment it has ≥1 active course** — there is
no published/draft flag (website §5). A pathway with 0 resolvable active courses
is **omitted from the list entirely** (not shown with `courseCount: 0` — that was
the `pathway_templates` behaviour); its detail route 404s.
(The website also drops `courseCount: 0` entries and de-dupes by slug client-side as
defence-in-depth — `digifunzi-landing/src/hooks/usePathways.js`.)

### 3.6 `GET /api/public/pathways/:idOrSlug` → `200` | `404`

List item **plus** a `diagnostic` object **plus** an **ordered** `courses` array.
`:idOrSlug` is the operational pathway's own id or computed slug. Course order is
the pathway's `courseSequence` (the portal's Course Sequence editor), then any
`courses[]` never explicitly sequenced.

```jsonc
{
  "id": "uuid", "slug": "...", "name": "...", "description": "...",
  "color": "#25476a", "courseCount": 3,
  "diagnostic": {                 // one fewer round-trip for the CTA
    "available": true,            // is a public diagnostic offerable right now (see §3.8)
    "minAge": 8,                  // integer | null — the offered age range (both set, or both null)
    "maxAge": 14
  },
  "courses": [
    {
      "name": "string",
      "description": "string",     // plain text (course rich-text HTML flattened server-side)
      "ageMin": integer | null,
      "ageMax": integer | null,
      "coverImage": "string | null"
    }
  ]
}
```

Only `active` courses. Internal course id is **never** exposed.
`404 { "message": "Pathway not found" }` for an unknown id/slug, a pathway owned
by a different admin, **or** a pathway with no active courses.

The `diagnostic` block comes from the pathway's own `publicDiagnosticEnabled` +
`diagnosticAssessmentId` + `minAge`/`maxAge` (Curriculum → Competency Framework).
`available:false` (with `minAge`/`maxAge` null) when the flag is off, the
assessment isn't auto-gradable, **or its min/max age isn't set**. A
diagnostic-config problem never breaks this response.

### 3.7 `GET /api/public/learners/:publicToken` → `200` | `404`

The "share via QR" learner profile. Read-only, deliberately narrow field set.
**Not marketing-site relevant** — listed for completeness only.

### 3.8 Public diagnostics — pick a Pathway, take a diagnostic, see a graded report

**Content source is ONE designated admin's tenant, not every admin.** The
curriculum system is multi-tenant (each admin's hubs/curricula/pathways are
isolated from every other admin's) — an anonymous visitor has no admin login,
so the backend is told explicitly which one tenant's content to serve via the
`PUBLIC_CONTENT_ADMIN_ID` env var (`server/src/config/env.js`). If that's
unset in a given environment, every endpoint below returns `503`.

A pathway is offerable here only when **all** of these hold on the operational
`pathways` row (the **same rows** `/api/public/pathways` §3.5–3.6 now serve — one
table, not two any more):

1. `publicDiagnosticEnabled: true`
2. its `diagnosticAssessmentId` resolves to a fully **auto-gradable** assessment
   (no rubric/manual items — a live re-check, not just the save-time guard). No
   manual grading, no waiting, no human in the loop, ever, on this path.
3. **both `minAge` and `maxAge` are set**. A public diagnostic with no age bounds
   is treated as not-yet-configured, **not** "open to any age" — the anonymous
   path fails safe. (The authenticated learner flow, which has a real learner +
   teacher, is unaffected — it never touches this.)

> **`:pathwayIdOrSlug` is the operational pathway's own id or computed slug** —
> the same slug `/api/public/pathways` returns, since 9 Sep 2026 that endpoint
> serves operational pathways directly (§3.5). No `pathway_templates` indirection.
> All of this pathway's public config (courses, age range, diagnostic) lives on
> the one `pathways` row, authored in Curriculum → Competency Framework.

#### `GET /api/public/diagnostics/:pathwayIdOrSlug/availability` → `200`

```jsonc
{ "diagnosticAvailable": true, "minAge": 8, "maxAge": 14 }
```

`minAge`/`maxAge` added 8 Sep 2026 (both null when unavailable) so the website can
bound its age input. The same info is now embedded in the §3.6 pathway-detail
response as `diagnostic`, so a detail page usually doesn't need this call at all —
it's a fallback. Never errors (aside from the `503`-if-unconfigured case above) —
an unknown pathway or one with no offerable diagnostic both just resolve to
`diagnosticAvailable: false`. Use
this to decide whether to show a diagnostic CTA without fetching the full
question set.

#### `GET /api/public/diagnostics/:pathwayIdOrSlug?age=<int>` → `200` | `404`

```jsonc
{
  "pathwayId": "uuid",
  "pathwayName": "string",
  "assessmentId": "uuid",
  "name": "string",                  // the assessment's own name
  "instructions": "string",
  "minAge": 8,                       // added 8 Sep 2026 — always set on a 200 (the gate requires it)
  "maxAge": 14,
  "items": [
    {
      "id": "string", "kind": "mcqSingle | trueFalse | mcqMultiple | fillBlank | ordering | matching",
      "question": "string (HTML)", "points": number,
      "options": ["string", ...],     // mcqSingle/mcqMultiple/trueFalse only
      "blanks": ["", ...],            // fillBlank only — length is real (how many boxes to render), each entry blanked
      "sequence": ["string", ...],    // ordering only — SHUFFLED, not the real order (that's the answer)
      "pairs": [{ "left": "string", "right": "" }],  // matching only — right is blanked
      "rightOptions": ["string", ...],// matching only — the real right-hand values, shuffled, to populate the picker
      "indicatorNames": ["string", ...]  // competency indicator names this item is tagged with, if any
    }
  ]
}
```

**No `correctAnswer` field, ever, on any item** — stripped server-side before
this response is built. `sequence`/`pairs.right`/`blanks` are deliberately
**not** the real solution (see the field-by-field note above) — sending them
as-is would trivially reveal the answer before grading. `AssessmentTaker`'s
existing rendering logic for `ordering`/`matching` already treats these
fields as "the starting state to rearrange," so a shuffled `sequence` and
blanked `pairs` render correctly with zero client-side changes.

`404 { "message": "No public diagnostic available" }` for: an unknown
pathway, an age outside every offered pathway's range, or a pathway with no
public diagnostic configured/offerable right now — deliberately
undifferentiated, so a probing client can't distinguish "this pathway
doesn't exist" from "it exists but isn't public yet."

**Rate limit: 60 requests / 15 min / IP** — tighter than the write endpoints
below, since a GET creates no record and could otherwise be probed
repeatedly to reconstruct answer patterns from many sanitized responses.

### 3.9 `GET /api/public/diagnostics/attempts/:attemptId` → `200` | `404`

The **permanent, shareable graded report** for a completed diagnostic. `:attemptId`
is the opaque uuid returned in the submit response's `data.attemptId` (§4.3). The
report is **never emailed** — this link is how a visitor keeps, shares, re-opens, or
prints (browser "Save as PDF") their report. The attempt row is write-once and kept
indefinitely, so the link never expires.

```jsonc
{
  "attemptId": "uuid",
  "pathwayName": "string",
  "assessmentName": "string",
  "childName": "string | null",       // as entered at submit — optional there, so may be null
  "childAge": integer | null,
  "completedAt": "ISO-8601",
  "totalScore": number,
  "maxScore": number,
  "items": [                          // the SAME sanitized item projection as §3.8 (no correctAnswer,
    { "id", "kind", "question", "points", "options"?, "blanks"?, "sequence"?, ... }
  ],                                  //   sequence shuffled, blanks/pairs.right blanked)
  "answers": [ { "itemId": "string", "response": /* the visitor's own answer */ } ],
  "itemResults": [
    { "itemId": "string", "correct": boolean, "marksAwarded": number, "maxMarks": number }
  ],
  "indicatorBreakdown": [
    { "indicatorId": "uuid", "name": "string | null", "marksEarned": number, "marksPossible": number }
  ]
}
```

`items` + `answers` + `itemResults` are stored on the attempt at submit time (a
`itemsSnapshot` / `itemResults` column pair), so the report renders identically even
after an admin later edits/reorders/deletes questions on the live assessment.

**Deliberately narrow** — the diagnostic collects no contact info at all, so there's
none to leak; the request's `ipHash` is never exposed either. The `attemptId` uuid is
unguessable, so the id in the URL is the only access control (same posture as
`/api/public/learners/:publicToken`).

`404 { "message": "Report not found" }` for an unknown/garbage `attemptId`.

**Rate limit: 60 requests / 15 min / IP** (shared with §3.8's read limiter).

> **Route order:** `/api/public/diagnostics/attempts/:attemptId` is matched **before**
> `/api/public/diagnostics/:pathwayIdOrSlug`, so a pathway can't be named `attempts`.

> **Attempts created before this endpoint shipped** have no stored snapshot — their
> report returns `items: []` / `itemResults: []` and the page shows score + competency
> breakdown only. Every attempt created since always has the full per-question section.

### 3.10 `GET /api/public/store` → `200`, array  ·  `503` if unconfigured  *(NEW 9 Sep 2026)*

**A "store item" is a shared `inventory` row** — the same catalog Projects/Courses
link materials from — flipped **"For sale on the website"** in the portal's
**Settings → Inventory** panel. Reads the `inventory` table, scoped to
`PUBLIC_CONTENT_ADMIN_ID` (503 if unset), `saleStatus = 'for_sale'` only. The
operational `category` (Robots/Electronics/…), `unit` and stock fields are never
exposed — the website uses its own `storeCategory`.

```jsonc
[
  {
    "id": "uuid",
    "slug": "quarky-robot-kit",          // slugify(name), computed at read time
    "name": "Quarky Robot Kit",
    "tagline": "The hands-on robot at the heart of Digifunzi",   // "" if unset
    "storeCategory": "kit" | "bundle" | "accessory" | null,
    "badge": "Core kit",                  // short marketing tag, "" if unset
    "stockStatus": "available" | "preorder" | "coming_soon",     // drives the buy button
    "image": "string | null",             // absolutized (§6) — an upload URL or null
    "price": {                            // null when no amount is set → "Enquire for pricing"
      "amount": 14500,                    // whole currency units (KES 14,500), no fractional pricing
      "currency": "KES",
      "unit": "each" | null,              // "/ each", "/ learner", …
      "note": "School and bulk pricing available.",
      "compareAt": 21300 | null           // optional strike-through "was" price
    },
    "highlightCount": integer             // # of selling-point bullets (detail has the list)
  }
]
```

Newest first, then sorted by name. Slug collisions collapse to one — prefer the
one with an image, then a price, then the first.

### 3.11 `GET /api/public/store/:idOrSlug` → `200` | `404`

List item **plus** the marketing detail:

```jsonc
{
  "id": "uuid", "slug": "...", "name": "...", "tagline": "...",
  "storeCategory": "kit" | null, "badge": "...", "stockStatus": "available",
  "image": "https://.../uploads/x.png" | null,
  "price": { "amount": 14500, "currency": "KES", "unit": "each", "note": "...", "compareAt": null } | null,
  "highlightCount": 4,
  "description": "string",              // inventory.description — plain text
  "highlights": ["Beginner-friendly block coding", "…"],   // selling points
  "includes":   ["Quarky main board", "USB cable", "…"],   // "what you get"
  "specs":      [ { "label": "Programming", "value": "Block editor and Python" } ],
  "gallery":    ["https://.../uploads/a.png", "…"]          // extra images beyond `image`, absolutized
}
```

`404 { "message": "Store item not found" }` for an unknown id/slug, an item owned
by a different admin, or one that isn't `for_sale` — undifferentiated.

**Buying:** no checkout. The website's "Enquire to buy" links to
`/enroll?interestedIn=<quarky|general>&referenceId=<slug>` → `POST /api/public/leads`
(§4.1). The Enquiries page resolves the slug to the item name server-side
(`referenceType: "store_item"`).

---

## 4. Write endpoints — Enroll & Contact

Both are **notify-first**: the row is persisted in `leads` **and** every admin
gets an in-app notification (no email yet — see §7). The visitor gets only a
friendly acknowledgement string. No account, no magic link.

**Rate limit: 20 requests / 15 min / IP** on each (plus the global 3000/15min/IP
across all `/api/*`).

### 4.1 `POST /api/public/leads`

`Content-Type: application/json`. Body:

```jsonc
{
  "parentName":  "string, 2–120 chars — REQUIRED",
  "parentEmail": "valid email, ≤160 chars — REQUIRED",
  "parentPhone": "string 7–20 chars, /^[+0-9()\\-\\s]+$/ — optional server-side; the Enroll form requires it client-side",
  "learnerName": "string ≤120 chars — optional (\"\" allowed, e.g. from the Contact form)",
  "learnerAge":  "integer 3–19 — optional / null",
  "interestedIn": "\"bootcamp\" | \"project\" | \"quarky\" | \"general\"  — optional, default \"general\". A Store enquiry uses \"quarky\" (a kit) or \"general\" (bundle/accessory); the exact item is in referenceId. \"bootcamp\" is still accepted/stored as-is even though it has no backing catalog.",
  "referenceId": "string ≤100 chars — optional / null. Stored as-is (no validation). Resolves to a display name server-side (GET /api/leads) when it's the slug/id of: an operational pathway, a for-sale project assessment (§3.3), or a for-sale inventory item (§3.10). Otherwise stored and shown as a bare string.",
  "note":        "string ≤1000 chars — optional (\"\" allowed)"
}
```

**Success — `201`:**

```jsonc
{
  "ok": true,          // ← the flag the website's form hooks check
  "success": true,     // ← consistency with the rest of this API
  "message": "Thanks! Our team will contact you to arrange next steps.",
  "data": { /* the created lead record */ }
}
```

The website's axios treats any 2xx as success and reads `response.data.ok` +
`response.data.message` (shown verbatim). **`201`, not `200`** — a record is
created. Resolution of the earlier `200`/`ok` mismatch: backend now sends `ok:
true` and keeps `201`.

**Validation error — `400`:**

```jsonc
{
  "success": false,
  "message": "Validation failed",
  "errors": [ /* Zod issues array: { path, message, code, ... } */ ]
}
```

The website's interceptor normalises any error to `{ status, message, raw }`, so
it reads `message` for the toast and can dig into `raw.errors` for field-level
detail. **`400`, not `422`** — this is the system-wide validation status
(`error.middleware.js`); it was not special-cased for the public routes.
`raw` on the website side = our full body, so `errors[]` is available there.

### 4.2 `POST /api/public/contact`

Kept as a **separate endpoint** (answer to website §5 "one inbox or two?"). Body:

```jsonc
{
  "name":    "string, 2–120 chars — REQUIRED",
  "email":   "valid email, ≤160 chars — REQUIRED",
  "phone":   "string 7–20 chars, same regex — optional",
  "message": "string, 10–2000 chars — REQUIRED"
}
```

**Success — `201`:**

```jsonc
{
  "ok": true,
  "success": true,
  "message": "Message received. We usually reply within one working day.",
  "data": { /* the created lead record */ }
}
```

Validation error: same `400` shape as §4.1.

Both endpoints land in the same `leads` table, distinguished by
`source` (`"enroll"` vs `"contact"`), and both notify all admins — so it's
effectively one inbox with a source tag. If the website later prefers a single
endpoint, flip `ContactForm` to `useLeadsEndpoint` (posts to `/leads` with
`interestedIn: "general"`) — that path already works, no backend change.

### 4.3 `POST /api/public/diagnostics/:pathwayIdOrSlug/submit`

Grades the answers **synchronously** (same request, no polling) and returns the
report. **No contact info is asked for, and no lead is created** — the visitor
submits their answers and sees their graded report immediately, plus a permanent
shareable link to it. Enrolment is a separate, later step via the normal
`POST /api/public/leads` (§4.1), which collects name/email there. Body:

```jsonc
{
  "answers": [
    { "itemId": "string", "response": /* string | string[] | [{left,right}] — shape depends on the item's kind, same contract AssessmentTaker already produces */ }
  ],
  "childName": "string ≤120 chars — OPTIONAL (just so the report reads nicely, e.g. \"… for Amara, age 10\")",
  "childAge":  "integer 3–19 — REQUIRED (must fall within the pathway's configured age range or this 404s, same as the GET)"
}
```

Unknown extra keys (a stray `parentName`/`parentEmail`) are **silently stripped** —
sending the old body still works, the contact fields are just ignored.

**Success — `201`:**

```jsonc
{
  "ok": true,
  "success": true,
  "message": "Here's how it went!",
  "data": {
    "attemptId": "uuid",
    "pathwayName": "string",
    "assessmentName": "string",
    "totalScore": number,
    "maxScore": number,
    "itemResults": [
      { "itemId": "string", "correct": boolean, "marksAwarded": number, "maxMarks": number }
    ],
    "indicatorBreakdown": [
      { "indicatorId": "uuid", "name": "string | null", "marksEarned": number, "marksPossible": number }
    ]
  }
}
```

No `leadId` (there is no lead). `data` carries everything needed to render the
report in one response — no second fetch. `overallFeedback`/`gradedByName` are
never present (auto-graded only, no teacher ever touches it).

**`data.attemptId`** is the key to the permanent shareable report (§3.9). The
website builds the report URL as
`/pathways/<slug>/diagnostic/report/<attemptId>` and shows it on the results
screen (copy-to-clipboard + an "open & download" link). **The report is never
emailed** — this link is the only way it's kept. The diagnostic sends no mail at
all.

`404 { "message": "No public diagnostic available" }` — same undifferentiated
shape and same causes as the GET endpoint (§3.8): unknown pathway, age out of
range, or no longer offerable (e.g. an admin turned the flag off, or edited
the assessment to add a manual item, between the visitor loading the page
and submitting).

Validation error (missing/out-of-range `childAge`): same `400` shape as §4.1.

**Rate limit: 20 requests / 15 min / IP** — same shape/ceiling as §4.1/§4.2
(`publicLeadLimiter`), since this is structurally the same kind of endpoint
(a form submission that creates a lead and notifies admins), just with
grading attached.

Every completed attempt is stored server-side (`public_diagnostic_attempts`,
`leadId` now nullable — it's always null for the diagnostic) as a full audit
trail and for completion analytics. One projection of it **is** exposed publicly
— the shareable report at `GET /api/public/diagnostics/attempts/:attemptId` (§3.9)
— but only a narrow, PII-safe subset (no `ipHash`); the rest stays admin-only.
**Retakes are unlimited** — no uniqueness constraint; each attempt gets its own
shareable report.

---

## 5. CORS / environment

| Var | Side | Value | Meaning |
|---|---|---|---|
| `VITE_API_URL` | website | `https://nodeapp.digifunzi.com` (prod) / `http://localhost:5000` (dev) | Backend base URL |
| `VITE_USE_MOCK` | website | `false` both envs | `true` = fixtures, no network. Already `false` — no cut-over change needed. |
| `VITE_SITE_URL` | website | `https://africa.digifunzi.com` | Website's own origin (canonical, sitemap) |
| `CLIENT_URL` | backend | `https://curriculum.digifunzi.com` | Admin portal. Sends cookies, `credentials: true`. **Required.** |
| `PUBLIC_SITE_URL` | backend | **comma-separated** — see below | Website origin(s). Optional (routes work for server-to-server without it). |
| `API_PUBLIC_URL` | backend | `https://nodeapp.digifunzi.com` | This API's own external base — used to absolutize `coverImage` (§6). Optional. |
| `PUBLIC_CONTENT_ADMIN_ID` | backend | one admin's `users.id` | Which tenant's content the whole public site shows — the operational `pathways` / curricula behind **all five** endpoints in §3.5–3.6 and §3.8. Unset → all five return `503`. Set it to the `users.id` of whichever admin's Curriculum → Competency Framework is the public-facing one. |

### `PUBLIC_SITE_URL` — comma-separated

Backend change (§8): `PUBLIC_SITE_URL` accepts a comma-separated list. A request
with **no `Origin` header** (curl, server-to-server) is always allowed. A
disallowed origin gets **no CORS header** (clean browser block) — it does *not*
error on the backend, so an `OPTIONS` from an unlisted origin returning `200`
with no `Access-Control-*` headers is expected.

**Production value (confirmed with the landing team):**

```
PUBLIC_SITE_URL=https://africa.digifunzi.com,http://localhost:4199,http://localhost:5175
```

- `https://africa.digifunzi.com` — the deployed site. **This subdomain only** —
  no `www`, no apex (`digifunzi.com` is a different system), no staging.
- `http://localhost:4199` — the landing site's `scripts/prerender.js` origin
  during `npm run build`.
- `http://localhost:5175` — the landing team's local dev server, for testing
  against live before deploy. Can be trimmed from prod config later.

`OPTIONS` preflight and `Content-Type` are handled automatically by the `cors`
middleware; allowed methods are `GET, POST, PUT, PATCH, DELETE, OPTIONS`.

---

## 6. Images — `coverImage` — RESOLVED: backend returns absolute URLs

**Implemented (§8).** Every `/api/public/*` response returns `coverImage` as an
**absolute URL**: a stored `/uploads/x.png` comes back as
`https://nodeapp.digifunzi.com/uploads/x.png`. Values already absolute (a pasted
CDN/stock URL), protocol-relative (`//…`), or `data:` URIs pass through
unchanged. Applies to pathway-detail course covers, **project `coverImage`
(§3.3/§3.4), and store `image` + `gallery[]` (§3.10/§3.11)**.

Driven by `API_PUBLIC_URL` (§5). If unset (local dev), the raw stored value is
returned and the landing site's own `resolveMediaUrl` fallback prefixes
`VITE_API_URL`. If uploads later move to a CDN, point `API_PUBLIC_URL` at the CDN
— no website change.

---

## 7. Open items

| # | Item | Owner | Notes |
|---|---|---|---|
| 1 | **Bootcamps/Projects content (API + admin UI) removed entirely**, 4 Sep 2026 — see the notice at the top of this doc. Was briefly built same-release, then pulled once it became clear "bootcamp" duplicates the existing `programs` concept. | Backend | Not blocking — website should drop any dependency on `/api/public/{bootcamps,projects}`. See [LEADS_IMPLEMENTATION.md §2.5](LEADS_IMPLEMENTATION.md#25-content-authoring--removed) if/when this gets rebuilt on top of `programs` instead. |
| 2 | ~~`coverImage` absolute vs relative~~ — **RESOLVED**: backend returns absolute (§6, §8). | — | Done. |
| 3 | Pathway (template) slugs are still computed from `name` — renaming a template still changes its public URL. **The diagnostic link is no longer affected** (it's a real FK now, §3.8), but inbound links / SEO history to the old URL still break. | Both | Acceptable for now; add a `slug` column + 301 map if it becomes a problem. |
| 4 | Lead **email** (SMTP) — **mostly RESOLVED**: mailer, auto-ack, and in-portal reply are all built (see [LEADS_IMPLEMENTATION.md §2.6](LEADS_IMPLEMENTATION.md#26-outbound-email)). Only real SMTP credentials are still missing (§3.1 there) — until set, sends silently no-op and behavior matches the old in-app-only state. | Backend | Remaining: pick a provider, set `SMTP_HOST/PORT/USER/PASS` + `MAIL_FROM`/`MAIL_REPLY_TO` on the backend host. Staff email digest (Option B's last piece) still open. |
| 5 | ~~`interestedIn: "quarky"`~~ — **RESOLVED**: standalone product enquiry, `referenceId: null`, no programme record. | — | Enquiries page shows "Interested in: Quarky robot" with no link. |
| 5b | `referenceId` → human context — **partially resolved**: `GET /api/leads` resolves it against pathways only (bootcamp/project catalogs are gone, see item 1) and the Enquiries card shows "Enquired from: <name>" when it does. | — | See [LEADS_IMPLEMENTATION.md §2.7](LEADS_IMPLEMENTATION.md#27-referenceid--human-context). |
| 6 | Any "lead submitted" **webhook** back to the website (analytics)? | Website | None today, none requested; backend never calls the website. |
| 7 | ~~Prod `PUBLIC_SITE_URL`~~ — **RESOLVED**: `https://africa.digifunzi.com,http://localhost:4199,http://localhost:5175` (§5). | — | Backend to deploy. |
| 8 | Honeypot field (`companyWebsite`) — landing team can forward it for a server-side backstop. | Both | Deferred — client check + 20/15min IP rate limit deemed enough for launch. Revisit if spam gets through. |
| 9 | ~~Public diagnostics — website not built yet~~ — **RESOLVED**: the full flow (pathway detail CTA → age → questions → contact → graded report → details → enroll) is built and verified end-to-end. **What's left is content authoring, not code** (item 12). | Website / Curriculum | Website done. |
| 12 | **Public diagnostics have no real per-pathway content.** The designated admin's public pathways currently share one placeholder assessment ("Robotics Starting-Point Diagnostic"), no pathway has `minAge`/`maxAge` set (so — with the strict gate — **nothing is offerable**), and no assessment items carry competency `indicatorMarks` (so the report's learner-profile "Competency Breakdown" section never renders). | **Curriculum team** (portal, no code) | Per public pathway (Curriculum → Competency Framework): author a dedicated auto-gradable assessment with items tagged to indicators; set the pathway's min/max age; set `diagnosticAssessmentId` + `publicDiagnosticEnabled`. The report's breakdown section lights up automatically once items are tagged. See `Guide/PUBLIC_DIAGNOSTIC_SETUP.md`. |
| 10 | Admin notification copy for a diagnostic lead currently reads the raw `interestedIn` value verbatim ("...is interested in pathway_diagnostic for..." — same generic phrasing every other `interestedIn` value gets, since `_notifyAdmins` only special-cases `"general"`). | Backend | Cosmetic — the lead itself and its `message` (the actual score) are correct; only the notification bell's phrasing reads awkwardly. A one-line addition to `lead.service.js`'s `_notifyAdmins` label logic fixes it. |

| 11 | ~~`GET /api/public/pathways` showed the wrong data~~ — **RESOLVED** (§8 item 0). First it leaked every admin's `pathway_templates` (fixed by scoping to `PUBLIC_CONTENT_ADMIN_ID`); then it became clear `pathway_templates` was the wrong table entirely — a Settings-side "reusable template" list that had drifted from the real curriculum. Now serves the designated admin's **operational** `pathways` (Curriculum → Competency Framework). | — | Done. `PUBLIC_CONTENT_ADMIN_ID` is required for all five public endpoints. |

---

## 8. Backend changelog — changes made to match this contract

On the `modules` branch (website-reconciliation pass):

0. **`server/src/modules/public-site/public-site.service.js` — public pathways now
   come from the OPERATIONAL `pathways` table** *(9 Sep 2026)*. `listPathways` /
   `getPathway` read the designated admin's `pathways` rows (across every
   curriculum they own — `pathways` is tenant-scoped via
   `curriculumId → curricula.ownerAdminId`), not the `pathway_templates` catalog.
   The templates catalog turned out to be a hand-maintained Settings-side list
   that drifted from the actual curriculum — the real courses / age range /
   diagnostic all live on the operational pathway. Course order = the pathway's
   `courseSequence` then any unsequenced `courses[]`. 0-course pathways are
   omitted from the list. Slug collisions (two of the admin's pathways, same
   computed name) collapse to the one with courses / a diagnostic / first.
   `503` if `PUBLIC_CONTENT_ADMIN_ID` unset. **The `pathway_templates` table and
   its `pathway-template.*` module are untouched** — the portal's "reusable
   template library" feature keeps working; the public site just stopped reading it.

0b. **Strict age gate + richer diagnostic responses** *(8–9 Sep 2026)*:
   - **`public-diagnostic.service.js`** — a public diagnostic is offerable only
     when the pathway has **both** `minAge` and `maxAge` set (a missing bound used
     to mean "any age" — now "not configured", so the anonymous path fails safe).
     `resolveDesignatedPathway` resolves `:idOrSlug` against the operational
     pathways by id then computed slug. New `diagnosticInfo()` (available + age
     range); `getDiagnostic` echoes `minAge`/`maxAge`.
   - **`public-site.service.js`** — `getPathway` embeds a `diagnostic` object
     (§3.6). **`public-diagnostic.controller.js`** — `/availability` returns
     `minAge`/`maxAge` too.
   - **`pathway-template.validation.js`** — unrelated bug fix found along the way:
     `updatePathwaySchema` was `createSchema.partial()`, but Zod's `.default()`
     still fires for absent keys, so a partial `PUT /api/pathway-templates/:id`
     would silently blank `description`/`color`/`courses`. Rebuilt from no-default
     field schemas.
   - **Website** — `PathwayDetailPage` reads the embedded `diagnostic` (falls
     back to `/availability`); `DiagnosticPage`'s age step is bounded to the
     offered range. Mocks/fixtures updated to match.

1. **`server/src/modules/leads/lead.controller.js`** — `POST /api/public/leads`
   and `/contact` success bodies now include `ok: true` alongside the existing
   `success` / `message` / `data`. Status stays `201`. (The landing team's forms
   key off the promise state, not `.ok` — this is harmless either way.)
2. **`server/src/app.js`** — CORS `origin` is a function checking a list;
   `PUBLIC_SITE_URL` is parsed as comma-separated. No-Origin requests
   (server-to-server) allowed; a disallowed origin gets no CORS header (not a
   500). Explicit `methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]`.
3. **`server/src/config/env.js`** + **`server/.env`** — comma-separated
   `PUBLIC_SITE_URL`; new `API_PUBLIC_URL` for §6.
4. **`server/src/shared/utils/media-url.js`** (new) + **`public-site.controller.js`**
   + **`public-site.service.js`** — `coverImage` in every `/api/public/*` response
   is absolutized via `API_PUBLIC_URL`; already-absolute / protocol-relative /
   `data:` values pass through. Admin `/api/site/*` responses keep the raw path.

**Not changed** (and why):

- Validation errors stay `400` (not `422`) — that's the system-wide
  `error.middleware.js` shape; special-casing the public routes would be
  inconsistent. The body carries `message` + `errors[]`; the landing site's
  interceptor exposes those as `message` + `raw`.
- `parentPhone` stays optional server-side — the Enroll form enforces it
  client-side; no reason to reject a valid lead that omits it.

### Deploy steps for these changes

Set on the backend host (not in git — `.env` is gitignored):

```
PUBLIC_SITE_URL=https://africa.digifunzi.com,http://localhost:4199,http://localhost:5175
API_PUBLIC_URL=https://nodeapp.digifunzi.com
```

No migration, no `package.json` change. Restart the server.

---

## 9. Cut-over checklist

1. ✅ Backend `/api/public/*` shipped (§2) — `ok: true`, multi-origin CORS,
   absolute `coverImage` (§8).
2. **Backend:** deploy `PUBLIC_SITE_URL` + `API_PUBLIC_URL` (§8), restart, tell
   the landing team it's live.
3. **Website:** `VITE_USE_MOCK=false`, confirm
   `VITE_API_URL=https://nodeapp.digifunzi.com`, trim the success copy to a
   no-timeframe string.
4. **Website:** `npm run build`; confirm the prerender log fetches the data
   routes (not "API unreachable").
5. **Website:** deploy, submit one real Enroll + one real Contact from the live
   site.
6. **Backend:** confirm both rows land in the Enquiries page — one "Enrol
   interest" (`source: "enroll"`), one "Contact form" (`source: "contact"`),
   both `status: "new"`, with the Enroll one's `referenceId` slug resolved to a
   programme name. Confirm the admin can see email/phone to reply (Option A).
7. Rollback if needed = the landing site's one-line `VITE_USE_MOCK=true` env
   change.

---

## 10. Quick reference

```
# Public (no auth) — the website uses these
GET   /api/public/pathways
GET   /api/public/pathways/:idOrSlug
GET   /api/public/projects                  # for-sale `type: project` assessments (§3.3)
GET   /api/public/projects/:idOrSlug        # + build steps / deliverables / kit (§3.4)
GET   /api/public/store                     # for-sale `inventory` items — robots, kits (§3.10)
GET   /api/public/store/:idOrSlug           # + highlights / "what you get" / specs (§3.11)
POST  /api/public/leads      { parentName, parentEmail, parentPhone?, learnerName?, learnerAge?, interestedIn?, referenceId?, note? }
POST  /api/public/contact    { name, email, phone?, message }
GET   /api/public/learners/:publicToken     (QR share — not website-relevant)

# Public diagnostics (no auth) — see §3.8, §3.9, §4.3. Backend + website both live.
GET   /api/public/diagnostics/:pathwayIdOrSlug/availability
GET   /api/public/diagnostics/:pathwayIdOrSlug?age=
GET   /api/public/diagnostics/attempts/:attemptId            # permanent shareable graded report (§3.9)
POST  /api/public/diagnostics/:pathwayIdOrSlug/submit   { answers, childName?, childAge }
#   → 201 { data: { attemptId, ... } }  — NO contact info, NO lead
#   website report URL = /pathways/<slug>/diagnostic/report/<attemptId>
#   the report is shown on-screen + at that link — NEVER emailed
#   enrolment is separate: POST /api/public/leads via /enroll?referenceId=<slug>

# REMOVED 9 Sep 2026 — 404 now, do not call:
#   PATCH /api/public/leads/:id   (was the diagnostic's post-report details step — no lead any more)

# REMOVED 4 Sep 2026 — 404 now, do not call:
#   GET   /api/public/bootcamps[/:idOrSlug]
#   GET|POST|PUT|DELETE  /api/site/*
#   (/api/public/projects came BACK 9 Sep 2026 as a different feature — see §3.3;
#    /api/public/store is also NEW 9 Sep 2026 — see §3.10)

# Admin (JWT, role: admin) — the boundary, for reference
GET    /api/leads?status=&source=
PATCH  /api/leads/:id/status          { status: "new" | "contacted" | "closed" }
```
