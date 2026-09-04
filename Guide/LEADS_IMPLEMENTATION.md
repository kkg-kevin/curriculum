# Leads (Enroll & Contact) — Implementation Status

**Scope:** the website's *Enroll* and *Contact us* forms → this system receives
them → staff contact the person back.

This is the detail companion to
[WEBSITE_INTEGRATION_CONTRACT.md](WEBSITE_INTEGRATION_CONTRACT.md) (which is the
API contract). This doc is about the **whole loop**, including the parts that
live only in this system.

- ✅ = built and working now
- 🟡 = partially built / works but has a gap
- ❌ = not built — needed for "full implementation"

---

## 1. The loop, end to end

```
   Website visitor
        │
        │ 1. fills Enroll or Contact form
        ▼
   POST /api/public/leads   or   /api/public/contact          ✅ built
        │
        ├─ 2. validate (Zod, server-side)                      ✅ built
        ├─ 3. write a row to `leads` table                     ✅ built
        ├─ 4. notify every admin (in-app bell)                 ✅ built
        └─ 5. return friendly ack string to the visitor        ✅ built
        │
        ▼
   Admin logs into the portal
        │
        ├─ 6. sees the bell badge / notification               ✅ built
        ├─ 7. opens Enquiries page, reads the enquiry           ✅ built
        │      (now shows "Enquired from: <Bootcamp/Project/    ✅ built
        │       Pathway name>" — referenceId resolved)
        ├─ 8. contacts the person  ── by phone / their own email ✅ works (manual, off-system)
        │                          └─ from inside the system    ✅ built (Reply tab on each card)
        ├─ 9. marks New → Contacted → Closed                    ✅ built
        │      (auto-flips to Contacted on first reply)         ✅ built
        └─ 10. logs what was said / next step                   ✅ built (Internal note tab)
        │
        ▼
   Visitor gets a reply
        ├─ auto-acknowledgement email on submit                🟡 built, needs SMTP credentials
        └─ personal reply from staff                            ✅ in-system (email) or manual
```

**Bottom line:** the entire loop described in the original version of this doc is
now built. Every remaining item is **configuration, not code** — outbound email
(auto-ack, staff replies, any future digest) silently no-ops until SMTP
credentials are set in `server/.env` (see §2.6).

**Bootcamps/Projects content authoring — removed (4 Sep 2026, later same day).**
The "Website Content" admin page and its backing `/api/site/*` +
`/api/public/{bootcamps,projects}` API were built earlier this release, then
removed at the user's request once it became clear "bootcamp" already has a
real meaning in this system (a deployed **Program** — curriculum + hub +
dates + auto-created classes, see `server/src/modules/programs/`) that the
standalone `public_bootcamps` table duplicated rather than reused. The
`public_bootcamps`/`public_projects` tables are dropped
(`20260904103225_drop_public_bootcamps_and_projects.js`). `GET /api/public/pathways`
is unaffected — untouched by any of this. See §2.7 for how `referenceId`
resolution changed as a result.

---

## 2. What is in place (✅)

### 2.1 Receiving — API

| Piece | Where | Notes |
|---|---|---|
| `POST /api/public/leads` | [lead.controller.js](../server/src/modules/leads/lead.controller.js) `submitLead` | Enroll form. Also the Contact form's fallback when `useLeadsEndpoint` is set. |
| `POST /api/public/contact` | [lead.controller.js](../server/src/modules/leads/lead.controller.js) `submitContact` | Contact form default. |
| Server-side validation | [lead.validation.js](../server/src/modules/leads/lead.validation.js) | Zod. Mirrors the website's own `schemas.js` so a request that skips the browser still can't skip validation. |
| Rate limiting | [public-lead.routes.js](../server/src/modules/leads/public-lead.routes.js) | 20 requests / 15 min / IP on each endpoint, on top of the global 3000/15min. |
| CORS for the website origin(s) | [app.js](../server/src/app.js) | `PUBLIC_SITE_URL`, comma-separated — see the contract doc §5. |
| No account is created | [lead.service.js](../server/src/modules/leads/lead.service.js) module comment | A lead is a lead. Nothing here touches `users` or `learners`. |

### 2.2 Storing — `leads` + `lead_messages` tables

Migrations [20260902103000_create_leads.js](../server/src/db/migrations/20260902103000_create_leads.js)
and [20260904071000_create_lead_messages.js](../server/src/db/migrations/20260904071000_create_lead_messages.js).

| Column | Type | From Enroll | From Contact |
|---|---|---|---|
| `id` | uuid | — | — |
| `source` | `"enroll"` \| `"contact"` | `"enroll"` | `"contact"` |
| `name` | string(150) | `parentName` | `name` |
| `email` | string(255) | `parentEmail` | `email` |
| `phone` | string(50) null | `parentPhone` | `phone` |
| `learnerName` | string(150) null | `learnerName` | — |
| `learnerAge` | int null | `learnerAge` | — |
| `interestedIn` | string(50) null | `interestedIn` (`bootcamp`/`project`/`quarky`/`general`) | — |
| `message` | text null | `note` ("anything else?") | `message` (required) |
| `referenceId` | string(100) null | the bootcamp/project/pathway slug or id the form was opened from | — |
| `status` | `"new"` \| `"contacted"` \| `"closed"` | `"new"` | `"new"` |
| `createdAt` / `updatedAt` | timestamps | — | — |

