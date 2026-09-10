# Pathway Integration — Website ⇄ Curriculum System

**Comprehensive implementation reference.** How a *Pathway* authored inside the
curriculum portal reaches the public marketing site (`africa.digifunzi.com`) — the
list page, the detail page, the anonymous diagnostic flow (submit → instant on-screen
report + permanent shareable link, **no contact details asked, no email**), and the
Enroll / Contact lead capture that closes the loop back to staff.

This doc is the *implementation* companion to two others:

| Doc | Purpose |
|---|---|
| `Guide/WEBSITE_INTEGRATION_CONTRACT.md` | The API contract — exact request/response shapes, status codes, CORS. |
| `Guide/PUBLIC_DIAGNOSTIC_SETUP.md` | The content-authoring checklist for whoever fills in curriculum content. |
| **this doc** | Every moving part in the codebase — files, data model, control flow, guards, deploy. |

---

## 1. What a Pathway is, on each side

```
Curriculum → Grade/Stage → Subject → Module → Topic → Session      ← the curriculum hierarchy
                    │
             Competency Framework
                    │
                 Pathway  ── an ordered roadmap of Courses a learner follows in one area
                              (e.g. "Computing & Software Creation": Scratch → Python 1 → Python 2)
```

A **Pathway** (`pathways` table) is an *operational* record authored in the portal
under **Curriculum → Competency Framework → Pathways**. It carries:

- `name`, `description`, `color`
- `courses[]` — course ids that belong to the pathway
- `courseSequence[]` — the learning order (+ per-stage default course)
- `diagnosticAssessmentId` — one assessment, auto-issued to enrolled learners to place them
- `minAge` / `maxAge` — the age range the diagnostic applies to
- `publicDiagnosticEnabled` — **the switch that exposes the diagnostic to anonymous website visitors**

The **public site** reads a *projection* of this same record. It never sees internal
course ids, never sees `correctAnswer`, and only ever sees **one designated admin's**
pathways (multi-tenant isolation — see §4).

> **History:** the public site *used to* read a separate `pathway_templates`
> "reusable template library" from Settings → Pathways. That table was
> hand-maintained and drifted from the real curriculum. Since **9 Sep 2026** the
> public endpoints read the operational `pathways` table directly. `pathway_templates`
> still exists for the portal's own template feature; the public site just no longer
> reads it. (`lead.service.js`'s `_resolveReference` — which turns a lead's
> `referenceId` into a display name on the Enquiries card — was updated to match:
> it resolves against the designated admin's operational `pathways` first, then falls
> back to `pathway_templates` for older leads.)

---

## 2. File map

### 2.1 Backend — curriculum system (`server/`)

| File | Role |
|---|---|
| `src/modules/public-site/public-site.routes.js` | `GET /api/public/pathways`, `GET /api/public/pathways/:idOrSlug` |
| `src/modules/public-site/public-site.controller.js` | Thin — bare array/object responses, 404 on null |
| `src/modules/public-site/public-site.service.js` | **All pathway projection logic** — tenant scoping, slug computation, course ordering, HTML→text, `coverImage` absolutization, embedded `diagnostic` block |
| `src/modules/public-site/public-diagnostic.routes.js` | `GET /diagnostics/attempts/:attemptId`, `GET /diagnostics/:p/availability`, `GET /diagnostics/:p?age=`, `POST /diagnostics/:p/submit` + rate limiters |
| `src/modules/public-site/public-diagnostic.controller.js` | Thin — `hashIp`, response wrappers, `getAttemptReport` |
| `src/modules/public-site/public-diagnostic.service.js` | **All diagnostic logic** — resolve pathway, offerability gate, item sanitization, synchronous grading + `source: "diagnostic"` lead creation, `getAttemptReport` (the shareable link) |
| `src/modules/public-site/public-diagnostic.validation.js` | Zod schema for `POST .../submit` — just `{ answers, childName?, childAge }` |
| `src/modules/public-site/public-diagnostic-attempt.model.js` | `public_diagnostic_attempts` — write-once row; `create` + `findById` (for the shareable link) |
| `src/modules/leads/public-lead.routes.js` | `POST /api/public/leads`, `POST /api/public/contact` (the `PATCH /leads/:id` route was removed) |
| `src/modules/leads/lead.controller.js` / `lead.service.js` / `lead.validation.js` | Enroll/Contact lead creation, admin notification, reference resolution — **not touched by the diagnostic any more** |
| `src/modules/curriculum/competency-framework/competency.service.js` | `createPathway` / `updatePathway` + `assertPublicDiagnosticAllowed` (save-time guard) |
| `src/modules/curriculum/competency-framework/competency.validation.js` | `pathwayFields` Zod schema incl. `publicDiagnosticEnabled`, `minAge`, `maxAge` |
| `src/modules/curriculum/competency-framework/pathway.model.js` | Knex wrapper for `pathways` (JSON fields: `courses`, `courseSequence`) |
| `src/modules/assessments/submissions/grading.utils.js` | `requiresManualGrading`, `computeAutoScore`, `computeMaxScore`, `computeIndicatorBreakdown` — **shared** with the authenticated learner flow, no fork |
| `src/shared/utils/media-url.js` | `toAbsoluteMediaUrl` — `/uploads/x` → `https://nodeapp.digifunzi.com/uploads/x` |
| `src/shared/utils/slugify.js` | `slugify(name)` — computes the public slug (there is no slug column) |
| `src/config/env.js` | `PUBLIC_CONTENT_ADMIN_ID`, `PUBLIC_SITE_URL`, `API_PUBLIC_URL` |
| `src/app.js` | Mounts the three public routers *without* `protect`; multi-origin CORS |
| `src/db/migrations/20260907131100_add_public_diagnostic_enabled_to_pathways.js` | Adds `pathways.publicDiagnosticEnabled` (default `false`) |
| `src/db/migrations/20260907131200_create_public_diagnostic_attempts.js` | Creates `public_diagnostic_attempts` |
| `src/db/migrations/20260909104300_add_items_snapshot_to_public_diagnostic_attempts.js` | Adds `itemsSnapshot` + `itemResults` JSON columns (for the shareable report link) |
| `src/db/migrations/20260909110000_make_public_diagnostic_attempt_lead_nullable.js` | `leadId` → nullable (kept — the lead write can still fail without failing the report) |
| `src/db/migrations/20260910120000_leads_add_diagnostic_source_and_nullable_email.js` | `leads.source` gains `"diagnostic"`; `leads.email` → nullable (the diagnostic asks name + phone only) |
| `src/scripts/seedDiagnosticAssessment.js` | One-off — seeds a sample fully-auto-gradable assessment owned by `PUBLIC_CONTENT_ADMIN_ID` |

