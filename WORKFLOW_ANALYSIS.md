# Classes & Diagnostic Workflow - Issues & Solutions

## Problem 1: Curriculum Classes Not Reflecting to Educators/Learners

### Root Cause
Classes defined in **Curriculum → Structure** are stored in `curriculum.classes` (configuration only).
They are NOT automatically created as real class records in `classes.json`.

When educators/learners try to enroll, they only see classes in `classes.json`, not curriculum template classes.

### The Gap
- `curriculum.classes` = Template/blueprint (e.g., "Grade 1", "Grade 2" configuration)
- `classes.json` = Actual enrollable class instances (linked to a specific hub + academic year)

These are two separate systems that aren't connected.

### Solution
Need to create a workflow to instantiate curriculum classes as real classes:
1. Admin goes to a hub
2. Selects curriculum 
3. Clicks "Create Classes from Curriculum"
4. System creates one real class record per curriculum template
5. Now educators can assign courses to those classes
6. Now learners can be enrolled in those classes

---

## Problem 2: New Learners Stuck on Loading

### Root Cause
`FirstLoginDiagnosticGate` checks:
```javascript
if (!hub?.id || !cls) { setEnsured(true); return; }
```

If learner isn't enrolled in a class (`cls` is null), gate gets stuck in loading state.

### Why It Happens
- New learner created without class assignment
- First login → gate tries to load diagnostics
- But no class → can't determine which learning areas apply
- No diagnostics to show → but can't auto-mark onboarding complete
- Stuck showing "Preparing your welcome diagnostic..."

### Solution
1. When new learner is created, automatically enroll them in a default class
2. OR: Fix the gate to handle "no class" case and skip to portal
3. Ensure diagnostics are issued immediately after enrollment

---

## Problem 3: Diagnostic Assessment Not Issued

### Current Flow
1. Learner enrolled in class → `maybeAutoIssueLearningAreaDiagnostic()` fires
2. This finds Learning Areas in curriculum
3. For each area with `diagnosticAssessmentId`, creates an assessment issue
4. Gate fetches these issues and shows diagnostic UI

### Blockers
- Learning areas might not have `diagnosticAssessmentId` set
- Class might not exist (Problem 1)
- Learner might not be enrolled (Problem 2)

---

## Recommended Complete Fix

### Step 1: Add "Create Classes" workflow to Hub/School setup
- Add button: "Create Classes from Curriculum Structure"
- Instantiate curriculum.classes as real classes in that hub
- Set academic year, status, etc.

### Step 2: Auto-assign new learners to default class
- When learner created, assign to first active class in selected hub
- OR: Let admin select a default class during creation

### Step 3: Fix diagnostic gate for edge cases
- If learner has no class, offer a way out
- Auto-mark onboarding complete if no diagnostics available
- Show helpful message instead of infinite loading

### Step 4: Verify diagnostic issuance
- Ensure diagnostics issued immediately on enrollment
- Validate that learning areas have diagnosticAssessmentId set
- Add warnings if setup incomplete

---

## Data Flow (Fixed)

```
Admin Setup:
  1. Create Curriculum with Structure (defines Grade 1, Grade 2, etc.)
  2. Configure Learning Areas with diagnostic assessments
  3. Go to Hub
  4. Click "Create Classes from Curriculum" → instantiates real class records
  5. Assign educators to courses in those classes

Learner Flow:
  1. New learner account created
  2. Auto-enrolled in default class at hub
  3. First login → First Login Diagnostic Gate
  4. Gate issues diagnostics for all learning areas
  5. Learner takes diagnostics
  6. After completion → redirected to portal with placement data
  7. Learner sees dashboard with their courses

```
