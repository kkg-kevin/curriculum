# Deployment Guide — Digifunzi Curriculum — Capable environment

**Status: portal rebuilt (31 Oct 2026) — ready to upload; the backend is the 30 Oct (night) one, unchanged.** Release notes: `Guide/live/DEPLOYMENT.md` → "This release (31 Oct 2026)". If the 30 Oct (night) release below isn't uploaded yet, upload its backend first (database backup first, and read its note on families being invoiced), then this portal:
- **Progress Arc says what's left to unlock the next level** ("27% left to unlock Builder" while on Explorer); finished levels read Completed.
- **Learner page → Pathway tab: click a pathway to see its courses** in order, the learner's current one marked.
- **Saving a course, session or assessment clears the drafts passed over**, so it no longer stays "Unsaved draft".

Portal only (`index.html` + `assets.zip`, entry `index-D4uMqvoz.js`), from `2874c05`. No migration, no environment variable, no cron, no npm package.

Below it, "This release (30 Oct 2026, night)":

**Backend and portal rebuilt (30 Oct 2026, night) — ready to upload, together; take a database backup first.** Release notes: `Guide/live/DEPLOYMENT.md` → "This release (30 Oct 2026, night)". It includes the 30 Oct (evening) release below — if that wasn't uploaded yet, upload this one instead (and run its one-off):
- **Packages billed daily, weekly, monthly, quarterly or annually** (Billing → Packages, price per period). Home Learning and Tech Club invoices are **raised and emailed automatically** by `billing:process` (hourly) from the day each family joins; a daily package is invoiced at month end for the days attended; a change of package or price waits for the family's next period. **Before uploading, pause any active family that shouldn't be invoiced** — the first run invoices every active family for the current period it hasn't been invoiced for yet (nothing earlier). If `billing:process` isn't a cron job here yet, **Invoice what's due now** on the Home Learning / Tech Clubs pages does the same.
- **A child-friendly learner profile** in the learner portal (UI only): rounder cards, the Nunito font, the system colours, real icons.

One new migration, applied on Restart: `20261031090000_add_package_billing_periods.js` (renames `monthlyAmount` to `amount` on the package and family tables, adds `billingPeriod`, `billingAnchor`, `billedThrough`, `pendingBilling`). Check `SHOW COLUMNS FROM home_learning_households LIKE 'billedThrough';` and run Run JS script → `db:migrate` if it's missing. Backend from `915cf21` (same zip as Dev and Live, 614 files, 151 migrations), portal `index-Cq8O3PT6.js`. No new environment variable or npm package. The website parts of those notes don't apply here.

Below it, "This release (30 Oct 2026, evening)". It includes the 30 Oct release below, which was never uploaded on its own:
- **Every learner is placed from their age** — the stage at each hub from the date of birth, or an age when that isn't known (**Age (if the date of birth isn't known)** on the learner form and edit window); the pathway follows. Correcting the age moves a stage that came from it; a diagnostic's or staff's choice stays.
- **The profile says why a learner isn't placed**; staff also see the date of birth, **Joined via**, the family's note, and **Waiting for payment** for an unpaid sign-up.
- **Diagnostics count towards competencies, Progress Arc and pathway progress**, and a **Diagnostic report** card shows each marked one (score, placement, competencies → indicators). The website-diagnostic parts don't apply — Capable has no website.
- **Levels follow the hub on screen** (a learner at two hubs on one curriculum no longer shows "Not started" by mistake).
- **Warnings before Unlink and Transfer** on a learner's Learning Hubs card.
- **Pathway tab tidied:** the retired stage diagnostic, the old Progression Ladder and the Pathway Diagnostics list are gone.

Two new migrations, applied on Restart, both additive: `20261030150000_add_stated_age_and_stage_source.js` and `20261030170000_link_website_diagnostics_to_learners.js`. Check `SHOW COLUMNS FROM learner_hub_links LIKE 'stageSource';` and run Run JS script → `db:migrate` if it's missing. **One-off after the backend is up:** Run JS script → `learners:place-by-age` (lists first), then with `-- --apply`. (`diagnostics:link-website` finds nothing here — no website.) Backend from `57afd05` (same zip as Dev and Live, 611 files, 150 migrations), portal `index-BLHimtZk.js`. No new cron, environment variable or npm package.

Below it, "This release (30 Oct 2026)". It includes the 29 Oct release below, which was never uploaded on its own:
- **Learner profile:** "Developmental stage" (was "Developmental Academy") and a **Pathway** card beside it.
- **Bootcamp pathways mean every stage:** the bootcamp form shows one tick box per pathway.
- **Dates of birth** kept on enquiries and new learners.
- **One diagnostic per learner:** a learner already placed by a diagnostic gets no second one.
- The website parts (date of birth forms, the diagnostic PDF, website bootcamp placement) don't apply here — Capable has no website. The one-off `bootcamps:place-learners` finds nothing to do here; no need to run it.

One more new migration, applied on Restart: `20261030120000_add_learner_dates_of_birth.js` (additive) — four in all with the 29 Oct ones. Check `SHOW COLUMNS FROM leads LIKE 'learnerDateOfBirth';`. Backend from `bd1b4ab` (same zip as Dev and Live), portal `index-DnaIROqI.js`. **Cron, if not added yet: `npm run qa:process` hourly.**

Below it, "This release (29 Oct 2026)":
- **Quality assurance (QA)** — supervisors (or admins) visit educators, announced or by surprise, and review them against a template; schedules; the educator reads and replies; the hub sees a summary only. Supervisors get QA Visits, a page per educator and **Schedule a check-in**.
- **Supervisors move to Settings → People & sharing → Supervisors.**
- **Training of trainers (TOT)** — a curriculum marked **Who it's for → Educators (TOT)**; educators enrolled from their page's Training card learn in the teacher portal's **My learning**; supervisors (or admins) mark it in **Work to mark**; course certificates qualify them, finishing the curriculum can raise their level.
- **Bootcamps: Schedule another run**, and each bootcamp's **Learners & parents** list (contacts, copy emails, CSV).
- **Parents' details** — a **Parent** tab on the learner page and **Learners → Parents**.
- **Search** when picking a pathway stage's diagnostic assessments.