### 2.2 Frontend — admin portal (`client/`)

| File | Role |
|---|---|
| `src/modules/curriculum/pages/CompetenciesPage.jsx` | The **Pathways panel** — create/edit form + per-card "Diagnostic Assessment" section with the *"Offer this diagnostic to anonymous visitors on the public website"* checkbox and age-range inputs |

### 2.3 Frontend — public marketing site (`digifunzi-landing/`)

| File | Role |
|---|---|
| `src/services/api.js` | Single axios instance, **no JWT**; `publicApi.listPathways / getPathway / getDiagnosticAvailability / getDiagnostic / submitDiagnostic / updateLeadContactDetails` |
| `src/hooks/usePathways.js` | `usePathways()` (list, with `dedupePathways` defence-in-depth), `usePathway(slug)` |
| `src/hooks/useDiagnostic.js` | `useDiagnosticAvailability`, `useDiagnostic`, `useSubmitDiagnostic`, `useSubmitLeadDetails` |
| `src/pages/PathwaysListPage.jsx` | `/pathways` — grid of `PathwayCard` |
| `src/pages/PathwayDetailPage.jsx` | `/pathways/:slug` — ordered course steps; **"Enroll in this pathway"** + (when `diagnostic.available`) **"Take the diagnostic"** buttons in the header and the bottom CTA |
| `src/pages/DiagnosticPage.jsx` | `/pathways/:slug/diagnostic` — 3 steps (AGE → QUESTIONS → REPORT), **no contact form**; REPORT shows the report + `ReportLinkCard` (shareable URL, copy button) + "Open & download" + "Enroll" |
| `src/pages/DiagnosticReportPage.jsx` | `/pathways/:slug/diagnostic/report/:attemptId` — the permanent shareable report; "Download PDF" = `window.print()` |
| `src/hooks/useDiagnostic.js` | `useDiagnosticAvailability`, `useDiagnostic`, `useSubmitDiagnostic`, `useDiagnosticReport` |
| `src/components/diagnostic/DiagnosticQuestions.jsx` | Question rendering |
| `src/components/diagnostic/DiagnosticReport.jsx` | Graded report — styled like the public shared-learner-profile card; used inline **and** on the standalone page |
| `styles/global.css` | `@media print` block that strips site chrome for the report PDF |
| `src/mocks/fixtures/pathways.js` / `diagnostics.js` | `VITE_USE_MOCK=true` fixtures |

---

## 3. Data model

### 3.1 `pathways` (existing table + one added column)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `curriculumId` | uuid | **tenant scope is transitive**: `curriculumId → curricula.ownerAdminId`. No `ownerAdminId` on `pathways` itself. |
| `name` | string(100) | unique **within one curriculum** only |
| `description` | string(500) | |
| `color` | string | hex, default `#25476a` |
| `courses` | JSON | array of course ids |
| `courseSequence` | JSON | `[{ courseId, order, defaultForStages[] }]` |
| `diagnosticAssessmentId` | string / null | FK-by-convention to `assessments.id` (no DB FK) |
| `minAge` | int / null | |
| `maxAge` | int / null | |
| `publicDiagnosticEnabled` | bool | **added** by migration `20260907131100`, default `false` |

- No slug column. The public slug is `slugify(name)` computed **at read time** in
  `public-site.service.js` and `public-diagnostic.service.js`.
- No DB `FOREIGN KEY` constraints anywhere — referential integrity is
  application-layer, per the repo-wide convention.

### 3.2 `public_diagnostic_attempts` (new table)