Indexed on `source`, `status`, `createdAt`.

`lead_messages` — one row per reply or note, `direction: "outbound"` (emailed,
shown on the public thread) or `"note"` (staff-only, never emailed):
`id`, `leadId`, `direction`, `subject` (outbound only), `body`, `sentByUserId`,
`createdAt`. Indexed on `leadId`.

### 2.3 Alerting staff — in-app notification

[lead.service.js](../server/src/modules/leads/lead.service.js) `_notifyAdmins`:

- On every submit, **every user with `role: "admin"`** gets a row in the
  `notifications` table.
- Title: *"New enrolment interest"* or *"New contact message"*.
- Body: e.g. *"Jane Doe is interested in bootcamp for Sam."* / *"Jane Doe sent a
  message via the contact form."*
- Payload routes the notification bell click to `/enquiries?lead=<id>`, which
  scrolls to and flashes that exact row (see [NotificationBell.jsx](../client/src/components/ui/NotificationBell.jsx)
  and [EnquiriesListPage.jsx](../client/src/modules/leads/pages/EnquiriesListPage.jsx)).
- Shows up in the portal's `NotificationBell` with an unread badge.
- In-app only — no email digest yet (§3.5 is still open, staff see new leads on
  next login, not immediately).

### 2.4 Reading & triaging — Enquiries page

| Piece | Where |
|---|---|
| Page | [EnquiriesListPage.jsx](../client/src/modules/leads/pages/EnquiriesListPage.jsx) |
| Route | `/enquiries` — [AppRoutes.jsx](../client/src/routes/AppRoutes.jsx) |
| Sidebar link | "Enquiries" — [Sidebar.jsx](../client/src/components/ui/Sidebar.jsx) |
| API (admin) | `GET /api/leads?status=&source=`, `PATCH /api/leads/:id/status`, `GET /api/leads/:id/timeline`, `POST /api/leads/:id/reply`, `POST /api/leads/:id/notes` — [lead.routes.js](../server/src/modules/leads/lead.routes.js), admin-only |
| Client API | [leadApi.js](../client/src/modules/leads/services/leadApi.js) |

What staff can do on this page today:

- See every enquiry, newest first, with name / email / phone / learner / message /
  "interested in" / source / submitted-at.
- See **which programme it's about** — "Enquired from: **Junior Robotics
  Bootcamp**" (or Project / Pathway), resolved server-side from `referenceId`
  against the live catalogs (§2.6).
- Filter by status tab: All / New / Contacted / Closed.
- Change a lead's status via a dropdown (New → Contacted → Closed).
- Expand a card ("Reply / Notes") to see the full thread and either **send an
  email reply** (persisted + emailed, auto-flips status to Contacted) or **add
  an internal note** (never emailed, just a shared timeline entry for whoever
  picks up the enquiry next).
- Count of total + "N new" at the top.

### 2.5 Content authoring — removed

A "Website Content" admin page (tabbed Bootcamps/Projects list + create/edit
forms, `client/src/modules/site-content/`) and its backing
`GET/POST/PUT/DELETE /api/site/{bootcamps,projects}` + public
`GET /api/public/{bootcamps,projects}` API existed briefly earlier this
release. Both are now removed — see the top of this doc for why. Nothing
public-facing needs updating on the `digifunzi-landing` side beyond removing
any reliance on those two endpoints; **`GET /api/public/pathways` is
unaffected**.

### 2.6 Outbound email

