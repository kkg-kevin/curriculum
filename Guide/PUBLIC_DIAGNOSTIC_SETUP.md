# Public pathways & diagnostics — content setup checklist

**Audience:** whoever authors curriculum content in the portal.
**Goal:** get the public marketing site (africa.digifunzi.com) showing real
pathways and running the anonymous visitor flow:
*pick pathway → take diagnostic → learner-profile report → enrol / contact.*

The plumbing (APIs, website) is **done and verified**. What's left is content.

> **The public site reads ONE designated admin's Competency Framework.** That
> admin is the `users.id` in the backend's `PUBLIC_CONTENT_ADMIN_ID` env var.
> Everything below is done **logged in as that admin**, under **Curriculum →
> Competency Framework**. (It does *not* read the Settings → Pathways "template
> library" — that's a separate, unrelated feature.)

---

## What the public site shows, exactly

`GET /api/public/pathways` returns the designated admin's operational pathways
(across every curriculum they own) that have **≥ 1 active course**. A pathway
with no courses is hidden. For each shown pathway the website renders:

- name, description, colour
- the courses, in the pathway's **Course Sequence** order (then any course not
  yet sequenced), with each course's name / description / age range / cover image
- a **"Take the diagnostic"** panel — *only if* the diagnostic is fully
  configured (see below)

So: **to make a pathway appear**, give it courses. **To make its diagnostic
appear**, do steps 1–2.

---

## 1. Author the diagnostic assessment  *(Assessments)*

- One **dedicated** assessment per pathway. Do **not** reuse one assessment
  across several pathways — a Data & AI learner shouldn't get a robotics quiz.
- **Auto-gradable only.** Allowed item kinds:
  `mcqSingle`, `trueFalse`, `mcqMultiple`, `fillBlank`, `ordering`, `matching`.
  No rubric items, no deliverables, no short-answer/essay/file-upload — the
  backend refuses to serve a public diagnostic whose assessment has any of those,
  and re-checks live on every request.
- **Tag each item with competency indicators** (the item's `indicatorMarks`).
  This is what produces the **"Competency Breakdown"** — the *learner-profile*
  part of the report. Without it the report still works (score + per-question),
  but the profile section stays hidden.
- Keep it short — 5–10 items. It's a starting-point check, not an exam.

## 2. Configure the pathway  *(Curriculum → Competency Framework → the pathway)*

| Field | Value |
|---|---|
| **Courses** | at least one active course (also what makes the pathway show at all) |
| **Course Sequence** | order the courses — this is the order the website lists them |
| **Diagnostic assessment** | the assessment from step 1 |
| **Min age** | required — e.g. `8` |
| **Max age** | required — e.g. `14` |
| **Public diagnostic enabled** | ✅ on |

> **Both ages are mandatory.** A public diagnostic with a missing age bound is
> treated as *not configured* — it will **not** appear on the website until both
> are set. (This does not affect the normal authenticated in-app learner
> diagnostic, which is unchanged.)

---

## 3. Verify

On the live site (or a build pointed at this backend):

1. `/pathways` — the pathway appears in the list (once it has courses).
2. `/pathways/<slug>` — courses render in sequence order; the **"Take the
   diagnostic"** panel shows with the age range you set ("for ages 8–14").
3. `/pathways/<slug>/diagnostic` — the age step is bounded to that range; an
   in-range age loads the questions. On the questions step there's a **required
   "Your name" + "Phone number"** block (the learner's first name stays optional);
   submit is blocked until name + phone are filled and valid.
4. Submit — the report shows **immediately** on the same page: score,
   per-question feedback, and (if you tagged indicators in step 1) the competency
   breakdown. There's a permanent shareable link + "Download PDF".
5. **A "Diagnostic result" enquiry lands in Enquiries** — a `source: "diagnostic"`
   lead with the name + phone, the learner name/age, the pathway ("Enquired from"),
   and the score in the message. It has **no email**, so the Enquiries card shows
   "Reply by email" as unavailable — follow up by phone or add an internal note.
   The completed attempt is also stored in `public_diagnostic_attempts` (admin-only).

### Quick API check (no browser)

```bash
BASE=https://<backend>          # e.g. https://nodeapp.digifunzi.com
SLUG=<the-pathway-slug>         # slugify(pathway name), e.g. computing-and-software-creation

curl -s "$BASE/api/public/pathways" | jq '.[].slug'          # is it listed?
curl -s "$BASE/api/public/pathways/$SLUG" | jq '.diagnostic'
#   → { "available": true, "minAge": 8, "maxAge": 14 }

curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/public/diagnostics/$SLUG?age=10"   # → 200
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/public/diagnostics/$SLUG?age=99"   # → 404
```

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| A pathway you expect isn't in `/api/public/pathways` | It has no active courses, OR it's under a different admin than `PUBLIC_CONTENT_ADMIN_ID`, OR two of the admin's pathways share a computed slug and the other one won the tiebreak |
| Pathway shows but courses are missing / out of order | Courses aren't `active`, or Course Sequence isn't set (falls back to insert order) |
| No "Diagnostic" panel on the pathway detail page | `diagnostic.available` is `false` — see next row |
| `diagnostic.available` is `false` in the API | `publicDiagnosticEnabled` off, **min or max age not set**, or the assessment has a manual-grade item |
| Report has no "Competency Breakdown" | Assessment items aren't tagged with indicators (step 1) |
| Every public endpoint returns `503` | `PUBLIC_CONTENT_ADMIN_ID` not set on the backend |

See `Guide/WEBSITE_INTEGRATION_CONTRACT.md` §3.5 / §3.6 / §3.8 for exact API shapes.