One write-once row per completed anonymous diagnostic. **Deliberately NOT
`assessment_submissions`** — that table requires a real `learnerId` (notNullable)
and grading it unconditionally attempts a competency-placement write against a real
`learners` row. An anonymous visitor has no learner record, so forcing one through
`assessment_submissions` would mean fabricating a throwaway learner per attempt.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `pathwayId` | uuid | the operational `pathways.id` |
| `assessmentId` | uuid | |
| `leadId` | uuid | → `leads.id`, created in the **same request** |
| `childAge` | int | |
| `childName` | string(150) / null | |
| `answers` | JSON | the raw submitted answers |
| `itemsSnapshot` | JSON / null | the **sanitized** question set as served (no answer key). Added by migration `20260909104300` — powers the shareable report link's per-question section. Null on pre-migration rows. |
| `itemResults` | JSON / null | per-item `{ itemId, correct, marksAwarded, maxMarks }` as graded at submit. Stored (not re-derived from the shuffled snapshot). Null on pre-migration rows. |
| `totalScore` | float | |
| `maxScore` | float | |
| `indicatorBreakdown` | JSON / null | per-competency-indicator marks |
| `leadId` | string(36) / **null** | Nullable since migration `20260909110000`. Since 10 Sep 2026 the diagnostic **does** create a `source: "diagnostic"` lead (name + phone), and this holds that lead's id. Still null on pre-10-Sep attempts, or if the lead write failed (the report is returned regardless). Never exposed by the shareable-report endpoint. |
| `ipHash` | string(64) / null | **SHA-256 of the IP, never the raw IP** — abuse visibility only |
| `createdAt` | timestamp | no `updatedAt` — write-once |

Indexes: `pathwayId`, `leadId`, `createdAt`. The row is read back by exactly one
public endpoint — `GET /api/public/diagnostics/attempts/:attemptId` (§6.6) — which
projects a **narrow** subset (no `ipHash`). Otherwise admin-only.

### 3.3 `leads` — the diagnostic creates a `source: "diagnostic"` lead *(since 10 Sep 2026)*

Submitting the diagnostic requires a **name + phone** (no email — the `leads.email`
column was made nullable for this). On submit the service creates a lead with
`source: "diagnostic"`, `email: null`, the phone, `learnerName`/`learnerAge` from
`childName`/`childAge`, `interestedIn: "general"`, `referenceId` = the pathway's
computed slug, and `message` = a one-line score summary; then it notifies every
admin (same as the enrol form). The lead's id is stored on the attempt
(`leadId`). If that write fails the graded report is still returned — the
visitor's result never depends on lead capture.

The shareable report (`GET /api/public/diagnostics/attempts/:attemptId`) exposes
**none** of this — no name, no phone, no `leadId`.

The report screen's **"Enroll in this pathway"** button still links to
`/enroll?interestedIn=project&referenceId=<slug>` for a fuller enrolment, but the
team already has a contactable lead from the diagnostic itself.

> **Historical:** the diagnostic first (pre-9 Sep) called `LeadService.submitLead`
> with `interestedIn: "pathway_diagnostic"` and a `PATCH /api/public/leads/:id`
> follow-up; then (9–10 Sep) collected nothing and created no lead; now collects
> name + phone at submit. The `PATCH` route stays removed.

---

## 4. Multi-tenancy — `PUBLIC_CONTENT_ADMIN_ID`

The curriculum system is multi-tenant: every admin's hubs / curricula / pathways /
assessments are isolated. An anonymous visitor has **no login**, so the backend must
be told *explicitly* which one tenant's content the public site shows.

- `env.PUBLIC_CONTENT_ADMIN_ID` = a single `users.id` (must be `role: "admin"`).
- **All five public endpoints** (`/pathways`, `/pathways/:x`, `/diagnostics/:x/availability`,
  `/diagnostics/:x`, `/diagnostics/:x/submit`) return **`503`** if it is unset:
  - `public-site.service.js` → `{ "success": false, "message": "Public content is not configured" }`
  - `public-diagnostic.service.js` → `{ ... "Public diagnostics are not configured" }`
- Resolution walks **every curriculum the designated admin owns**
  (`CurriculumModel.findAll({ ownerAdminId }) → PathwayModel.findByCurriculumId` per curriculum, flattened).

### Slug collisions

Pathway names are unique only *within* one curriculum, and the designated admin can
own several curricula → two of their pathways can compute the same slug. Handled by
`pickForSlug` (list) / inline preference (diagnostic):

1. prefer the match that has **≥1 active course**
2. else the one with `publicDiagnosticEnabled`
3. else the first

Only **one** representative appears in the list; the loser's detail route effectively 404s.

---

## 5. Read flow — list & detail

### 5.1 `GET /api/public/pathways`

```
listPathways()
  └─ designatedAdminPathways()            all pathways across the admin's curricula
  └─ group by computedSlug(p)             Map<slug, pathway[]>
  └─ pickForSlug(each group)              collapse collisions → one per slug
  └─ activeOrderedCourses(each)           resolve courses[] → still-`active` rows, in order
  └─ filter(courseCount > 0)              0-course pathways OMITTED entirely
  └─ map → listItem(p, count)             { id, slug, name, description, color, courseCount }
  └─ sort by name
```

**Course ordering** (`activeOrderedCourses`): `courseSequence` sorted by `order`
first (only ids that are also in `courses[]`), then any `courses[]` ids never
sequenced. Each id resolved via `CourseModel.findById`; anything not found or not
`status === "active"` is dropped. Same rule the portal's own `sequenceFor()` and the
authenticated learner-journey code use.

### 5.2 `GET /api/public/pathways/:idOrSlug`