Three new migrations, applied on Restart, all additive: `20261029100000_create_qa.js`, `20261029120000_add_series_to_bootcamps.js` and `20261030090000_add_tot_trainees.js`. Check `SHOW TABLES LIKE 'qa_visits';` and `SHOW COLUMNS FROM learners LIKE 'teacherId';`, and run Run JS script → `db:migrate` if either is missing. **New cron job, needed: `npm run qa:process` hourly.** No new environment variable or npm package. The website parts of those notes (projects in the Store) don't apply here. Not yet tried on the hosting — follow "Verify" in those notes on Dev first.

Below it, "This release (28 Oct 2026, night)": Settings → System Levels as a grid of small tiles (rename by clicking a name; move and delete on hover, or on their own line on a phone), and one tab bar across the portal — Activity, Billing, Learners, and the Tech Clubs / Home Learning status filters now look like Hub Check-ins. The backend is unchanged since the late release (same code). No migration, no environment variable, no new npm package; backend and portal uploaded together (portal `index-BzYL2wfb.js`). The website parts of those notes (the header Sign in) don't apply here.

Below it, "This release (28 Oct 2026, late)": in Multiple Choice (Multiple) questions every right option can now be ticked — an option ending in a space or containing a comma used to refuse the tick (and was marked wrong for learners); typing into an option already marked correct no longer loses the text. Questions saved before keep working; tick their right options again and save to fix one that had the problem. No migration, no environment variable, no new npm package; backend and portal uploaded together (portal `index-9OukhRIJ.js`).

Below it, "This release (28 Oct 2026, evening)": one person, one login, one password — staff and supervisors can be added to a login that already signs in (an educator, a parent), with the password left blank; a password set on any role's form (or changed by the person) is the password for every role, except an admin's or curriculum admin's own; removing someone from Staff or Supervisors takes only that role away; and tidier Hub Check-ins buttons (a tab bar, a filter switch with count badges, two button sizes, Correct the report beside the heading). No migration, no environment variable, no new npm package; backend and portal uploaded together (portal `index-Bq40vWs6.js`). The Hub Check-ins screens haven't been looked at in a browser yet.

Below it, "This release (28 Oct 2026)":
- **Online hubs get Join buttons** — a hub set to Online or Hybrid with a Meeting link shows it to its educators (dashboard card, timetable, Course Content, My Class, course pages — **Start online class**), learners (dashboard, My Courses, course pages, timetable — **Join online class**) and parents (under "Next session"); green from 15 minutes before a session until it ends.
- **The hub form refuses a Google Meet link without a meeting code** (`https://meet.google.com/abc-defg-hij`) — replace any placeholder before saving the hub (the SQL to find them is in those notes).
- Unused files, imports and packages removed — nothing changes on screen.

No migration, cron job, environment variable or npm package to add; backend and portal uploaded together (portal `index-B41FvXK3.js`). Not yet tried on the hosting — follow "Verify" in those notes on Dev first.

Below it, "This release (27 Oct 2026)":
- **One page per learner for staff** — the learner's own profile with every staff action (activate, edit in place, full form, remove, hubs, pathway, history, Preview as learner).
- **Learners opens on the hubs** (a learner at two hubs under both).
- **Hub check-ins** — rich-text reports, the hub reads its own, **tasks** from the resolutions with deadlines.
- **Surveys built freely** (structured and open questions, sections, nothing marked).
- **A safer learner bulk import** (dates, phones, duplicates, the template row; existing parents keep their password).
- **Part payments** — payment schedules on invoices, reminders, and pausing a late family until paid (Settings → Payments → Part payments). The website plan choice doesn't apply — Capable has no website; staff split invoices from the invoice page.
- **No duplicate notification emails** — personal notices reach only that person; "account active" once per family.
- **Enquiry housekeeping** (Settings → Enquiries) — Capable has no website, so there are no enquiries to tidy; harmless.

Three new migrations, applied on Restart, all additive: `20261027100000_create_checkin_tasks.js`, `20261028090000_create_billing_instalments.js` and `20261028100000_add_enquiry_housekeeping.js`. Check `SHOW TABLES LIKE 'billing_invoice_instalments';` and run Run JS script → `db:migrate` if it's missing. **New cron job, needed: `npm run billing:process` hourly** (reminders and pauses only happen through it). No new environment variable or npm package; backend and portal uploaded together (portal `index-BdOi2ye6.js`). Not yet tried on the hosting — follow "Verify" in those notes on Dev first.

Below it, "This release (26 Oct 2026, afternoon)":
- **Parent portal** at `/parent` — My family (every child at a glance, what needs the parent), each child's profile view-only from the sidebar, the child's login (username, new password), family timetable, payments for all the children, My account. Parents can't do the child's work.
- **Setting a learner's password never changes their username.**
- **Hub check-ins, simplified** — Account Manager and Training Lead named on the hub; a schedule per hub; due → pop-up → report (Highs, Lows, Resolutions). Old reports carried over.
- **No deleting what's in use** — the delete dialog lists what uses a record and offers deactivate / archive instead.
- **Bootcamp diagnostics from the curriculum** — each pathway stage: For learners (any type) and On the website (auto-marked only).
- **Billing: Business (B2B) / Families (B2C)** switch on Customers, Invoices and Payments; families listed as customers.
- **Learners → Logins** for parent and learner logins.

Three new migrations, applied on Restart: `20261026110000_simplify_hub_checkins.js` (drops the old check-in columns and the actions tables), `20261026120000_add_checkin_people_to_learning_hubs.js` and `20261026130000_curriculum_owns_bootcamp_diagnostics.js`. Check `SHOW COLUMNS FROM learning_hubs LIKE 'accountManagerId';` and run Run JS script → `db:migrate` if it's missing. No new environment variable or npm package; backend and portal uploaded together (portal `index-Cc75JqXF.js`). Not yet tried on the hosting — follow "Verify" in those notes on Dev first.

