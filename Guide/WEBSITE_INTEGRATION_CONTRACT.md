# Website ⇄ Curriculum System — Integration Contract

**Reconciled contract.** This merges the Curriculum system's view (this repo) with
`digifunzi-landing`'s `System Integration` doc. Where the two differed, the
resolution is recorded inline and the backend has been changed to match — see
§8 changelog.

> **⚠️ Bootcamps/Projects removed (4 Sep 2026).** `GET /api/public/bootcamps`,
> `GET /api/public/projects`, and the admin-only `/api/site/*` authoring API
> are **gone** — routes now 404. This was a same-day build-then-remove: a
> `public_bootcamps`/`public_projects` marketing-content table duplicated what
> a "bootcamp" already means in this system (a deployed **Program**), so it
> was pulled rather than left as dead weight to reconcile later. **Only
> `GET /api/public/pathways[/:idOrSlug]` and the two `POST` lead/contact
> endpoints are live** — every table/section below marked ✅ for bootcamps or
> projects is now stale; treat this notice as authoritative over those. If
> `digifunzi-landing` still calls the bootcamp/project endpoints, those calls
> will 404 until/unless a replacement ships (see
> [LEADS_IMPLEMENTATION.md §2.5](LEADS_IMPLEMENTATION.md#25-content-authoring--removed)).

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
| `GET` | `/api/public/projects` | Project (course) list | ❌ removed 4 Sep 2026 — 404s |
| `GET` | `/api/public/projects/:idOrSlug` | Project detail | ❌ removed 4 Sep 2026 — 404s |
| `GET` | `/api/public/pathways` | Pathway list | ✅ live (on `modules` branch → master) |
| `GET` | `/api/public/pathways/:idOrSlug` | Pathway detail (ordered courses) | ✅ live |
| `POST` | `/api/public/leads` | Enrol-interest capture → notify admins | ✅ live |
| `POST` | `/api/public/contact` | General enquiry → notify admins | ✅ live (separate endpoint kept — see §4.2) |
| `GET/POST/PUT/DELETE` | `/api/site/*` | Admin content authoring | ❌ removed 4 Sep 2026 — 404s |

> **"Is the pathways endpoint merged?"** (website §5) — yes. It's in the
> `learning-areas → pathways` work, now merged to `master` (commit `98e3938`).

---

## 3. Read endpoints — exact shapes

`:idOrSlug` resolves by `id` (uuid) first, then by slug. Slugs are derived
server-side from `name` via `server/src/shared/utils/slugify.js`. Website cards
link by **slug**.

### 3.1–3.4 Bootcamps/Projects — REMOVED, kept below for historical reference only

**These four endpoints no longer exist** (removed 4 Sep 2026 — see the notice
at the top of this doc). The shapes below describe what they *used to* return;
do not build against them. Kept here in case this content ever gets
reintroduced (most likely reusing the operational `programs`/`curricula`
tables rather than a standalone marketing table — see
[LEADS_IMPLEMENTATION.md](LEADS_IMPLEMENTATION.md) for the design discussion
that led to removal).

### 3.1 `GET /api/public/bootcamps` → `200`, array

```jsonc
[
  {
    "id": "uuid",
    "name": "Junior Robotics Bootcamp",
    "slug": "junior-robotics-bootcamp",
    "description": "string",           // as authored
    "coverImage": "string | null",     // see §6 — may be absolute URL or /uploads/... path
    "status": "upcoming" | "active" | "completed",
    "startDate": "YYYY-MM-DD | null",
    "endDate": "YYYY-MM-DD | null",
    "educationLevel": "string | null",
    "gradeFrom": "string | null",
    "gradeTo": "string | null",
    "classes": ["string", ...],        // detail-page extra; present in list too, may be []
    "courses": [{ "name": "string", "slug": "string" }],  // detail-page extra; may be []
    "isPublished": true,
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601"
  }
]
```

Published only (`isPublished: true`), newest first.

### 3.2 `GET /api/public/bootcamps/:idOrSlug` → `200` | `404`

Same object. `404 { "message": "Bootcamp not found" }` for unknown id/slug **or**
an unpublished record.

### 3.3 `GET /api/public/projects` → `200`, array  *(Projects = Courses)*

```jsonc
[
  {
    "id": "uuid",
    "name": "Intro to Robotics",
    "slug": "intro-to-robotics",
    "description": "string",           // course rich-text HTML flattened to plain text server-side
    "coverImage": "string | null",
    "ageMin": 0-25 | null,
    "ageMax": 0-25 | null,
    "sessionCount": integer | null,
    "requirements": ["string", ...],
    "modules": ["string", ...],        // detail-page extra
    "isPublished": true,
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601"
  }
]
```

### 3.4 `GET /api/public/projects/:idOrSlug` → `200` | `404`

Same object. `404 { "message": "Project not found" }`.

### 3.5 `GET /api/public/pathways` → `200`, array

```jsonc
[
  {
    "id": "uuid",
    "slug": "robotics",            // computed from name at read time — no slug column
    "name": "Robotics",
    "description": "string",
    "color": "#25476a",            // brand colour, default "#25476a"
    "courseCount": integer         // ids in pathway_templates.courses that still resolve to an active course
  }
]
```

**Every pathway template is public the moment it exists** — there is no
published/draft flag (website §5). A pathway with 0 resolvable active courses
still appears here with `courseCount: 0`; only its *detail* route 404s.

### 3.6 `GET /api/public/pathways/:idOrSlug` → `200` | `404`

List item **plus** an **ordered** `courses` array (template order = learning
sequence). Exactly these fields per course:

```jsonc
{
  "id": "uuid", "slug": "...", "name": "...", "description": "...",
  "color": "#25476a", "courseCount": 3,
  "courses": [
    {
      "name": "string",
      "description": "string",     // plain text
      "ageMin": integer | null,
      "ageMax": integer | null,
      "coverImage": "string | null"
    }
  ]
}
```

Only `active` courses. Internal course id is **never** exposed.
`404 { "message": "Pathway not found" }` for an unknown id/slug **or** a pathway
whose every course is inactive.

### 3.7 `GET /api/public/learners/:publicToken` → `200` | `404`

The "share via QR" learner profile. Read-only, deliberately narrow field set.
**Not marketing-site relevant** — listed for completeness only.

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
  "interestedIn": "\"bootcamp\" | \"project\" | \"quarky\" | \"general\"  — optional, default \"general\". Still accepted/stored as-is even though bootcamp/project no longer have a backing catalog — see the notice at the top of this doc.",
  "referenceId": "string ≤100 chars — optional / null. Still accepted and stored as-is (no validation) — but only resolves to a display name server-side (GET /api/leads) when it's a pathway slug/id. A bootcamp/project referenceId is stored and shown as a bare string, unresolved.",
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
unchanged. Applies to pathway-detail course covers — **the bootcamp/project
endpoints this originally also applied to are removed**, see the notice at
the top of this doc.

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
| 3 | Pathway slugs are computed from `name` — renaming a pathway changes its public URL. | Both | Acceptable for now; add a `slug` column + 301 map if it becomes a problem. Not blocking (pathways on fixtures at launch). |
| 4 | Lead **email** (SMTP) — **mostly RESOLVED**: mailer, auto-ack, and in-portal reply are all built (see [LEADS_IMPLEMENTATION.md §2.6](LEADS_IMPLEMENTATION.md#26-outbound-email)). Only real SMTP credentials are still missing (§3.1 there) — until set, sends silently no-op and behavior matches the old in-app-only state. | Backend | Remaining: pick a provider, set `SMTP_HOST/PORT/USER/PASS` + `MAIL_FROM`/`MAIL_REPLY_TO` on the backend host. Staff email digest (Option B's last piece) still open. |
| 5 | ~~`interestedIn: "quarky"`~~ — **RESOLVED**: standalone product enquiry, `referenceId: null`, no programme record. | — | Enquiries page shows "Interested in: Quarky robot" with no link. |
| 5b | `referenceId` → human context — **partially resolved**: `GET /api/leads` resolves it against pathways only (bootcamp/project catalogs are gone, see item 1) and the Enquiries card shows "Enquired from: <name>" when it does. | — | See [LEADS_IMPLEMENTATION.md §2.7](LEADS_IMPLEMENTATION.md#27-referenceid--human-context). |
| 6 | Any "lead submitted" **webhook** back to the website (analytics)? | Website | None today, none requested; backend never calls the website. |
| 7 | ~~Prod `PUBLIC_SITE_URL`~~ — **RESOLVED**: `https://africa.digifunzi.com,http://localhost:4199,http://localhost:5175` (§5). | — | Backend to deploy. |
| 8 | Honeypot field (`companyWebsite`) — landing team can forward it for a server-side backstop. | Both | Deferred — client check + 20/15min IP rate limit deemed enough for launch. Revisit if spam gets through. |

---

## 8. Backend changelog — changes made to match this contract

On the `modules` branch (website-reconciliation pass):

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
POST  /api/public/leads      { parentName, parentEmail, parentPhone?, learnerName?, learnerAge?, interestedIn?, referenceId?, note? }
POST  /api/public/contact    { name, email, phone?, message }
GET   /api/public/learners/:publicToken     (QR share — not website-relevant)

# REMOVED 4 Sep 2026 — 404 now, do not call:
#   GET   /api/public/bootcamps[/:idOrSlug]
#   GET   /api/public/projects[/:idOrSlug]
#   GET|POST|PUT|DELETE  /api/site/bootcamps[/:id]
#   GET|POST|PUT|DELETE  /api/site/projects[/:id]

# Admin (JWT, role: admin) — the boundary, for reference
GET    /api/leads?status=&source=
PATCH  /api/leads/:id/status          { status: "new" | "contacted" | "closed" }
```