```
getPathway(idOrSlug)
  └─ designatedAdminPathways()
  └─ find by p.id === idOrSlug  ELSE  pickForSlug(matches where computedSlug === idOrSlug)
  └─ null → 404 { "message": "Pathway not found" }
  └─ activeOrderedCourses(pathway)
  └─ courses.length === 0 → 404          (unknown / wrong-admin / no-active-courses are undifferentiated)
  └─ diagnosticInfoFor(pathway)          wrapped in try/catch — a diagnostic hiccup never breaks the page
  └─ return {
       ...listItem,
       diagnostic: { available, minAge, maxAge },
       courses: [{ name, description(htmlToText), ageMin, ageMax, coverImage(absolute) }]
     }
```

- `htmlToText` flattens TipTap rich-text course descriptions to plain text (strips
  tags, decodes `&nbsp; &amp; &lt; &gt; &#39; &quot;`, collapses blank lines).
- `coverImage` absolutized via `toAbsoluteMediaUrl` (driven by `API_PUBLIC_URL`);
  already-absolute / protocol-relative / `data:` URIs pass through. This projection
  is public-only so admin responses keep the raw path.
- Internal course **id is never exposed**.

### 5.3 `diagnosticInfoFor(pathway)` — the embedded `diagnostic` block

Returns `{ available: false, minAge: null, maxAge: null }` unless **all** hold:

1. `publicDiagnosticEnabled === true`
2. `diagnosticAssessmentId` is set
3. `minAge != null && maxAge != null && minAge <= maxAge`
4. the assessment resolves **and** `!requiresManualGrading(assessment)` — a **live
   re-check** every request (the flag and the assessment are independently editable)

### 5.4 Website defence-in-depth (`usePathways.js` → `dedupePathways`)

Even though the backend now returns clean data, the hook still: drops
`courseCount <= 0` entries, collapses duplicate slugs (keep the most-courses one),
stable-sorts by name. Kept from the era when a misconfigured backend leaked several
admins' templates.

---

## 6. Anonymous diagnostic flow

### 6.1 The offerability gate (`loadOfferableAssessment` + `hasCompleteAgeRange`)

A pathway's diagnostic is offerable to an anonymous visitor **only when**:

| # | Condition | Where enforced |
|---|---|---|
| 1 | `publicDiagnosticEnabled === true` | `loadOfferableAssessment` |
| 2 | `diagnosticAssessmentId` resolves to a **fully auto-gradable** assessment (`!requiresManualGrading`) — live re-check | `loadOfferableAssessment` |
| 3 | **both** `minAge` and `maxAge` set, `minAge <= maxAge` | `hasCompleteAgeRange` |
| 4 | (per request) the supplied `age` / `childAge` is within `[minAge, maxAge]` | `ageInRange` |

**#3 is a fail-safe divergence from the authenticated flow:** for enrolled learners,
a missing age bound means "any age". For the anonymous path, a missing bound means
**"not configured"** — the diagnostic simply won't appear. The authenticated learner
flow (real learner + teacher) never calls this code.

`requiresManualGrading(assessment)` is `true` if: `type === "project"`, OR any
`rubric[]`, OR any observation `indicators[]`, OR any item whose `kind` is not in
`AUTO_GRADABLE_KINDS` = `["mcqSingle", "mcqMultiple", "trueFalse", "matching", "ordering", "fillBlank"]`.

### 6.2 `GET /api/public/diagnostics/:pathwayIdOrSlug/availability`

`diagnosticInfo()` → `{ diagnosticAvailable, minAge, maxAge }`. Never errors (aside
from the `503`-if-unconfigured case). Unknown pathway / no offerable diagnostic both
resolve to `diagnosticAvailable: false`. Mostly a fallback — the detail response
(§5.2) already embeds the same info as `diagnostic`.

### 6.3 `GET /api/public/diagnostics/:pathwayIdOrSlug?age=<int>`

```
getDiagnostic(slug, age)
  └─ resolveDesignatedPathway(slug)     id-then-computed-slug, prefer publicDiagnosticEnabled on collision
  └─ null → return null → 404
  └─ ageInRange(pathway, age) false → null → 404
  └─ loadOfferableAssessment(pathway) null → 404
  └─ buildIndicatorNameMap()           { indicatorId → name } from the global competency catalog
  └─ return {
       pathwayId, pathwayName, assessmentId, name, instructions, minAge, maxAge,
       items: assessment.items.map(sanitizeItem + indicatorNames)
     }
```

**All 404s are undifferentiated** — `{ "message": "No public diagnostic available" }` —
so a probing client can't tell "doesn't exist" from "exists but not public".

**`sanitizeItem`** — strips every field that would reveal the answer, keeping every
field `AssessmentTaker.jsx` needs to *render*:

| Kind | What's removed / neutralised |
|---|---|
| `mcqSingle`, `trueFalse`, `mcqMultiple` | `correctAnswer` dropped outright |
| `fillBlank` | `blanks[]` — each entry replaced with `""` (length is kept — it's how many boxes to render) |
| `ordering` | `sequence[]` — **shuffled** (the real order *is* the answer) |
| `matching` | `pairs[].right` blanked; real rights collected → shuffled → `rightOptions[]` for the picker |

`indicatorNames[]` per item comes from `item.indicatorMarks` resolved to display
names — this is what lets the report show a **Competency Breakdown**. Without
`indicatorMarks` tags the report still shows score + per-question, but no profile section.

**Rate limit: 60 / 15 min / IP** (`readLimiter`) — tighter than the write endpoints
because a GET creates no record and could be probed repeatedly to reconstruct answer
patterns from many sanitized responses.

### 6.4 `POST /api/public/diagnostics/:pathwayIdOrSlug/submit`

Body (`submitDiagnosticSchema`): **`{ answers[], childName?, childAge* }`** — **no
contact info**. `childAge` must be within the pathway's range or the call 404s (same
as the GET); `childName` is optional context stored on the attempt so the report reads
nicely. Unknown extra keys (a stray `parentName` etc.) are silently stripped by Zod.