Below it, "This release (26 Oct 2026, morning)", never uploaded on its own:
- **Learner → View Profile** — the learner's own profile as they see it, for admins, collaborators and hubs.
- **Pathways added by hand** on the learner page, alongside the automatic (stage) one; their courses join the learner's My Courses.
- **Teacher Observation notes** take indicators and marks like the other observation items (existing notes set to 0 marks, so totals don't change).
- **Direct marks or Rubric** for a question's indicators — in Rubric each criterion marks one indicator; grading credits ticked criteria to their indicator and shares direct marks in proportion.

Below it, "This release (23 Oct 2026)":
- **Admin My profile** — the header avatar opens My profile / Sign out: photo, name, job title, phone, password, emails, the organisation's admins.
- **Profile photo editor** wherever a profile photo is set (round crop, zoom, rotate, flip, brightness, contrast, **Adjust**); supervisors can upload a photo.
- **Settings → Educator pay** — a minimum course coverage before an advance (a % of sessions or a number of sessions, whichever comes first; empty = no minimum, as before); Certificates, Payments and Educator pay in one simpler, full-width layout.
- **Learner profile** — only the pathway the learner is placed in; the Progress Arc and Current Level Summary say what's left to the next level.
- **Settings → Educator pay → Base plus** has its own session rate (the Per session rate is copied in on Restart if Base plus is already offered, so pay is unchanged); **gender** is Male or Female only on every learner form and bulk import.
- **Users** (Settings → People & sharing) paginated; **one login, several roles** (an email saved as an educator, hub or parent signs in as each).
- **Billing → Orders**, **Billing → To confirm**, Settings → Payments → **How families can pay** / **Delivery & pickup** and the Goods/project photo galleries all serve a **website** — Capable has none, so Orders and To confirm stay empty. The website changes in that release don't apply.

Six new migrations, applied on Restart, all additive: `20261022140000_add_user_extra_roles.js`, `20261023090000_create_payment_options_and_notices.js`, `20261023100000_add_advance_coverage_to_claim_settings.js`, `20261023110000_add_phone_and_job_title_to_users.js`, `20261023120000_create_store_orders.js` (widens the invoice-type and number-sequence ENUMs), `20261023130000_add_base_plus_session_rate.js`. Check `SHOW TABLES LIKE 'orders';` and `SHOW COLUMNS FROM users LIKE 'jobTitle';` and run Run JS script → `db:migrate` if either is missing. No new environment variable or npm package; backend and portal uploaded together (portal `index-B_6znmJw.js`). Not yet tried on the hosting — follow "Verify" in those notes on Dev first.

Below it, "This release (22 Oct 2026, afternoon)":
- **Can-do checks** — a new structured assessment item (*independently / with help / can't yet*), marked full / half / none.
- **Base plus** educator pay — session rate + enrolled learners × a commission rate (Settings → Educator pay).
- **Hub check-ins** (sidebar) — Customer Service check-in schedules, shared reports, issues and actions, reminders. Staff need **Hub check-ins (Account Managers & Training Leads)** in their role; add **Hub check-ins: schedules & oversight** for managers.
- The website changes in that release (bootcamp Enroll, home page buttons, header Enroll page) don't apply — Capable has no website.

Two new migrations, applied on Restart, both additive: `20261022120000_add_base_plus_educator_pay.js` (`claim_settings.commissionRate`, `teacher_claims.learnerCount`/`commissionRate`) and `20261022130000_create_hub_checkins.js` (four `checkin_*` tables). Check `SHOW TABLES LIKE 'checkin_sessions';` and run Run JS script → `db:migrate` if it's missing. Recommended new cron job: `npm run checkins:process` hourly. No new environment variable or npm package; backend and portal uploaded together.

Below it, "This release (22 Oct 2026)" — assessment folders, every indicator on Performance Bands and working pathway course arrows, with the M-Pesa code included but off:
- **Assessment folders** on the Assessments page, the same way as course folders.
- **Performance Bands list every indicator** a competency has in Settings, not only the ones assessments tag.
- **The arrows on a pathway's courses reorder them**; before, they saved nothing.
- **The M-Pesa code is included but off:** no `MPESA_*` keys are needed, and none should be set on Capable. With none set, no M-Pesa button or Paybill number appears. What does change: a Billing → M-Pesa tab and an owner-only Settings → Payments tab appear (both saying M-Pesa isn't set up); recording a full payment on a website sign-up's first invoice switches the sign-up on by itself; and a website bootcamp enrolment raises its invoice at sign-up (Capable has no website yet, so no such sign-ups arrive).

Four new migrations, applied on Restart. Three add tables or columns (M-Pesa twice, `assessment_folders`); the fourth only lines each pathway's course order up with what the tab already shows. Check `SHOW TABLES LIKE 'assessment_folders';` and `SHOW TABLES LIKE 'mpesa_accounts';`, and run Run JS script → `db:migrate` if either is missing. No new npm package; backend and portal uploaded together (portal `index-CpageW8Y.js`). Not yet clicked through in a browser or tried on the hosting — follow "Verify" in those notes on Dev first. The website parts of those notes don't apply here.

Below it, "This release (19 Oct 2026, afternoon)" — a non-school hub's form has a new **Club details for parents** section (ages, children per class, session times, a description for parents, FAQs); it feeds a website club page, so **on Capable (no website yet) nothing visible changes beyond the form**. One new, additive migration (`20261019120000_add_club_details_to_learning_hubs.js` — `learning_hubs.clubDetails`), applied on Restart — check `SHOW COLUMNS FROM learning_hubs LIKE 'clubDetails';` and run Run JS script → `db:migrate` if it's missing. No environment variable; no new npm package; backend and portal uploaded together (portal `index-Cizzw49C.js`). The website parts of those notes don't apply here. Below it, "This release (19 Oct 2026)" — course folders on the Courses page (New Folder with a name, description, image and colour; folder cards the size of a course card showing their colour on hover; Add courses, Edit folder, Delete folder keeping its courses; Add to / Move to folder on each course; search looks through every course); assessment points and indicator marks rounded to one decimal place as typed and on save, even splits adding up exactly; and the Tech Clubs page with Billing → Tech Club packages — families join a club from a website, so **on Capable (no website yet) no sign-ups arrive** and the page stays empty, but it does no harm (a new "Tech Clubs" staff permission appears, off until ticked). Three new, additive migrations (`20261019090000_create_tech_club_memberships.js` — three club tables, `clubMembershipId` on invoices and enquiries, a `tech_club` invoice type; `20261019100000_create_course_folders.js`; `20261019110000_add_description_and_image_to_course_folders.js`), applied on Restart — check `SHOW TABLES LIKE 'course_folders';` and `SHOW COLUMNS FROM course_folders LIKE 'coverImage';`, and run Run JS script → `db:migrate` if either is missing. No environment variable; no new npm package; backend and portal uploaded together (portal `index-CRMt_1rI.js`). Not yet clicked through in a browser or tried on the hosting — follow "Verify" in those notes on Dev first. The website parts of those notes don't apply here. Below it, "This release (16 Oct 2026, afternoon)" — educator pay: rates set once in Settings → Educator pay (per session, hourly, daily and the advance %; an empty rate isn't offered; the old per-educator rates and Billing's "Session rates" are gone); educators tagged Full time (can't claim) or Part time with the ways they can be paid, picking one per claim; every claim carries the generated claim invoice and a required eTIMS PDF; Request payment is one screen; a rate change only affects claims sent afterwards. The educator portal has one Payments item (Claims | Invoices) that follows the hub picker, with invoices opening beside the list; supervisors and the admin open a claim as a page with its invoices beside it; supervisors narrow down by school on My Educators and Claims; the admin has Billing → Educator Claims → Claim invoices (Pending payment / Paid); Billing → Invoices shows where each invoice came from (source tabs, a school filter, a From line linking to the bootcamp, household, hub, customer or learner). One new migration (`20261016110000_add_educator_pay_types.js`: hourly and daily rates, left empty, so only per-session claims until they're set; `teachers.payRateTypes`; the figures each claim was worked out on), applied on Restart — check `SHOW COLUMNS FROM teachers LIKE 'payRateTypes';` and run Run JS script → `db:migrate` if it's missing. **Before uploading, list who is tagged full time** (`SELECT firstName, lastName, email FROM teachers WHERE employmentType = 'full_time';`) — they can no longer claim; switch any who should to Part time. No environment variable; no new npm package; backend and portal uploaded together (portal `index-BumvquxU.js`). Not yet tried on the hosting — follow "Verify" in those notes on Dev first. The website parts of those notes don't apply here. Below it, "This release (16 Oct 2026)" — unsaved work in the assessment builder, Add Course, Edit Course and the session editor is saved as a draft in the workspace as it is typed (not in one browser, since many people use one account); drafts show as amber "UNSAVED DRAFT" cards at the front of the Assessments and Courses grids with Continue and Delete, and an "Unsaved drafts" filter; on a course page a session with a draft has an amber row; reopening something with a draft offers Restore / Discard / Not now; saving deletes the draft. Also up to 3 extra images per bootcamp, hub photos limited to 3 (check first: `SELECT name, JSON_LENGTH(photos) AS photos FROM learning_hubs WHERE JSON_LENGTH(photos) > 3;` — a hub listed can't be saved until trimmed to 3), a crop step when uploading bootcamp and hub images, and exact map pins for a website (Capable has none yet). Three new migrations (`bootcamps.images`; the `assessment_drafts` table, then `drafts`, which takes its rows and drops it), applied on Restart — check `SHOW TABLES LIKE 'drafts';` and run Run JS script → `db:migrate` if it's missing; no environment variable; no new npm package; backend and portal uploaded together (portal `index-qtbSkMdV.js`). Not yet tried in a browser or on the hosting — follow "Verify" in those notes on Dev first. The website parts of those notes don't apply here. Below it, "This release (15 Oct 2026)" — the Enquiries page shows how each family found the website ("Found us: Google search → /bootcamps/"), for enquiries sent from a website built from `curriculum-web` `ce26f35` or later; Capable has no website yet, so in practice nothing visible changes here until it does. One new, additive migration (`leads.visitSource`, JSON, nullable), applied on Restart — check with `SHOW COLUMNS FROM leads LIKE 'visitSource';` and run Run JS script → `db:migrate` if it's missing; no environment variable; no new npm package; backend and portal uploaded together (portal `index-D1P6e-en.js`). The website parts of those notes don't apply here. Below it, "This release (14 Oct 2026)" — all admins of an installation can share one pool of data (every admin sees, adds, changes and deletes the same content); Add Admin now puts the new admin in your organisation instead of giving them an empty workspace; admins who already have separate workspaces are joined only by running the merge (Setup Node.js App → Run JS script → `org:merge:report`, then `org:merge:apply`, with `ORG_BASE_EMAIL` set to the admin whose data stays as it is); inviting an email whose educator, hub or learner was deleted no longer fails with "already registered"; the sidebar opens on hover. One new, additive migration (`users.organisationId`, `curricula.mergedFromAdminId`) — **on Dev it did not apply on Restart: run Run JS script → `db:migrate` after uploading and check the column exists**; one optional environment variable (`ORG_BASE_EMAIL`, only for the merge); no new npm package; backend and portal uploaded together (portal `index-CO2HB_2k.js`). **Before any merge on Capable, count its admins** (`SELECT email FROM users WHERE role = 'admin';`): with one admin there is nothing to merge and the merge can be skipped; with several, run the report first and read it — every admin it lists will see everything. The merge was rehearsed on Dev; not yet on Capable. The website parts of those notes don't apply here. Below it, "This release (13 Oct 2026)" — pathways now run across developmental stages (a pathway dropdown, then each stage with its own courses, advancement rules and diagnostic; pathways from before this release show under "No stage yet" until moved); Duplicate on a curriculum's card menu makes an independent "<name> (Copy)" with a green Copy pill, sharing the same courses and assessments; a hub's classes are listed in the curriculum's grade order; Set Up Year no longer reports "no published academic year" when the published year's name has no four-digit year; the hub page shows its description as formatted text instead of raw tags; the curriculum code accepts any characters; and Settings → People & sharing has a new Users section listing every login in the workspace with its account type, role, last activity and status, where the owner can deactivate an account (signed out at once, can't sign in until activated again, nothing deleted). Two new, additive migrations (`curricula.copiedFromId`, `users.deactivatedAt`), applied on Restart; no environment variable; no new npm package; backend and portal must be uploaded together (portal `index-BlRbG6Sp.js`). Not yet tried in a browser or on the hosting — follow "Verify" in those notes on Dev first. The website parts of those notes don't apply here. Below it, "This release (12 Oct 2026, hardening)" — nothing changes in how the system is used: passwords are checked on background threads so a class signing in together no longer slows everyone down; the request limit is counted per signed-in account instead of per internet address; a second Submit of the same assessment (double tap, retry, second tab) is refused instead of being marked twice; uploaded `.html`/`.svg`/`.xml` files download instead of opening as a page; lesson content is cleaned of scripts before display; `https://lms-api.capable.co.ke/health` reports whether the API can reach its database; package security updates. No migration, no required environment variable (`TRUST_PROXY` is optional — leave it unset); backend and portal uploaded together (portal `index-BAlmUjG5.js`). Not yet tried on the hosting, and the submission fixes were checked by reading the code, not under real simultaneous requests — follow "Verify" in those notes on Dev first. The website parts of those notes don't apply here. Below it, "This release (12 Oct 2026)" — large uploads go up in pieces: any file over 5 MB (a course or assessment video) is sent as a series of 5 MB requests, so it no longer has to finish inside one request's time limit; a failed piece is retried, a dropped upload carries on when the same file is chosen again, and the upload fields show a progress bar with Cancel. No migration, no new environment variable, no new npm package; backend and portal must be uploaded together (portal `index-B4g_Z5zW.js`). Not yet tried in a browser or on the hosting — upload a video of 100 MB or more as the first check, following "Verify" in those notes. The website parts of those notes don't apply here. Below it, "This release (9 Oct 2026)" — the portal fits a phone screen: page headers put their buttons under the title, columns, forms and card grids stack, list rows put figures under the name, dialogs scroll, fields no longer make iPhone Safari zoom in, Settings tabs and the timetable week scroll sideways, and the top bar shows the section name. No migration, no new environment variable, no new npm package; portal only. Checked in a phone-sized browser with no records in it — check pages with real records on a phone before relying on it. The website parts of those notes don't apply here. Below it, "This release (8 Oct 2026)" — certificates of completion (a learner earns one when their final course report is published; pathway and bootcamp certificates follow from course ones; each has a number and a public verification page reached from its QR code), "My achievements" on the learner profile, Reports → Certificates issued with revoke and reinstate, Settings → Certificates for the signatory, a "Certificate earned" notification and email, and image uploads raised to 10 MB with large photos resized in the browser. One new, additive migration (two new tables); no new environment variable; no new npm package; backend and portal must be uploaded together (portal `index-j1lzLUJy.js`). Certificates for final reports already published are created the first time certificates are viewed, with no email. The certificate carries the Capable logo; numbers are prefixed `DF-` in every environment. The website parts of those notes don't apply here. Below it, "This release (7 Oct 2026)" — the shared learner profile as a full page with a section per hub, and the designed email layout. Below it, "This release (5 Oct 2026)" — educator claims (an educator requests an advance or full payment for a course with a PDF invoice; their supervisor approves or declines; the admin pays), supervisor accounts and the supervisor portal, Educator Claims as a tab in Billing, and the activity log. Three new migrations (one alters `users.role` to allow the new "supervisor" sign-in role — hence the backup); no new environment variable; backend and portal must be uploaded together (portal `index-D-3a-a11.js`). The website parts of those notes don't apply here. Claim amounts show as "KSh" and the default session rate is KSh 904.666 — change it under Billing → Educator Claims → Session rates if Capable pays differently. Below it, "This release (2 Oct 2026)" — bootcamp games (Events → Games, and a Games & play card on the bootcamp form), sharing between admins, the People & sharing tab in Settings, staff use of Settings data, and the fix for partial saves blanking other fields. Two new, additive migrations; no new environment variable; backend and portal must be uploaded together (portal `index-Cdok_5cD.js`). The website parts of those notes don't apply here. Below it, "This release (1 Oct 2026, third follow-on)" — email: password reset links, invoices and receipts emailed to the payer, selected notifications by email. One new, additive migration; backend and portal must be uploaded together. **Nothing is emailed until `BREVO_API_KEY` is set** (outbound SMTP is blocked on this server, so the `SMTP_*` variables are not used) — use the Capable column of that release's Environment table (`BREVO_API_KEY`, `MAIL_BRAND_NAME=Capable`, `MAIL_FROM=Capable <no-reply@digifunzi.com>`, and check `CLIENT_URL=https://lms.capable.co.ke`), then add the cron job. Below it, "This release (1 Oct 2026, second follow-on)" is included too — Items (Goods & Services), 30-minute idle sign-out and sign-out when the last tab closes, Home Learning packages moved to Billing → Packages, child vs parent logins, parents adding children from My Family. Two new migrations (the first restructures the `inventory`/`billing_items` tables into `items`), everyone signs in again once, and the backend and portal must be uploaded together. The website parts of those notes don't apply here. Optional new env var `SESSION_IDLE_MINUTES` (default 30); `JWT_EXPIRES_IN` recommended `12h`. Earlier releases below it are included.

| Part | Repo | URL |
|---|---|---|
| Curriculum frontend (LMS) | `client/` (this repo) | https://lms.capable.co.ke |
| Curriculum backend (API) | `server/` (this repo) | https://lms-api.capable.co.ke |

`capable.co.ke` already has its own separate website — this deploy is the
LMS (portal frontend + API) only, on the `lms.` / `lms-api.` subdomains.
**`digifunzi-landing` (the marketing site) is out of scope for this
environment** and nothing here touches it.

This file is a companion to `Guide/live/DEPLOYMENT.md` (read that one too —
it has the full backend/frontend deploy mechanics, migration/release
history, and env var reference this file doesn't repeat) and follows the
exact same "One-time setup for Live" pattern that file documents, adapted
for Capable's two subdomains.

**The one real difference from how Live was set up:** Live started with an
empty database that built its own schema from the migrations on first
Restart. Capable instead starts from **a real copy of Dev's data** — see
"Cloning Dev's data into Capable" below. Everything else (separate domain,
separate database, separate secrets, separate JS bundle because
`VITE_API_URL` is baked in at build time) is identical in kind to how Live
was set up, just a third instance instead of a second.

---

## What's actually in these zips right now

| File | Built how | Safe to upload as-is? |
|---|---|---|
| `backend-deploy.zip` | 30 Oct 2026 (night), from `915cf21` — byte-identical to `Guide/dev/` and `Guide/live/`. Adds package billing periods and automatic package invoices (`billingPeriod`, `amount` replacing `monthlyAmount`, `billingAnchor`, `billedThrough`, `pendingBilling`; migration `20261031090000`; `billing:process` raises them; `POST /api/home-learning/invoices` and `POST /api/tech-clubs/invoices`) and each pathway stage's slug and description on the public API; migrations up to 151. 30 Oct (evening), from `57afd05` — byte-identical to `Guide/dev/` and `Guide/live/`. Adds placement by age (`learners.statedAge`/`statedAgeOn`, `learner_hub_links.stageSource`; migration `20261030150000`), diagnostics on the learner's record and counting towards competencies (`assessment_issues.publicAttemptId`; migration `20261030170000`; `/api/assessment-submissions/diagnostic/reports/:learnerId`, `/api/learners/:id/website-diagnostics`), `?hubId` on a learner's competency scores and band progress, and the one-off commands `learners:place-by-age` / `diagnostics:link-website`; migrations up to 150. 30 Oct: dates of birth, one diagnostic per learner. 29 Oct: QA, TOT, bootcamp runs. 28 Oct 2026 (night), from HEAD (`a0372fa`) — server code the same as the late build (`6e7b01c`). 28 Oct (late): from `6e7b01c` — byte-identical to `Guide/dev/` and `Guide/live/`; code only, nothing environment-specific baked in. Adds Multiple Choice (Multiple) right answers saved as a list (the old comma-joined form still read) and marked by trimmed text; no new migration (up to 144). 28 Oct (evening): one login for every role (staff and supervisors added to an existing login, one password across roles, removing a role keeps the login); no new migration (up to 144). 28 Oct: the online-hub meeting link on calendar events and the Google Meet code check on hubs; no new migration (up to 144). 27 Oct: check-in tasks, part payments and enquiry housekeeping (migrations `20261027100000`, `20261028090000`, `20261028100000`). 26 Oct (afternoon): adds the parent portal (`/api/parent/*`), a parent refused doing a child's work, family-wide billing for parents, simplified hub check-ins with Account Manager / Training Lead on the hub (migrations `20261026110000` — drops the old check-in columns and actions tables — and `20261026120000`), delete checks (`?check=1` on every guarded delete; in-use deletes refused with 409 `IN_USE`), bootcamp diagnostics from the curriculum (migration `20261026130000`, drops `bootcamps.pathwayDiagnostics`) and B2B/B2C on billing (`customerKind`); migrations up to `20261026130000`. 26 Oct (morning): staff reads of a learner's issued assessments, reports and certificate progress (`/api/assessment-submissions/learner/:learnerId/issued`, `/api/reports/learner/:learnerId`, `/api/certificates/learner/:learnerId/progress`), pathways added by hand (`/api/curricula/:id/competencies/learner-pathways/:learnerId`; migration `20261026090000`), marked observation notes (migration `20261026100000`, data only) and the rubric-per-indicator marks split; migrations up to `20261026100000`. 23 Oct: Base plus's own session rate (`claim_settings.basePlusSessionRate`; migration `20261023130000`), gender male/female only, website Store descriptions as plain text (no effect on Capable), admin My profile (`users.phone`/`jobTitle`), the photo editor's supervisor uploads, advance course coverage (`claim_settings.advanceCoveragePercent`/`advanceCoverageSessions`), payment options and notices (`/api/payment-settings/options`, `/api/billing/payment-notices`, `/api/public/payments/:token/notices`), website orders (`/api/public/checkout`, `/api/public/orders`, `/api/billing/orders`) and one login, several roles (`users.extraRoles`, `POST /api/auth/switch-role`); migrations `20261022140000` to `20261023130000`. 22 Oct (afternoon): can-do checks in assessments, the Base plus pay plan (migration `20261022120000_add_base_plus_educator_pay.js`) and Hub check-ins (`/api/checkins`; migration `20261022130000_create_hub_checkins.js`; cron `npm run checkins:process`). 22 Oct (morning): assessment folders (`/api/assessments/folders`; migration `20261022100000_create_assessment_folders.js`), pathway course reorder by course (migration `20261022110000_align_pathway_course_order.js`, data only) and the M-Pesa module, off without `MPESA_*` keys (migrations `20261021090000_create_mpesa_tables.js` and `20261022090000_mpesa_accounts_links_operations.js`). 19 Oct (afternoon): club details for parents on learning hubs (migration `20261019120000_add_club_details_to_learning_hubs.js`). 19 Oct (morning): course folders (`/api/courses/folders`; migrations `20261019100000_create_course_folders.js` and `20261019110000_add_description_and_image_to_course_folders.js`), marks rounded to one decimal place on save, and Tech Club memberships (`/api/tech-clubs`, `/api/billing/club-packages`, `/api/public/clubs/*`; migration `20261019090000_create_tech_club_memberships.js`). 16 Oct (afternoon): educator pay types (Settings → Educator pay, `GET/PUT /api/claims/settings` with hourly and daily rates; migration `20261016110000_add_educator_pay_types.js`), full-time educators refused a claim, the pay type and units on each claim, the claims list for one hub (`GET /api/claims/courses?hubId=`), each supervisor educator's schools, the educator's own hub list including hubs where they teach a class, and each billing invoice's `source`. Earlier 16 Oct: workspace drafts (`/api/assessments/drafts`, `/api/courses/drafts`; migrations `20261016090000_create_assessment_drafts.js` and `20261016100000_create_drafts.js`), bootcamp extra images (`20261015100000_add_images_to_bootcamps.js`), the 3-photo limit on hubs and the map pin for a website's club pages. Carries everything from earlier releases (see the previous rows' history in git). All migrations up to `20261022130000_create_hub_checkins.js`, applied on Restart; no new package | **Yes** — after a database backup |
| `assets.zip` + `index.html` | 31 Oct 2026, from `2874c05`, `npm run build:capable` (`client/`) — bakes in `https://lms-api.capable.co.ke` and the Capable branding. Entry **`index-D4uMqvoz.js`** / CSS `index-CPf40rDF.css`. Adds what's left to unlock the next level on the Progress Arc, a pathway's courses on the learner page's Pathway tab, and drafts cleared on save. 30 Oct 2026 (night): entry `index-Cq8O3PT6.js`. Adds the billing period on packages, households and memberships, Invoice what's due now, and the child-friendly learner profile (Nunito font files in `assets.zip`). 30 Oct (evening): entry `index-BLHimtZk.js`. Adds the age field on the learner form and edit window, the stage reason and staff details on the profile, the Diagnostic report card, levels per selected hub, the Unlink / Transfer warnings and the tidied Pathway tab. 30 Oct: the Developmental stage and Pathway cards. 29 Oct: QA, TOT, bootcamp runs, parents' details. 28 Oct 2026 (night): entry `index-BzYL2wfb.js`. Adds System Levels as tiles and the shared tab bar (Activity, Billing, Learners, Tech Clubs, Home Learning). 28 Oct (late): Adds the builder fix for ticking every right option of a Multiple Choice (Multiple) question. 28 Oct (evening): the optional password on Staff → Invite and Supervisors → Add, and the tidier Hub Check-ins buttons. 28 Oct: the online-hub Join buttons (dashboards, timetable, Course Content, My Class, My Courses, course pages, parent home) and the Meet-link check on the hub form. 27 Oct: the one learner page for staff, Learners by hub, check-in tasks, free-form surveys, the safer bulk import and part payments. 26 Oct (afternoon): adds the parent portal, the simplified Hub Check-ins (hub form people, due pop-up, Highs / Lows / Resolutions), Learners → Logins, the in-use delete dialogs, a stage's two diagnostics on Curriculum → Competencies and the read-only list on the bootcamp form, the Business / Families billing switch, and the username kept on Edit Profile. 26 Oct (morning): Learner → View Profile, the Pathways card with Add a pathway…, pathway courses in the learner's My Courses, marks and indicators on observation Notes, and the Direct marks / Rubric switch. 23 Oct: Adds the Base plus session rate on Settings → Educator pay, Male/Female-only gender, My profile and the avatar menu, the profile photo editor, advance coverage on Settings → Educator pay, the new Settings layout, paginated Users, the placed-pathway-only learner profile, the role chooser and switcher, and Billing → Orders / To confirm (empty without a website). 22 Oct (afternoon): Adds the Can-do check item, Base plus on Settings → Educator pay and the educator form, and Hub Check-ins (sidebar, dashboard reminder, bell). 22 Oct (morning): assessment folders, every indicator on Performance Bands, working pathway course arrows, and the M-Pesa screens (Billing → M-Pesa, Settings → Payments), which say M-Pesa isn't set up. 19 Oct (afternoon): the Club details for parents section on the hub form. 19 Oct (morning): course folders, marks to one decimal place in the assessment builder, and the Tech Clubs page with Billing → Tech Club packages. 16 Oct (afternoon): Settings → Educator pay, Full time / Part time and pay types on the educator form, the one-screen Request payment with the claim invoice preview, Payments (Claims | Invoices) in the educator portal following the hub picker, claims as pages for supervisors and the admin with invoices beside them, the supervisor School pickers, Claim invoices, and Billing's source tabs, school filter and From lines. Earlier 16 Oct: draft saving for assessments, courses and sessions, the draft cards, bootcamp extra images, the 3-photo limit on hubs and cropping on upload | **Yes** — upload to the `lms.capable.co.ke` document root, together with the backend |

No website zip here — the marketing site isn't part of this deploy (see above).
(`digifunzi-landing` does have `build:capable` scripts, but its `.env.capable` still points at a
placeholder API, so don't build it for Capable until that's given a real URL.)

**Before the Restart that applies this release's migrations**, set `PUBLIC_CONTENT_ADMIN_ID` if
Capable should seed the three default Home Learning packages for that admin (the seed reads it
at migration time; otherwise create packages by hand in Home Learning → Packages).

Rebuilding the frontend zip later:

```bash
cd client && npm run build:capable && cd ..
# zip must contain the assets/ folder itself (not just its contents), so
# extracting it in cPanel File Manager produces assets/ directly in the
# document root, alongside index.html:
cd client/dist && zip -r ../../Guide/capable/assets.zip assets && cd ../..
cp client/dist/index.html Guide/capable/index.html
```

---|---|---|
| `backend-deploy.zip` | Copied straight from `Guide/dev/backend-deploy.zip` — code is identical across every environment, nothing environment-specific baked in | **Yes** — this one's genuinely correct regardless of domain, same as Dev/Live |
| `assets.zip` + `index.html` | Built with the old `npm run build:capable` (`client/`), before `client/.env.capable` had a real domain — bakes in the placeholder `https://capable-api.TODO-DOMAIN.com` | **No** — every API call from this bundle would hit a domain that doesn't resolve. Rebuild now that `client/.env.capable` points at `https://lms-api.capable.co.ke` (see below), then re-copy into this folder |
| `africa-digifunzi-com-dist.zip` | Leftover from earlier scaffolding, built against the placeholder domain | **Not needed** — the marketing website isn't part of this deploy (see above). Safe to delete from this folder once the frontend/backend zips are rebuilt. |

Rebuilding the frontend zip now that the real domain is in
`client/.env.capable`:

```bash
cd client && npm run build:capable && cd ..
# zip must contain the assets/ folder itself (not just its contents), so
# extracting it in cPanel File Manager produces assets/ directly in the
# document root, alongside index.html:
cd client/dist && zip -r ../../Guide/capable/assets.zip assets && cd ../..
cp client/dist/index.html Guide/capable/index.html
```

---

## One-time setup for Capable (cPanel side — manual, not scriptable from here)

Follow `Guide/live/DEPLOYMENT.md`'s "One-time setup for Live" section
step-for-step, substituting Capable's own values throughout. Concretely:

1. **Create the two new subdomains** (cPanel → **Domains** → **Create A New
   Domain**, under the `capable.co.ke` domain): `lms.capable.co.ke`
   (frontend) and `lms-api.capable.co.ke` (backend).
2. **Create a new MySQL database + user** — fully separate from both Dev's
   and Live's. Same one-time steps as `Guide/live/DEPLOYMENT.md`'s "Backend
   Deployment" → "One-time: create the MySQL database" section. Note the new
   `DB_NAME`/`DB_USER`/`DB_PASSWORD` — you'll need them for both the env
   setup below and the data clone.
3. **Create a new cPanel Node.js App**, application root e.g.
   `lms-api.capable` (parallel to `curriculum.digifunzi` / `dcf-api.digifunzi`),
   Application URL `lms-api.capable.co.ke`, startup file `src/server.js` —
   same settings as `Guide/live/DEPLOYMENT.md`'s "cPanel Node.js App
   Settings" table.
4. **Set Capable's own environment variables** in that new app's panel:
   - `CLIENT_URL=https://lms.capable.co.ke`
   - `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` — the **new**
     database from step 2, never Dev's or Live's
   - `JWT_SECRET` — generate a **new, different** long random string; never
     reuse Dev's or Live's (a compromised secret on one environment must
     never compromise sessions on another)
   - `ADMIN_EMAIL`/`ADMIN_PASSWORD` — used only if the database is empty on
     first Restart (the app auto-creates the first admin then). Since
     Capable's database is being **cloned from Dev**, not started empty
     (see below), Dev's existing admin accounts come along with the clone —
     these two vars only matter as a fallback if the clone hasn't happened
     yet when the app first restarts.
   - `PUBLIC_SITE_URL`/`API_PUBLIC_URL`/`SMTP_*`/`MAIL_*` — same meaning as
     Dev/Live, set independently for Capable (e.g.
     `API_PUBLIC_URL=https://lms-api.capable.co.ke`)
   - `PUBLIC_CONTENT_ADMIN_ID` — **database-specific, do not copy Dev's
     value blindly.** Even though Capable's database starts as a copy of
     Dev's, confirm this admin id still resolves to the intended
     public-content admin post-clone (it should, since the clone preserves
     ids) — see `Guide/live/DEPLOYMENT.md`'s env var reference table for
     what this controls.
5. **Clone Dev's data into Capable's database** — see the dedicated section
   below. Do this **before** the first Restart of the new Node app, so the
   app's automatic startup migration runs against the cloned (not empty)
   schema.
6. **Deploy backend** to the new app — same "Steps to Deploy / Re-deploy
   Backend" as `Guide/live/DEPLOYMENT.md`, targeting the `lms-api.capable`
   app root. Any migrations newer than what Dev's dump captured apply
   automatically on this first Restart, same as any other redeploy.
7. **Deploy frontend** to the new subdomain — same "Steps to Deploy /
   Re-deploy Frontend" as `Guide/live/DEPLOYMENT.md`, but build with
   `npm run build:capable` (not `build` or `build:live`) and upload to the
   `lms.capable.co.ke` document root.
8. **Test:**
   - Visit `https://lms-api.capable.co.ke` → expect
     `{ "message": "API is running" }`.
   - Log into `https://lms.capable.co.ke` with one of Dev's existing
     admin accounts (cloned over) — confirm the cloned curricula/courses/
     learners/etc. are visible.
   - Confirm `JWT_SECRET` is genuinely different from Dev's/Live's (a
     session token minted on Dev must not validate against Capable).

---

## Cloning Dev's data into Capable

This is a real database export/import — it needs direct MySQL access to
both Dev's deployed database (cPanel/SSH on the Dev server) and Capable's
new database, which isn't something runnable from a local dev machine's
`.env` (this repo's local `server/.env` points at a **local** MySQL
instance on `127.0.0.1`, not the deployed Dev server's remote database —
confirm you're connecting to the right host before running any of this).

1. **Back up Capable's database first**, even though it should be empty at
   this point — cheap insurance, same posture as every migration in
   `Guide/live/DEPLOYMENT.md` that touches schema.
2. **On the Dev server** (via cPanel's phpMyAdmin "Export" tab, or SSH +
   `mysqldump` if available), export Dev's full database:
   ```bash
   mysqldump -u <dev_db_user> -p <dev_db_name> > dev-snapshot.sql
   ```
   Use `--single-transaction` if the Dev database is InnoDB throughout (it
   should be — Knex's MySQL migrations default to InnoDB) to get a
   consistent snapshot without locking tables while Dev is in use.
3. **Review before importing** — this is a real copy of live user data
   (real learner names, guardian emails/phones, teacher accounts, whatever
   Dev currently holds). Confirm this is actually intended (test/demo data
   only, or a deliberate full clone including real people's data) before
   moving it to a new environment — if Dev has accumulated real contact
   information from testing, decide whether Capable needs it or whether a
   sanitized subset makes more sense.
4. **Import into Capable's new database**:
   ```bash
   mysql -u <capable_db_user> -p <capable_db_name> < dev-snapshot.sql
   ```
5. **Do not copy `uploads/`** (or do, deliberately) — the database dump
   above does not include the Dev server's `uploads/` folder (course
   materials, cover images, etc.) referenced by stored paths. If Capable
   needs those files too, copy the Dev server's `uploads/` directory
   separately (e.g. via cPanel File Manager download/upload, or `rsync`/
   `scp` if SSH is available) into the same relative location on Capable's
   app root — otherwise every image/file reference in the cloned data will
   404 until the files exist on Capable's own filesystem.
6. **Restart the Capable Node app** — the automatic startup migration
   (`src/server.js`, same as every environment) reconciles the cloned
   schema against whatever migrations exist in this codebase's
   `server/src/db/migrations/` that Dev's dump doesn't yet reflect (i.e.
   anything migrated on Dev after the dump was taken, or genuinely new
   since). Check the app log to confirm it applied cleanly.
7. **Decide what "capable" means for the cloned data going forward** —
   once live, Capable's database diverges from Dev's independently (new
   signups, new content, etc. on either side are NOT synced after this
   one-time clone). If periodic re-syncing from Dev is ever wanted, that's
   a repeat of this same procedure, not an automated process — nothing in
   this codebase keeps two environments' data in sync continuously.

---

## Re-deploying after this, per environment

Once Capable is live, it joins Dev and Live as a third deploy target for
every future code change — same code, three separate deploy passes:

```bash
# Dev
cd client && npm run build && cd ..

# Live — once Dev is confirmed working
cd client && npm run build:live && cd ..

# Capable — once Dev is confirmed working (independent of Live's own rollout)
cd client && npm run build:capable && cd ..
```

`backend-deploy.zip` stays identical across all three — same code, only
each cPanel Node app's own `.env` differs. Only the frontend needs a
separately-built zip per environment.