[mailer.js](../server/src/shared/utils/mailer.js) — a thin `nodemailer` wrapper,
optional by design (same posture as `PUBLIC_SITE_URL`/`API_PUBLIC_URL`): if
`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` aren't set in `server/.env`, every send
silently no-ops (logs, doesn't throw) and nothing else in the app is affected.

| Email | Trigger | Where |
|---|---|---|
| Auto-acknowledgement | Every successful `POST /api/public/leads` or `/contact` | [lead.emails.js](../server/src/modules/leads/lead.emails.js) `sendLeadAcknowledgement`, fired fire-and-forget from `lead.service.js` |
| Staff reply | `POST /api/leads/:id/reply` | [lead.emails.js](../server/src/modules/leads/lead.emails.js) `sendLeadReply`, `Reply-To: MAIL_REPLY_TO` |

**To enable:** set in `server/.env` —

```
SMTP_HOST=smtp.gmail.com      # or any SMTP provider
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM=Digifunzi <hello@digifunzi.com>
MAIL_REPLY_TO=enquiries@digifunzi.com
```

No code change needed — the moment these are set, auto-ack and reply emails
start sending. Until then, both features work exactly as before minus the
actual email (`emailSent: false` in the reply response; a reply/note is still
persisted and visible in the thread either way).

### 2.7 `referenceId` → human context

[lead.service.js](../server/src/modules/leads/lead.service.js) `_resolveReference`
resolves a `referenceId` against `pathway_templates` (by id, then by slug,
which is computed at read time) and attaches
`{ referenceType, referenceName, referenceSlug }` to every row `GET /api/leads`
returns. `null` when there's no `referenceId`, or it doesn't resolve —
including a `referenceId` that used to point at a bootcamp/project, since
those catalogs were removed (§2.5). A lead tagged `interestedIn: "bootcamp"`
or `"project"` still shows that tag either way; only the "Enquired from:
\<name\>" label depends on resolution succeeding.

---

## 3. What is still open

Nothing here blocks staff from working the full loop end-to-end — everything
below is either configuration or a nice-to-have.

### 3.1 🟡 SMTP credentials not yet set

**Why:** §2.6's mailer is built and tested (no-op path confirmed), but no real
SMTP account has been wired up in any environment yet. Auto-ack and reply
emails won't actually reach anyone until `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`
are set.

**What's needed:** a decision on provider (Google Workspace's own SMTP is the
cheapest way to start; a transactional provider — Resend/Postmark/SendGrid — is
more reliable at volume) and the credentials themselves, then set the env vars
on whichever host runs the backend. No further code change.

### 3.2 ❌ Staff email digest

**Why:** admins only see a new enquiry via the in-app bell, which means only on
their next login. If nobody logs in over a weekend, "we reply within one
working day" can already be broken by the time anyone sees it.

**What to build:** in `lead.service.js`'s `_notifyAdmins`, additionally email
each admin (or one shared `enquiries@digifunzi.com`) the enquiry details. Needs
§2.6/§3.1 (SMTP) live first. Simplest useful version: one email per enquiry to
a shared inbox — same shape as the existing in-app notification, just also
emailed.

### 3.3 🟡 Spam protection depth

**Current:** the website sends a honeypot field (client-side, skippable) + our
20/15min IP rate limit. Good enough for launch.

**Optional later:** drop submissions where the honeypot field is non-empty (the
website would need to forward it), or add a hCaptcha/Turnstile check on the
website with server-side verification here.

### 3.4 🟡 Delete / archive a lead

**Current:** no delete. `LeadModel` has no `delete` (unlike most other models
in this codebase). Leads accumulate forever.

**What to build:** either a soft `archived` status, or `DELETE /api/leads/:id`
(admin-only) for obvious spam. Low priority.

---

## 4. What the WEBSITE needs to do / confirm

Unchanged from the original handoff — nothing blocking, the forms work against
the live API today:

1. **Send `referenceId` consistently** — confirm it's the slug for every case
   (bootcamp, project, pathway). Now actually surfaced to staff (§2.7), so a
   wrong/missing value is visible on the Enquiries card as no reference label.
2. **`interestedIn: "quarky"`** — confirmed standalone product enquiry, no
   `referenceId`.
3. **Honeypot field** — forward it (e.g. `_gotcha`) if you want us to
   hard-reject on it (§3.3).
4. **Confirm the success copy** the visitor sees — now backed by a real
   auto-ack email once §3.1 is done, so the "within one working day" promise
   is safe to keep once SMTP is live.
5. **CORS origins** — send the full production origin list for
   `PUBLIC_SITE_URL` (see WEBSITE_INTEGRATION_CONTRACT.md §5).

---

## 5. Files that changed to build this

| Item | New files | Changed files |
|---|---|---|
| Mailer foundation | `server/src/shared/utils/mailer.js` | `server/src/config/env.js`, `server/package.json`, `server/.env` |
| Auto-ack + reply emails | `server/src/modules/leads/lead.emails.js` | `server/src/modules/leads/lead.service.js` |
| Reply + notes | `server/src/db/migrations/20260904071000_create_lead_messages.js`, `server/src/modules/leads/lead-message.model.js` | `lead.routes.js`, `lead.controller.js`, `lead.service.js`, `lead.validation.js`, `EnquiriesListPage.jsx`, `leadApi.js`, `useLeads.js` |
| `referenceId` resolution | — | `lead.service.js` (`_resolveReference`, wired into `listAll`), `EnquiriesListPage.jsx` |
| Content-authoring UI (built, then removed same release) | `server/src/db/migrations/20260904103225_drop_public_bootcamps_and_projects.js` (drops the tables) | `public-site.controller.js`, `public-site.service.js`, `public-site.routes.js`, `app.js`, `lead.service.js` (reference resolution narrowed to pathways only); deleted: `admin-site.routes.js`, `public-bootcamp.model.js`, `public-project.model.js`, `public-site.validation.js`, `client/src/modules/site-content/**` |