```
submitDiagnostic(slug, body, ipHash)
  └─ resolveDesignatedPathway → 404 "Pathway not found"
  └─ ageInRange(childAge) false → 404 "No diagnostic available for this age"
  └─ loadOfferableAssessment → 404 "No public diagnostic configured for this pathway"
  └─ computeAutoScore(assessment, answers)      ┐  the SAME grading.utils used by the
  └─ computeMaxScore(assessment)                ┤  authenticated learner flow — imported
  └─ computeIndicatorBreakdown(assessment, …)   ┘  directly, no fork
  └─ buildIndicatorNameMap()  → resolve indicatorBreakdown rows to names
  └─ itemsSnapshot = assessment.items.map(sanitizeItem + indicatorNames)   ← stored for the link
  └─ LeadModel.create({ source: "diagnostic", name: parentName, email: null,
                        phone: parentPhone, learnerName: childName, learnerAge: childAge,
                        interestedIn: "general", referenceId: pathwaySlug,
                        message: "<score summary>" })   → leadId   (try/catch — report wins)
  └─ LeadService._notifyAdmins(lead)
  └─ PublicDiagnosticAttemptModel.create({ …, answers, itemsSnapshot, itemResults,
                                           leadId, ipHash })
  └─ return { attemptId, pathwayName, assessmentName, totalScore, maxScore,
              itemResults[], indicatorBreakdown[] }   ← no leadId, no name/phone
```

**Response `201`** wrapped `{ ok, success, message: "Here's how it went!", data }`.
`data` carries the whole report — no second fetch. `overallFeedback` / `gradedByName`
are **never** present (auto-graded only, no human ever touches this path).

- **A `source: "diagnostic"` lead IS created** (since 10 Sep 2026) from the required
  name + phone, and every admin is notified — the completion shows in the Enquiries
  page. The lead has no email (follow-up is by phone). If the lead write fails the
  report is still returned. `data` never carries the `leadId` or the name/phone.
- **Grading is synchronous** — same request, no polling, no manual-review queue.
- **The report is NEVER emailed.** The visitor sees it on-screen the instant they
  submit and gets a permanent shareable link (§6.6).
