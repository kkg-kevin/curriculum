Learning Journey — Comprehensive Overview
Purpose
Learning Journey answers one question for every learner, in every Learning Area: "Which course should this learner be doing right now, and how did they get there?"

It's built for subjects that aren't single courses but progressions — e.g. "Robotics & Automation" isn't one course, it's Robotics 1 → 2 → 3 → 4. A learner doesn't take all four at once; they move through them as they develop. Learning Journey is the system that decides where on that ladder each learner stands, and tracks how they got there.

It's a sub-module of Competencies, and it doesn't invent new top-level concepts — it wires together four things that already existed (Learning Areas, Developmental Stages, Performance Bands, Assessment Types) and adds one new record type on top (the learner's actual placement history).

The four configuration pieces
1. Learning Area — Course Sequence
A Learning Area is a named group of related courses (e.g. "Robotics & Automation" → Robotics 1–4). Learning Journey adds a courseSequence: an explicit order for those courses. This is the ladder itself — without an order, the system has courses but no concept of "next."

2. Developmental Stage — Default Assignments
Developmental Stages already existed (age-based groupings like "Crib," "Clicker," "Quest"). Learning Journey adds a per-stage, per-Learning-Area default: "a learner in this stage starts at this course." This is a rough, age-based starting guess for a learner nobody has tested yet — not a placement, just a reasonable default.

3. Performance Band — Placement Thresholds
Performance Bands already existed as curriculum-wide score bands for the Progress Arc. Learning Journey reuses the exact same model, but scopes an instance to one Learning Area + one specific course, turning it into a placement rule: "score at or above X% → place at this course." A curriculum can have both kinds of bands — curriculum-wide (untouched, still drives the Progress Arc) and Learning-Area-scoped (drives Learning Journey) — and the two are always kept visually and functionally separate; scoped bands never leak into the ordinary Progress Arc view or its calculations.

4. Assessment Type — Learning Area Link
Assessment Types (Diagnostic / Formative / Summative) can now be tagged with a Learning Area. This tag is what turns a score into a Learning Journey action. An assessment type with no Learning Area tag behaves exactly as before — completely unaffected.

The learner-level record
Each learner gets one Journey record per Learning Area they're active in, holding:

their current course
a full history of every placement/advancement that ever moved them, with a reason (default, diagnostic, advanced, or manual) and timestamp
Nothing is written here until something actually places the learner — before that, their position is just computed live from the config above (stage default), not stored.

How a learner actually moves — the full lifecycle
Unplaced (computed default). No Journey record exists yet. The system looks at the learner's Developmental Stage, checks that stage's default assignment for this Learning Area, and shows that as their current course. If no default is set, it falls back to the first course in the sequence.

Diagnostic placement. A diagnostic-type assessment tagged with this Learning Area gets scored (with the learner attached). The score is checked against the area's placement thresholds, and the learner is placed at the highest threshold they cleared. If they didn't clear any threshold, they're placed at the lowest course rather than left unplaced — the system always assumes "start somewhere," treating the bottom rung as a prerequisite floor. This is the first real Journey record, reason = "diagnostic."

Advancement (ongoing coursework). Formative/summative assessments tagged with this Learning Area also get checked against the thresholds — but this path only ever moves the learner forward. If their score would resolve to a course below where they already are, nothing happens. A weak score on a regular assessment can never demote someone; only a fresh diagnostic can re-place them lower. Reason = "advanced."

Manual override. At any point, a teacher/admin can just pick a course directly on the learner's profile — no score involved. Reason = "manual." This always takes effect immediately, same as any other placement.

Every one of these appends to history rather than overwriting it, so you can always see the full trail: started here (default), diagnosed into here, advanced here, manually moved here.

Where it lives day to day
Curriculum → Competencies → Learning Journey tab (admin/curriculum-author side): configure the course sequence per area, the stage-default grid, and the placement thresholds. This is where the rules live.
Learner profile page: shows, per Learning Area, where that specific learner currently stands, lets you set their Developmental Stage, and lets you manually override their placement. This is where the outcome for one learner lives.
Assessments tab: where you tag a Diagnostic/Formative/Summative assessment type with a Learning Area, connecting scoring to this whole system.
What it deliberately doesn't do
It doesn't auto-detect age — Developmental Stage is set manually per learner (there's no date-of-birth field in the system).
It doesn't touch the old Progression Ladder ("rung") system — that's a separate, earlier mechanism still present but no longer the primary way to model this.
It doesn't force every assessment into this system — only assessment types explicitly tagged with a Learning Area participate; everything else scores exactly as it always did.
