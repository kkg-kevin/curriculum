# Assessment Framework — Logic Reference

This document describes the full scoring and competency evaluation logic implemented in the DIGIFUNZII curriculum engine.

---

## Overview

Learner performance is evaluated through a **four-layer hierarchy**:

```
Evidence Scores
      ↓  (Engine 1 — Assessment Engine)
Weighted Final Score  →  Performance Band
      ↓  (Engine 2 — Competency Engine)
Per-Competency Scores
      ↓  (Engine 3 — Progress Arc Engine)
Competency Level + Band
      ↓  (Competency Gate)
Threshold Check → Can Progress?
```

All engine functions live in `server/src/modules/curriculum/scoring-engines.js`.  
They are **pure functions**: data in → data out, no side effects, no DB access.

---

## 1. Assessment Types

Assessment types define how a collection of evidence is evaluated.

| Field | Type | Description |
|---|---|---|
| `behaviorType` | `diagnostic \| formative \| summative` | Controls outcome logic |
| `progressionWeight` | `0–1` | How much this type contributes to overall progression (future use) |
| `evidenceWeights` | Array | Which evidence types are included and at what contribution % |

### Behavior Modes

| Type | Outcome | Progression |
|---|---|---|
| **Diagnostic** | Placement only — shows which band the learner starts at | No progression effect |
| **Formative** | Soft flag — shows below-requirement warnings but does not block | Partial weight (0.3) |
| **Summative** | Strict — below requirements or unmet thresholds block progression | Full weight (1.0) |

---

## 2. Evidence Types

Evidence types are the raw assessment methods (Quizzes, Assignments, Projects, Practical Exercises, Observations).

| Field | Description |
|---|---|
| `defaultContribution` | Default % weight when added to an assessment type |
| `minRequirement` | Default minimum score a learner must achieve on this evidence |

Each evidence type is assigned to an assessment type via an `evidenceWeights` entry. The `contribution` values across all included evidence types in one assessment type **must sum to exactly 100%**.

---

## 3. Engine 1 — Assessment Engine

**File:** `scoring-engines.js → runAssessmentEngine(evidenceScores, evidenceConfig)`

Computes the weighted final score.

```
weighted_score = (learner_score × contribution) / 100
final_score    = sum of all weighted_scores
```

Also flags any evidence where the learner scored below `minRequirement`.

**Returns:** `{ finalScore, breakdown[], belowReq[] }`

---

## 4. Engine 2 — Competency Engine

**File:** `scoring-engines.js → runCompetencyEngine(assessmentBreakdown, evidenceConfig, competencies)`

Distributes evidence scores across mapped competencies and normalizes to 0–100.

Each evidence type can be mapped to one or more competencies with a `weight` per mapping. Partial mappings are normalized automatically — the mapped portion is treated as 100% of what that evidence contributes to each competency.

### Normalization Formula

```
raw[competencyId]         += evResult.weighted  × normWeight
maxPossible[competencyId] += cfg.contribution   × normWeight

competency_score = (raw / maxPossible) × 100
```

This ensures every competency score is always **0–100** regardless of how many evidence types map to it or what their contribution weights are.

**Returns:** `[{ competencyId, name, score }]`

---

## 5. Engine 3 — Progress Arc Engine

**File:** `scoring-engines.js → runProgressArcEngine(competencyScores, progressLevels, performanceBands)`

Maps each competency score to a **Progress Level** and a **Performance Band**.

Both levels and bands share identical score ranges:

| Score Range | Progress Level | Performance Band |
|---|---|---|
| 0–39 | Exposure | Explorer |
| 40–59 | Practice | Builder |
| 60–74 | Application | Creator |
| 75–89 | Mastery | Innovator |
| 90–100 | Specialization | Pioneer |

**Returns:** `[{ competencyId, name, score, level, band }]`

---

## 6. Competency Gate

**File:** `competency.service.js → calculateScore()`

After Engine 3 runs, every competency result is checked against its **`minimumThreshold`** — a per-competency minimum score (default: 60%) the learner must achieve to be considered **competent** in that area.

```
thresholdMet        = competency_score >= minimumThreshold
allCompetenciesMet  = every competency.thresholdMet === true
```

### Gate Outcome Logic

| Condition | Outcome |
|---|---|
| `behaviorType === "diagnostic"` | Placement result only, no gate applied |
| `allCompetenciesMet === false` AND `summative` | `cannot_progress` — learner cannot advance |
| Evidence below `minRequirement` AND `summative` | `cannot_progress` |
| Evidence below `minRequirement` AND `formative` | `below_requirement` warning |
| `allCompetenciesMet === true` | `passed` — learner can progress |

The gate enforces that a learner must demonstrate **all** defined competencies above threshold — not just an average score — before they are considered ready to progress.

---

## 7. Competency Thresholds

Each competency has a `minimumThreshold` field (0–100, default 60%).

| Threshold Range | Color Code | Meaning |
|---|---|---|
| 0–59% | Orange | Low bar — exploratory competency |
| 60–74% | Blue | Standard bar — Application level required |
| 75–100% | Green | High bar — Mastery level required |

Thresholds are set per-competency by curriculum designers and can be updated independently of scoring configuration.

---

## 8. Full Calculation Return Shape

`calculateScore(curriculumId, assessmentTypeId, evidenceScores)` returns:

```json
{
  "finalScore": 74.5,
  "breakdown": [
    { "evidenceTypeId": "...", "name": "Quizzes", "score": 80, "contribution": 40, "weighted": 32, "minRequirement": 50, "belowMin": false }
  ],
  "belowRequirement": [],
  "band": { "id": "...", "name": "Creator", "minScore": 60, "maxScore": 74 },
  "behaviorType": "summative",
  "outcome": { "type": "passed", "label": "All competencies met — learner can progress" },
  "competencyBreakdown": [
    {
      "competencyId": "...",
      "name": "Programming & Implementation Skills",
      "score": 80.0,
      "level": { "name": "Mastery", "minScore": 75, "maxScore": 89 },
      "band": { "name": "Innovator", "minScore": 75, "maxScore": 89 },
      "threshold": 60,
      "thresholdMet": true
    }
  ],
  "failedCompetencies": [],
  "allCompetenciesMet": true,
  "hasCompetencyMappings": true
}
```

---

## 9. API Endpoint

```
POST /api/curricula/:id/assessments/types/:atId/calculate
Body: { "evidenceScores": [{ "evidenceTypeId": "uuid", "score": 80 }] }
```

---

## 10. Data Files

| File | Purpose |
|---|---|
| `server/data/assessment-types.json` | Assessment type definitions + evidenceWeights + competencyMappings |
| `server/data/evidence-types.json` | Evidence type definitions + defaultContribution + minRequirement |
| `server/data/competencies.json` | Competency definitions + minimumThreshold |
| `server/data/performance-bands.json` | Band definitions + minScore + maxScore |
| `server/data/progress-levels.json` | Level definitions + minScore + maxScore |