- **Every attempt is stored** (`public_diagnostic_attempts`, `leadId` = the created
  lead's id, or null if the lead write failed / a pre-10-Sep attempt) for the
  shareable report link and completion analytics.
- **`itemsSnapshot` + `itemResults` are stored on the attempt row** at submit time so
  the standalone report page (§6.6) renders the per-question section identically even
  after an admin later edits the assessment. `itemsSnapshot` is the **sanitized** item
  set (no `correctAnswer`, `sequence` shuffled, `blanks`/`pairs.right` blanked) — the
  shareable link can never leak the answer key. `itemResults` is stored, **not**
  re-derived from the snapshot (`sanitizeItem` shuffled it, so re-grading would be wrong
  for ordering/matching/fillBlank).
- **Retakes are unlimited** — no uniqueness constraint; each attempt = its own row + report.
- **Rate limit: 20 / 15 min / IP** (`submitLimiter`).

### 6.5 ~~`PATCH /api/public/leads/:id`~~ — REMOVED

The post-report "details" step (phone + child's name filled into a lead) is gone.
Name + phone are now collected **at submit** instead (§6.4), so there's nothing to
patch afterwards. Route, controller
(`updateLeadContactDetails`), service (`LeadService.updateContactDetails`), and Zod
schema (`updateLeadContactDetailsSchema`) all removed. `PATCH /api/public/leads/:id`
now 404s.

### 6.6 `GET /api/public/diagnostics/attempts/:attemptId` — the permanent shareable report

The report link the visitor is handed on the results screen. **No email, ever** —
this is how they keep / share / re-open / print the report.

```jsonc
{
  "attemptId": "uuid",
  "pathwayName": "Computing and Software Creation",
  "assessmentName": "Robotics Starting-Point Diagnostic",
  "childName": "Amara",          // string | null — was optional at submit
  "childAge": 10,                // int | null
  "completedAt": "ISO-8601",
  "totalScore": 3, "maxScore": 9,
  "items": [ /* the stored SANITIZED question set — question text + kind, no answer key */ ],
  "answers": [ { "itemId", "response" } ],       // the visitor's own responses
  "itemResults": [ { "itemId", "correct", "marksAwarded", "maxMarks" } ],
  "indicatorBreakdown": [ { "indicatorId", "name", "marksEarned", "marksPossible" } ]
}
```

- `:attemptId` is the opaque uuid from the submit response — **unguessable, so the id
  in the URL is the only access control** (same posture as the QR-code learner-profile
  route). Unknown id → `404 { "message": "Report not found" }`.
- **The link never expires** — the attempt row is write-once and kept indefinitely.
- **Deliberately narrow** — pathway/assessment name, child first name + age, score,
  breakdown, per-question. **No parent contact exists** for a diagnostic attempt any
  more; `ipHash` is never exposed.
- A **pre-snapshot attempt** (rows created before migration `20260909104300`) has no
  `itemsSnapshot`/`itemResults` → `items` and `itemResults` come back `[]` → the page
  shows score + competency breakdown only. Still a valid report.
- **Rate limit: 60 / 15 min / IP** (`readLimiter`) — same as the other GETs.
- Route ordering: `/diagnostics/attempts/:attemptId` is registered **before**
  `/diagnostics/:pathwayIdOrSlug` so the literal `attempts` segment isn't captured as a
  pathway slug.

### 6.7 Website step machine (`DiagnosticPage.jsx`)

```
AGE ──► QUESTIONS ──────────────► REPORT
 │          │                        │
 │   optional "learner's       DiagnosticReport (score, per-Q, breakdown, child name + age)
 │   first name" field         + ReportLinkCard (permanent URL + copy button)
 │   + the questions           + "Open & download the report"  → standalone page
 │                             + "Enroll in this pathway"      → /enroll?referenceId=<slug>
 │   "Submit & see my report" → POST …/submit  { answers, childName?, childAge }
 │                              returns attemptId — NO name/email asked, anywhere
 └─ GET …/diagnostics/:slug?age=   (age bounded to diagnostic.minAge–maxAge)
```

**Three steps, no contact gate.** The visitor enters an age (only to fetch the right
question set), answers the questions, clicks **"Submit & see my report"**, and the
graded report renders immediately on the same page. There is no `ContactStep` and no
`DetailsStep` any more.

### 6.8 Standalone report page (`DiagnosticReportPage.jsx` → `/pathways/:slug/diagnostic/report/:attemptId`)

- `useDiagnosticReport(attemptId)` → `GET /api/public/diagnostics/attempts/:attemptId`
  (§6.6). 404 renders "this report link is not valid".
- Renders the same `<DiagnosticReport>` component, styled to match the public
  shared-learner-profile card (dark gradient hero, white body, snapshot stat tiles,
  slim competency bars).
- **"Download PDF"** = `window.print()`. No PDF library — a `@media print` block in
  `styles/global.css` hides the site chrome (`header`, `footer`, `nav`, `.no-print`,
  the action bar) so only the `.printable-report` card prints. The report uses plain
  inline styles, so it renders the same in a print context with no theme provider.
- Reachable by anyone with the link (unguessable uuid). `noindex`.

> There is no age-only "starting point finder" widget on the detail page — the
> `StartingPointFinder` component and `utils/placement.js` were removed. The single
> entry point to placement is now the diagnostic itself (its own AGE step), reached
> from the "Take the diagnostic" button.

---

## 7. Authoring — the portal side

**Curriculum → Competency Framework → Pathways panel** (`CompetenciesPage.jsx`).

Two ways to set the diagnostic:

1. **Create form** — has the assessment `<select>` + the *"Offer this diagnostic to
   anonymous visitors on the public website"* checkbox (disabled until an assessment
   is picked) + the min/max age inputs.
2. **Per-card "Diagnostic Assessment" section** (`diagPicker*` state) — quick
   assign/change on an existing pathway without opening full edit. Same checkbox.
   A green **"PUBLIC"** pill shows on the card when `publicDiagnosticEnabled`.

Client guards: `publicDiagnosticEnabled` is only ever sent `true` alongside a
non-empty `diagnosticAssessmentId` (checkbox `disabled` without one; also guarded in
`submit()` / `saveDiagPicker()`).

### 7.1 Save-time guard — `assertPublicDiagnosticAllowed`

`competency.service.js`, called from both `createPathway` and `updatePathway`:

```js
if (!data.publicDiagnosticEnabled) return;                       // nothing to check
effectiveAssessmentId = "diagnosticAssessmentId" in data
  ? data.diagnosticAssessmentId
  : existingPathway?.diagnosticAssessmentId;                     // resolve the EFFECTIVE value
if (!effectiveAssessmentId) → 400 "Set a diagnostic assessment before offering it publicly"
assessment = BuilderAssessmentModel.findById(effectiveAssessmentId)
if (!assessment) → 404 "Diagnostic assessment not found"
if (requiresManualGrading(assessment)) → 400 "This assessment includes manually-graded items…"
```

**Why service-layer, not Zod:** an update payload can legitimately omit
`diagnosticAssessmentId` while still flipping `publicDiagnosticEnabled` on (a
toggle-only UI). Only the service has both the existing row and the incoming patch to
resolve the *effective* assessment id. The Zod schema (`competency.validation.js`
`pathwayFields`) validates types/ranges only; its comment says exactly this.

> The save-time guard is **not** the last line of defence — `loadOfferableAssessment`
> / `diagnosticInfoFor` **re-check `requiresManualGrading` live on every public
> request**, because an admin can edit the assessment (add a rubric item) *after*
> enabling the flag.

### 7.2 The seed script

`node src/scripts/seedDiagnosticAssessment.js` (from `server/`) creates
*"Robotics Starting-Point Diagnostic"* — one item of every auto-gradable kind — owned
by `PUBLIC_CONTENT_ADMIN_ID`. It refuses to run if that id is unset or doesn't match
a real admin row. After seeding, assign it to a pathway in the portal, tick the
public checkbox, set an age range.

### 7.3 Content checklist (see `PUBLIC_DIAGNOSTIC_SETUP.md` for the full version)

To make a **pathway appear** on the site: give it ≥1 active course.
To make its **diagnostic appear**:

1. Author a **dedicated**, fully **auto-gradable** assessment (5–10 items). Tag each
   item with **competency indicators** (`indicatorMarks`) for the Competency Breakdown.
2. On the pathway: set `diagnosticAssessmentId`, set **both** `minAge` and `maxAge`,
   tick **"Public diagnostic enabled"**.

---

## 8. Environment & deploy

### 8.1 Backend env vars (`server/.env` — gitignored, set on the host)

| Var | Required? | Value | Effect if unset |
|---|---|---|---|
| `PUBLIC_CONTENT_ADMIN_ID` | for the public site to work | one admin's `users.id` | **all 5 public endpoints → `503`** |
| `PUBLIC_SITE_URL` | for browser calls | **comma-separated** origins | CORS blocks the browser (server-to-server curl still works) |
| `API_PUBLIC_URL` | recommended | `https://nodeapp.digifunzi.com` | `coverImage` returned as the raw stored path (website's `resolveMediaUrl` then prefixes `VITE_API_URL`) |

**Production `PUBLIC_SITE_URL`** (confirmed with the landing team):

```
PUBLIC_SITE_URL=https://africa.digifunzi.com,http://localhost:4199,http://localhost:5175
```

- `https://africa.digifunzi.com` — the deployed site (this subdomain only — no `www`, no apex)
- `http://localhost:4199` — the landing site's `scripts/prerender.js` build origin
- `http://localhost:5175` — the landing team's local dev server

CORS (`app.js`): `origin` is a function; a request with **no `Origin` header** is
always allowed; a disallowed origin gets **no CORS header** (clean browser block, not
a 500). Methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`.

### 8.2 Website env vars (`digifunzi-landing/.env`)

| Var | Value |
|---|---|
| `VITE_API_URL` | `https://nodeapp.digifunzi.com` (prod) / `http://localhost:5000` (dev) |
| `VITE_USE_MOCK` | `false` (both envs) — `true` serves `src/mocks/` fixtures, no network |
| `VITE_SITE_URL` | `https://africa.digifunzi.com` — the site's own origin (canonical, sitemap) |

### 8.3 Migrations

```bash
cd server
npm run db:migrate   # applies 20260907131100, 20260907131200, 20260909104300, 20260909110000
npm run db:migrate:status
```

All four are additive — new columns on `pathways` / `public_diagnostic_attempts` (all
nullable or defaulted), one new table, and `leadId` widened to nullable. **No data
backfill.** Pre-`20260909104300` attempt rows keep working — their shareable report
just omits the per-question section. `20260909104300`'s `up`/`down` are idempotent
(`hasColumn` guards). `20260909110000`'s `down` first deletes any null-`leadId` rows
so `.notNullable()` can be re-applied. `npm run db:migrate:rollback` reverses cleanly.

### 8.4 Deploy sequence

1. Backend: run migrations, set `PUBLIC_CONTENT_ADMIN_ID` + `PUBLIC_SITE_URL` +
   `API_PUBLIC_URL`, restart.
2. Backend: (optional) run `seedDiagnosticAssessment.js`.
3. Portal: author pathway content per §7.3.
4. Verify with the API checks in §9.
5. Website: `VITE_USE_MOCK=false`, confirm `VITE_API_URL`, `npm run build` (watch the
   prerender log fetch the data routes), deploy. The new
   `/pathways/:slug/diagnostic/report/:attemptId` route is a client route only — no
   prerender entry needed (it's per-attempt and `noindex`).
6. From the live site: take one diagnostic (confirm the report renders straight after
   submit, the report link opens the standalone page, "Download PDF" produces a clean
   PDF), and submit one real Enroll (confirm it lands in **Enquiries** — the diagnostic
   itself must NOT create an Enquiries entry).

---

## 9. Verification

### On the live site

1. `/pathways` — the pathway appears once it has active courses.
2. `/pathways/<slug>` — courses render in sequence order; a **"Take the diagnostic"**
   button appears (next to "Enroll in this pathway", header + bottom CTA) only when
   `diagnostic.available` is true.
3. `/pathways/<slug>/diagnostic` — age step bounded to the range; in-range age loads
   questions; out-of-range rejected. **No name/email is asked at any point.**
4. Click **"Submit & see my report"** — the graded report renders **immediately** on
   the same page: score, per-question feedback, and (if items are tagged with
   indicators) the Competency Breakdown.
5. The **report link** (`ReportLinkCard`) copies to clipboard; **"Open & download the
   report"** loads the standalone page; **"Download PDF"** there opens the browser
   print dialog with only the report card visible.
6. **Nothing lands in Enquiries** from the diagnostic. Clicking **"Enroll in this
   pathway"** goes to the pre-filled `/enroll` form — submitting *that* is what creates
   an Enquiries entry.

### Quick API check (no browser)

```bash
BASE=https://nodeapp.digifunzi.com
SLUG=computing-and-software-creation        # slugify(pathway name)

curl -s "$BASE/api/public/pathways" | jq '.[].slug'                    # listed?
curl -s "$BASE/api/public/pathways/$SLUG" | jq '.diagnostic'
#   → { "available": true, "minAge": 8, "maxAge": 14 }

curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/public/diagnostics/$SLUG?age=10"   # → 200
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/public/diagnostics/$SLUG?age=99"   # → 404

# submit — NO contact info, just answers + childAge (+ optional childName)
ATTEMPT=$(curl -s -X POST "$BASE/api/public/diagnostics/$SLUG/submit" \
  -H 'Content-Type: application/json' \
  -d '{"answers":[],"childName":"Amara","childAge":10}' \
  | jq -r '.data.attemptId')

# the permanent shareable report
curl -s "$BASE/api/public/diagnostics/attempts/$ATTEMPT" | jq '{pathwayName,childName,childAge,totalScore,maxScore,items:(.items|length),itemResults}'
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/public/diagnostics/attempts/does-not-exist"   # → 404
```

---

## 10. Troubleshooting

| Symptom | Cause |
|---|---|
| Every public endpoint returns `503` | `PUBLIC_CONTENT_ADMIN_ID` not set on the backend |
| A pathway you expect isn't in `/api/public/pathways` | No active courses; OR it's under a different admin than `PUBLIC_CONTENT_ADMIN_ID`; OR two of the admin's pathways share a computed slug and the other won `pickForSlug` |
| Pathway shows but courses missing / out of order | Courses aren't `status: "active"`; OR `courseSequence` not set (falls back to `courses[]` insert order) |
| No "Diagnostic" panel on the detail page | `diagnostic.available` is `false` — next row |
| `diagnostic.available` is `false` | `publicDiagnosticEnabled` off; OR **min or max age not set**; OR the assessment has a manual-grade item (rubric / project / observation indicator / non-auto-gradable item) |
| Report has no "Competency Breakdown" | Assessment items aren't tagged with indicators (`indicatorMarks`) |
| `coverImage` broken on the website | `API_PUBLIC_URL` unset **and** the website's `VITE_API_URL` fallback isn't resolving — set `API_PUBLIC_URL` |
| Browser CORS error, curl works | The site's origin isn't in `PUBLIC_SITE_URL` (comma-separated, exact origin, no trailing slash) |
| Can save `publicDiagnosticEnabled` but it never appears publicly | Save-time guard passed, then the assessment was edited to add a manual item — the live re-check now blocks it. Fix the assessment or pick another. |
| Diagnostic completions not showing in Enquiries | Since 10 Sep 2026 each completion **does** create a `source: "diagnostic"` lead (name + phone). If one's missing, the lead write may have failed (the report is still returned) — check `public_diagnostic_attempts` for a row with `leadId: null`. Pre-10-Sep attempts have no lead by design. |
| Enquiries card shows a bare slug instead of the pathway name | The lead's `referenceId` slug doesn't match any of the `PUBLIC_CONTENT_ADMIN_ID` admin's operational pathways (deleted / renamed pathway), OR `PUBLIC_CONTENT_ADMIN_ID` is unset. `_resolveReference` resolves against operational `pathways` first, then `pathway_templates` — an unmatched slug just shows no label. |
| `POST .../submit` returns `400` | Missing or out-of-range `childAge` — it's the only required field. `parentName`/`parentEmail` are no longer accepted (silently ignored if sent). |
| `PATCH /api/public/leads/:id` returns `404` | **Removed.** The post-report details step is gone (no lead to patch). |
| Shareable report link 404s | Unknown/garbage `attemptId`, OR the attempt row was manually deleted. The uuid is exact — a truncated/edited link won't resolve. |
| Shareable report shows score but no per-question section | The attempt predates migration `20260909104300` (no `itemsSnapshot`/`itemResults` stored). Only affects rows created before that deploy — new attempts always have it. |
| "Download PDF" prints the whole site, not just the report | The `@media print` block in `styles/global.css` didn't load, or a wrapper is missing the `no-print` / `printable-report` class. |

---

## 11. Security posture — summary

| Concern | Mitigation |
|---|---|
| Multi-tenant leak | Every public read/grade is scoped to `PUBLIC_CONTENT_ADMIN_ID`; `503` if unset |
| Answer key exposure | `sanitizeItem` strips `correctAnswer`, blanks `blanks`, shuffles `sequence`, blanks+shuffles `matching` — on **every** response, **including the stored `itemsSnapshot`** behind the shareable link |
| Answer reconstruction by probing | Read limiter 60/15min/IP; all 404s undifferentiated |
| Manual-grade assessment slipping through | Save-time guard **and** live re-check on every public request |
| Anonymous diagnostic served to any age | Fail-safe: missing age bound = "not configured", not "any age" |
| Spam / bot abuse of the diagnostic | No lead / email / notification is triggered, so there's no amplification vector — just a graded response + a stored row. Submit limiter 20/15min/IP still caps volume. |
| PII collected by the diagnostic | **None.** No name, no email, no phone. Only an optional child *first* name + age, entered by the visitor, stored on the attempt. `ipHash` (SHA-256) for abuse visibility, never exposed. |
| Shareable report link exposure | `attemptId` is an unguessable uuid; the projection is narrow (child first name + age, score, breakdown, per-question) — no contact info exists to leak. `noindex`. |
| Report emailed / leaked via mail | The report is **never emailed** and the diagnostic sends no mail at all. The only delivery is the on-screen view + the shareable link the visitor controls. |
| Traffic direction | One-way — the browser calls `/api/public/*`; the backend **never** calls the website |
