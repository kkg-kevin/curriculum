import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Check as CheckIcon, CheckCircle as CheckCircleIcon, Search as SearchIcon,
  FolderOpen as FolderOpenIcon, MedicalServices as MedicalServicesIcon,
  TrackChanges as TrackChangesIcon, Assignment as AssignmentIcon, Science as ScienceIcon,
  ChildCare as ChildCareIcon, WarningAmber as WarningAmberIcon, EmojiEvents as EmojiEventsIcon,
} from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import { useCurriculumQuery } from "../hooks/useCurriculum";
import {
  useCompetencies,
  useLinkCompetency,
  useUnlinkCompetency,
  useLearningAreas,
  useCreateLearningArea,
  useUpdateLearningArea,
  useDeleteLearningArea,
  useImportLearningArea,
  useAgeCategories,
  useCreateAgeCategory,
  useUpdateAgeCategory,
  useDeleteAgeCategory,
  useAssessmentTypes,
  useCreateAssessmentType,
  useUpdateAssessmentType,
  useDeleteAssessmentType,
  useUpdateGlobalScoring,

  useEvidenceTypes,
  useCreateEvidenceType,
  useUpdateEvidenceType,
  useDeleteEvidenceType,
  usePerformanceBands,
  useCreatePerformanceBand,
  useUpdatePerformanceBand,
  useDeletePerformanceBand,
  useReorderPerformanceBands,
  useDuplicatePerformanceBandToNext,
  usePopulatedIndicators,
  useBandProgress,
} from "../hooks/useCompetencies";
import { useCompetencies as useGlobalCompetencies } from "../../settings/competencies/hooks/useCompetencies";
import { useLearningAreas as useCatalogLearningAreas, LEARNING_AREA_KEYS } from "../../settings/learning-areas/hooks/useLearningAreas";
import { learningAreasApi as catalogLearningAreasApi } from "../../settings/learning-areas/services/learningAreasApi";
import { useCoursesQuery } from "../../courses/hooks/useCourse";
import CoursePickerField from "../../courses/components/CoursePickerField";
import { useAssessmentsQuery } from "../../assessments/hooks/useAssessment";
import ConfirmDialog from "../components/ConfirmDialog";

/* ── Shared delete-confirmation helper ─────────────────────────────────────
   Every panel on this page fires its delete mutation straight from the trash
   icon with no confirmation — used in each panel below so a mis-click can't
   silently destroy configuration. */
function useConfirmDelete() {
  const [target, setTarget] = useState(null); // { title, message, onConfirm }
  const confirmDialog = (
    <ConfirmDialog
      isOpen={!!target}
      title={target?.title || ""}
      message={target?.message || ""}
      confirmLabel="Delete"
      variant="danger"
      onConfirm={() => { target?.onConfirm(); setTarget(null); }}
      onCancel={() => setTarget(null)}
    />
  );
  return { requestDelete: setTarget, confirmDialog };
}

// Shown wherever a query fails, in place of the panel's usual empty state — without this, a
// failed request (network drop, expired session, 500) renders identically to "nothing
// configured yet," and an admin has no way to tell the difference.
function ErrorNotice({ message = "Couldn't load this — try refreshing the page." }) {
  return (
    <div style={{ padding: "16px 18px", borderRadius: 10, backgroundColor: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: 13 }}>
      {message}
    </div>
  );
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const STEPS = [
  { n: 1, label: "Basic Info" },
  { n: 2, label: "Competencies" },
  { n: 3, label: "Structure" },
  { n: 4, label: "Version Control" },
];

const AREA_COLORS = [
  "#25476a", "#38aae1", "#2e7db5", "#0A3880",
  "#059669", "#7C3AED", "#DC2626", "#D97706",
  "#0891B2", "#BE185D",
];

/* ── CSS ────────────────────────────────────────────────────────────────── */

const CSS = `
  @keyframes cp-fadein { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  @keyframes cp-spin    { to { transform:rotate(360deg); } }

  .cp-steps { display:flex; align-items:center; justify-content:center; margin-bottom:32px; }
  .cp-connector { width:64px; height:2px; flex-shrink:0; margin:0 6px; margin-bottom:20px; }
  @media(max-width:640px){ .cp-connector{width:20px;} .cp-steps{justify-content:flex-start;overflow-x:auto;padding-bottom:4px;} }

  .cp-nav { display:flex; gap:6px; margin-bottom:24px; border-bottom:2px solid #F3F4F6; padding-bottom:0; }
  .cp-nav-btn {
    padding:9px 18px; background:none; border:none; border-bottom:2.5px solid transparent;
    font-size:13px; font-weight:600; font-family:Inter,sans-serif; color:#6B7280;
    cursor:pointer; margin-bottom:-2px; transition:color 0.15s, border-color 0.15s; white-space:nowrap;
  }
  .cp-nav-btn:hover  { color:#25476a; }
  .cp-nav-btn.active { color:#25476a; border-bottom-color:#25476a; }

  .cp-card {
    background:#fff; border-radius:16px; padding:22px 24px;
    box-shadow:0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04);
    animation:cp-fadein 0.18s ease;
  }

  .cp-list { display:flex; flex-direction:column; gap:8px; margin-bottom:16px; }

  .cp-item {
    display:flex; align-items:flex-start; gap:12px;
    padding:11px 14px; border-radius:10px; border:1.5px solid #E5E7EB;
    background:#FAFAFA; transition:border-color 0.15s, background 0.15s;
  }
  .cp-item:hover { border-color:#b8d9ee; background:#F8FBFF; }

  .cp-item-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; margin-top:4px; }
  .cp-item-name { flex:1; min-width:0; font-size:13px; font-weight:600; color:#111827; padding-top:1px; }
  .cp-item-sub  { font-size:11px; color:#9CA3AF; font-weight:400; margin-top:1px; }

  /* Course list (Learning Areas) */
  .cp-course-section {
    margin-top:12px; padding-top:12px; border-top:1px dashed #E5E7EB;
  }
  .cp-course-header {
    display:flex; align-items:center; justify-content:space-between; margin-bottom:9px;
  }
  .cp-course-header-left { display:flex; align-items:center; gap:6px; }
  .cp-course-title {
    font-size:12px; font-weight:700; color:#374151; font-family:Inter,sans-serif;
  }
  .cp-course-count-badge {
    padding:1px 8px; border-radius:20px; font-size:10.5px; font-weight:700; border:1px solid;
  }
  .cp-course-list { display:flex; flex-direction:column; gap:5px; }
  .cp-course-row {
    display:flex; align-items:center; gap:9px;
    padding:6px 10px; border-radius:8px; background:#fff;
    border:1px solid #EEF0F2; transition:border-color 0.12s, background 0.12s;
  }
  .cp-course-row:hover { background:#FAFCFF; }
  .cp-course-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
  .cp-course-index {
    width:19px; height:19px; border-radius:6px; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    font-size:10px; font-weight:800;
  }
  .cp-course-name { flex:1; min-width:0; font-size:12.5px; font-weight:600; color:#1F2937; word-break:break-word; }
  .cp-course-meta { font-size:10.5px; font-weight:600; color:#9CA3AF; flex-shrink:0; white-space:nowrap; }

  /* Diagnostic Assessment section (Learning Areas) — violet accent, matches LearnerViewPage */
  .cp-diag-section {
    margin-top:10px; padding:11px 12px; border-radius:10px;
    background:#FAF8FF; border:1px solid #E9DFFC;
  }
  .cp-diag-header { display:flex; align-items:center; gap:6px; margin-bottom:8px; }
  .cp-diag-title {
    font-size:11.5px; font-weight:800; color:#7C3AED;
    text-transform:uppercase; letter-spacing:0.03em;
  }
  .cp-diag-row {
    display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;
  }
  .cp-diag-name { font-size:12.5px; font-weight:700; color:#111827; }
  .cp-diag-empty { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
  .cp-diag-hint { font-size:11.5px; color:#9CA3AF; font-style:italic; }
  .cp-diag-actions { display:flex; gap:6px; flex-shrink:0; }
  .cp-diag-btn {
    padding:5px 11px; border-radius:7px; font-size:11.5px; font-weight:700;
    font-family:Inter,sans-serif; cursor:pointer; white-space:nowrap; transition:all 0.12s;
  }
  .cp-diag-btn-assign { background:#7C3AED; color:#fff; border:none; }
  .cp-diag-btn-assign:hover { background:#6D28D9; }
  .cp-diag-btn-change { background:#fff; color:#7C3AED; border:1.5px solid #D8C7F8; }
  .cp-diag-btn-change:hover { background:#F3EBFF; }
  .cp-diag-btn-clear { background:#fff; color:#9CA3AF; border:1.5px solid #E5E7EB; }
  .cp-diag-btn-clear:hover { color:#DC2626; border-color:#FCA5A5; background:#FEF2F2; }
  .cp-diag-picker { display:flex; align-items:center; gap:8px; margin-top:8px; flex-wrap:wrap; }

  .cp-course-wrap { display:flex; flex-wrap:wrap; gap:7px; }
  .cp-course-chip {
    display:inline-flex; align-items:center; gap:6px;
    padding:4px 8px 4px 12px; border-radius:20px; font-size:11.5px; font-weight:600;
    border:1.5px solid; white-space:nowrap; font-family:Inter,sans-serif;
  }
  .cp-course-chip-x {
    width:15px; height:15px; border-radius:50%; border:none;
    background:rgba(0,0,0,0.08); cursor:pointer;
    display:inline-flex; align-items:center; justify-content:center;
    font-size:10px; font-weight:900; padding:0; flex-shrink:0; color:inherit;
    transition:background 0.1s, color 0.1s;
  }
  .cp-course-chip-x:hover { background:rgba(239,68,68,0.2); color:#DC2626; }
  .cp-course-empty-hint {
    font-size:11px; color:#9CA3AF; font-style:italic; margin-top:6px;
  }
  .cp-item-badge {
    padding:2px 9px; border-radius:20px; font-size:10px; font-weight:700;
    background:#e8f5fb; color:#25476a; border:1px solid #a8d5ee; white-space:nowrap; flex-shrink:0;
  }

  .cp-icon-btn {
    width:30px; height:30px; border-radius:8px; border:none; background:transparent;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
    color:#9CA3AF; transition:background 0.12s, color 0.12s; flex-shrink:0;
  }
  .cp-icon-btn:hover         { background:#F3F4F6; color:#374151; }
  .cp-icon-btn.danger:hover  { background:#FEF2F2; color:#DC2626; }

  .cp-form {
    background:#F0F7FF; border:1.5px solid #C7D9F8; border-radius:12px;
    padding:14px 16px; margin-bottom:16px; animation:cp-fadein 0.15s ease;
  }
  .cp-form-row { display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap; }
  .cp-input {
    flex:1; min-width:140px; padding:8px 12px; border-radius:8px;
    border:1.5px solid #D1D5DB; font-size:13px; font-family:Inter,sans-serif;
    background:#fff; outline:none; transition:border-color 0.15s, box-shadow 0.15s;
  }
  .cp-input:focus { border-color:#25476a; box-shadow:0 0 0 3px rgba(37,71,106,0.08); }
  .cp-textarea {
    width:100%; padding:8px 12px; border-radius:8px; border:1.5px solid #D1D5DB;
    font-size:13px; font-family:Inter,sans-serif; background:#fff; outline:none;
    resize:vertical; min-height:64px; margin-top:8px; box-sizing:border-box;
    transition:border-color 0.15s, box-shadow 0.15s;
  }
  .cp-textarea:focus { border-color:#25476a; box-shadow:0 0 0 3px rgba(37,71,106,0.08); }

  .cp-select {
    padding:8px 12px; border-radius:8px; border:1.5px solid #D1D5DB;
    font-size:13px; font-family:Inter,sans-serif; background:#fff; outline:none;
    cursor:pointer; transition:border-color 0.15s;
  }
  .cp-select:focus { border-color:#25476a; }

  .cp-btn-primary {
    padding:8px 18px; background:#25476a; color:#fff; border:none; border-radius:9px;
    font-size:13px; font-weight:600; font-family:Inter,sans-serif; cursor:pointer;
    display:inline-flex; align-items:center; gap:7px; transition:background 0.15s; white-space:nowrap;
  }
  .cp-btn-primary:hover:not(:disabled) { background:#0A3880; }
  .cp-btn-primary:disabled { background:#b8d9ee; cursor:not-allowed; }

  .cp-btn-secondary {
    padding:8px 16px; background:#fff; color:#374151; border:1.5px solid #E5E7EB;
    border-radius:9px; font-size:13px; font-weight:600; font-family:Inter,sans-serif;
    cursor:pointer; display:inline-flex; align-items:center; gap:6px;
    transition:all 0.15s; white-space:nowrap;
  }
  .cp-btn-secondary:hover { background:#F3F4F6; }

  .cp-btn-ghost {
    padding:8px 16px; background:#e8f5fb; color:#25476a; border:1.5px solid #a8d5ee;
    border-radius:9px; font-size:13px; font-weight:600; font-family:Inter,sans-serif;
    cursor:pointer; display:inline-flex; align-items:center; gap:6px;
    transition:all 0.15s; white-space:nowrap;
  }
  .cp-btn-ghost:hover { background:#d6edf8; }

  .cp-btn-add {
    display:inline-flex; align-items:center; gap:6px; padding:8px 16px;
    background:transparent; border:1.5px dashed #D1D5DB; border-radius:9px;
    font-size:13px; font-weight:600; font-family:Inter,sans-serif; color:#6B7280;
    cursor:pointer; transition:all 0.15s;
  }
  .cp-btn-add:hover { border-color:#25476a; color:#25476a; background:#e8f5fb; }

  .cp-empty {
    text-align:center; padding:48px 24px; background:#FAFAFA;
    border:2px dashed #E5E7EB; border-radius:14px;
    animation:cp-fadein 0.2s ease;
  }

  /* Color swatches */
  .cp-swatches { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
  .cp-swatch {
    width:24px; height:24px; border-radius:50%; cursor:pointer;
    border:2px solid transparent; transition:transform 0.1s, border-color 0.1s;
    flex-shrink:0;
  }
  .cp-swatch:hover  { transform:scale(1.15); }
  .cp-swatch.active { border-color:#111827; transform:scale(1.15); }

  .cp-spinner {
    width:20px; height:20px; border:2.5px solid #E5E7EB; border-top-color:#25476a;
    border-radius:50%; animation:cp-spin 0.7s linear infinite; margin:0 auto;
  }

  /* ── Competency card grid ── */
  .cp-comp-grid {
    display:grid;
    grid-template-columns:repeat(auto-fill, minmax(248px,1fr));
    gap:14px;
    align-items:start;
  }
  @media(max-width:580px){ .cp-comp-grid{ grid-template-columns:1fr; } }

  .cp-comp-card {
    background:#fff; border:1.5px solid #E5E7EB; border-radius:14px;
    padding:18px; display:flex; flex-direction:column; min-height:130px;
    transition:border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  }
  .cp-comp-card:hover {
    border-color:#b8d9ee;
    box-shadow:0 4px 16px rgba(37,71,106,0.09);
    transform:translateY(-2px);
  }
  .cp-comp-card--editing {
    border-color:#25476a !important;
    box-shadow:0 0 0 3px rgba(37,71,106,0.1) !important;
  }
  /* Card kebab */
  .cp-card-kebab-btn {
    width:28px; height:28px; border-radius:7px; border:none; background:transparent;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
    color:#D1D5DB; transition:background 0.12s, color 0.12s; flex-shrink:0;
  }
  .cp-card-kebab-btn:hover { background:#F3F4F6; color:#374151; }

  .cp-card-menu {
    position:absolute; top:calc(100% + 4px); right:0; z-index:200;
    background:#fff; border:1px solid #E5E7EB; border-radius:10px;
    box-shadow:0 4px 16px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06);
    min-width:136px; padding:4px;
    animation:cp-fadein 0.12s ease;
  }
  .cp-card-menu-item {
    display:flex; align-items:center; gap:8px; width:100%;
    padding:8px 10px; border:none; border-radius:7px; background:transparent;
    font-size:12px; font-weight:600; font-family:Inter,sans-serif; color:#374151;
    cursor:pointer; text-align:left; transition:background 0.1s, color 0.1s;
  }
  .cp-card-menu-item:hover { background:#F3F4F6; color:#111827; }
  .cp-card-menu-item--danger { color:#DC2626; }
  .cp-card-menu-item--danger:hover { background:#FEF2F2; }

  .cp-comp-check-row {
    display:flex; align-items:center; gap:10px; padding:9px 12px;
    border:1.5px solid #E5E7EB; border-radius:10px; cursor:pointer;
    transition:border-color 0.15s, background 0.15s;
  }
  .cp-comp-check-row input[type="checkbox"] { width:16px; height:16px; flex-shrink:0; accent-color:#25476a; cursor:pointer; }

  /* ── Performance band indicator-points editor ── */
  .cp-indicators-toggle {
    display:flex; align-items:center; justify-content:space-between; width:100%;
    padding-top:10px; margin-top:10px; border-top:1px solid #F3F4F6; background:none;
    border-left:none; border-right:none; border-bottom-width:0; cursor:pointer;
    font-family:Inter,sans-serif; font-size:11px; font-weight:700; color:#374151;
  }
  .cp-indicator-count {
    font-size:10.5px; font-weight:700; padding:1px 8px; border-radius:20px;
    background:#F3F4F6; color:#6B7280;
  }
  .cp-indicators-chevron { transition:transform 0.15s; color:#9CA3AF; }
  .cp-indicators-chevron.open { transform:rotate(180deg); }
  .cp-indicators-body { margin-top:8px; }
  .cp-indicator-row {
    display:flex; align-items:center; gap:8px; padding:5px 9px;
    background:#F9FAFB; border:1px solid #F3F4F6; border-radius:7px; margin-bottom:5px;
  }
  .cp-indicator-row span { flex:1; font-size:12px; color:#374151; }
  .cp-comp-eval-input-wrap { position:relative; }
  .cp-comp-config-input {
    width:100%; padding:7px 26px 7px 10px; border-radius:8px; border:1.5px solid #E5E7EB;
    font-size:13px; font-weight:700; font-family:Inter,sans-serif; color:#111827; background:#fff; outline:none;
    box-sizing:border-box; transition:border-color 0.15s, box-shadow 0.15s;
    -moz-appearance:textfield;
  }
  .cp-comp-config-input::-webkit-outer-spin-button,
  .cp-comp-config-input::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
  .cp-comp-config-input:focus { border-color:#38aae1; box-shadow:0 0 0 3px rgba(56,170,225,0.12); }
  .cp-comp-eval-suffix {
    position:absolute; right:9px; top:50%; transform:translateY(-50%);
    font-size:11.5px; font-weight:700; color:#9CA3AF; pointer-events:none;
  }

  /* ── Read-only indicators mirror on a linked competency card (matches Settings' display) ── */
  .cp-comp-ind-toggle {
    display:flex; align-items:center; justify-content:space-between; width:100%;
    margin-top:10px; padding-top:10px; border-top:1px solid #F3F4F6; background:none;
    border-left:none; border-right:none; border-bottom-width:0; cursor:pointer;
    font-family:Inter,sans-serif; font-size:11px; font-weight:700; color:#25476a;
  }
  .cp-comp-ind-chevron { transition:transform 0.15s; color:#9CA3AF; }
  .cp-comp-ind-chevron.open { transform:rotate(180deg); }
  .cp-comp-ind-list { margin-top:8px; }
  .cp-comp-ind-item {
    padding:7px 9px; background:#F9FAFB; border:1px solid #F3F4F6; border-radius:8px;
    margin-bottom:5px;
  }
  .cp-comp-ind-item:last-child { margin-bottom:0; }

  /* ── Add / Edit form card ── */
  .cp-comp-form-card {
    background:linear-gradient(135deg,#f0f7ff 0%,#fafcff 100%);
    border:1.5px solid #C7D9F8; border-radius:14px;
    padding:20px 22px; margin-bottom:20px;
    animation:cp-fadein 0.15s ease;
  }
  .cp-field-label { font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:4px; }
  .cp-field-label .cp-required { color:#DC2626; }
  .cp-field-label .cp-optional { font-weight:400; color:#9CA3AF; }
  .cp-char-count { font-size:10px; color:#9CA3AF; text-align:right; margin-top:3px; }

  /* ── Progress Arc nav dropdown ── */
  .cp-arc-tab { position:relative; }
  .cp-arc-dropdown {
    position:absolute; top:calc(100% + 8px); left:0; z-index:400;
    background:#fff; border:1px solid #E5E7EB; border-radius:12px;
    box-shadow:0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
    min-width:200px; padding:6px;
    animation:cp-fadein 0.13s ease;
  }
  .cp-arc-dropdown-item {
    display:flex; align-items:center; gap:10px; width:100%;
    padding:11px 13px; border:none; border-radius:9px; background:transparent;
    font-size:13px; font-weight:600; font-family:Inter,sans-serif; color:#374151;
    cursor:pointer; text-align:left; transition:background 0.1s, color 0.1s;
  }
  .cp-arc-dropdown-item:hover  { background:#F0F7FF; color:#25476a; }
  .cp-arc-dropdown-item.active { background:#e8f5fb; color:#25476a; }
  .cp-arc-dropdown-divider { height:1px; background:#F3F4F6; margin:4px 0; }
  .cp-arc-subbadge {
    font-size:10px; font-weight:700; padding:2px 7px; border-radius:20px;
    background:#e8f5fb; color:#25476a; border:1px solid #a8d5ee; white-space:nowrap;
  }

  /* ── Progress Arc sub-panel header ── */
  .cp-arc-section-header {
    display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;
    padding-bottom:16px; border-bottom:1.5px solid #F3F4F6;
  }
  .cp-arc-section-nav {
    display:flex; gap:4px;
  }
  .cp-arc-section-btn {
    padding:7px 14px; background:none; border:none; border-radius:8px;
    font-size:12px; font-weight:600; font-family:Inter,sans-serif; color:#9CA3AF;
    cursor:pointer; transition:background 0.12s, color 0.12s;
  }
  .cp-arc-section-btn:hover  { background:#F3F4F6; color:#374151; }
  .cp-arc-section-btn.active { background:#25476a; color:#fff; }

  /* Assessment type badges */
  .cp-type-badge {
    display:inline-flex; align-items:center; gap:5px;
    padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700;
    text-transform:capitalize; white-space:nowrap; flex-shrink:0;
    font-family:Inter,sans-serif;
  }
  .cp-type-formative   { background:#EFF6FF; color:#1D4ED8; border:1px solid #BFDBFE; }
  .cp-type-summative   { background:#F0FDF4; color:#15803D; border:1px solid #BBF7D0; }
  .cp-type-diagnostic  { background:#FFF7ED; color:#C2410C; border:1px solid #FED7AA; }
  .cp-type-project     { background:#F5F3FF; color:#6D28D9; border:1px solid #DDD6FE; }

  /* Competency gate */
  .cp-gate-banner {
    border-radius:10px; padding:12px 16px;
    display:flex; align-items:center; gap:10px;
    animation:cp-fadein 0.15s ease;
  }
  .cp-gate-banner--pass { background:#F0FDF4; border:1.5px solid #86EFAC; }
  .cp-gate-banner--fail { background:#FEF2F2; border:1.5px solid #FCA5A5; }
  .cp-gate-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
  .cp-threshold-met    { background:#F0FDF4; border:1px solid #86EFAC; color:#15803D; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:700; }
  .cp-threshold-notmet { background:#FEF2F2; border:1px solid #FCA5A5; color:#DC2626; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:700; }
`;

/* ── Step Indicator ─────────────────────────────────────────────────────── */

function StepIndicator({ current }) {
  return (
    <div className="cp-steps">
      {STEPS.map((step, i) => {
        const done = step.n < current, active = step.n === current;
        return (
          <div key={step.n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{
                width: "34px", height: "34px", borderRadius: "50%",
                backgroundColor: done || active ? "#25476a" : "#F3F4F6",
                border: `2.5px solid ${done || active ? "#25476a" : "#E5E7EB"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: done || active ? "#fff" : "#9CA3AF",
                fontSize: done ? "15px" : "13px", fontWeight: "700", flexShrink: 0,
                boxShadow: active ? "0 0 0 4px rgba(37,71,106,0.1)" : "none",
              }}>
                {done ? <CheckIcon fontSize="small" /> : step.n}
              </div>
              <span style={{
                fontSize: "11px", fontWeight: active ? "700" : "400",
                color: active ? "#25476a" : done ? "#374151" : "#9CA3AF", whiteSpace: "nowrap",
              }}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="cp-connector" style={{ backgroundColor: done ? "#25476a" : "#E5E7EB" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── LearningAreasPanel ─────────────────────────────────────────────────── */

// Shared by LearningAreasPanel (course rows on each area card) and LearningJourneyPanel
// (Course Sequence editor) — an area's course order comes from courseSequence when set,
// falling back to courses for anything not yet sequenced there.
function sequenceFor(area) {
  const seq = [...(area.courseSequence || [])].sort((a, b) => a.order - b.order);
  const seqIds = seq.map((s) => s.courseId).filter((cid) => (area.courses || []).includes(cid));
  const extras = (area.courses || []).filter((id) => !seqIds.includes(id));
  return [...seqIds, ...extras];
}

function ImportLearningAreaDropdown({ available, onImport, isPending }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button type="button" className="cp-btn-secondary" onClick={() => setOpen((v) => !v)}>
        Import from Catalog
      </button>
      {open && (
        <div className="cp-card-menu" style={{ minWidth: "260px", maxHeight: "320px", overflowY: "auto", right: 0 }}>
          {available.length === 0 ? (
            <div style={{ padding: "14px 12px", fontSize: "12px", color: "#9CA3AF", textAlign: "center" }}>
              Nothing left to import — either the catalog is empty or every entry is already added here.
            </div>
          ) : (
            available.map((area) => (
              <button
                key={area.id}
                type="button"
                className="cp-card-menu-item"
                disabled={isPending}
                onClick={() => { onImport(area.id); setOpen(false); }}
              >
                {area.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function LearningAreasPanel({ curriculumId }) {
  const { data: areas = [], isLoading, isError } = useLearningAreas(curriculumId);
  const { mutate: create, isPending: creating } = useCreateLearningArea(curriculumId);
  const { mutate: update, isPending: updating } = useUpdateLearningArea(curriculumId);
  const { mutate: remove, isPending: deleting } = useDeleteLearningArea(curriculumId);
  const { requestDelete, confirmDialog } = useConfirmDelete();
  const { data: catalogAreas = [] } = useCatalogLearningAreas();
  const { mutate: importArea, isPending: importing } = useImportLearningArea(curriculumId);
  const { data: coursesResponse } = useCoursesQuery();
  const allCourses = coursesResponse?.data || [];
  const courseById = new Map(allCourses.map((c) => [c.id, c]));
  const { data: assessmentsData } = useAssessmentsQuery();
  // Teacher Observation assessments have no learner-facing "take" step (the teacher records
  // them directly — see assessment-submission.controller.js's getOrCreateSubmission) — picking
  // one here as a diagnostic would auto-issue it to a learner who can never start it.
  const assessments = (assessmentsData?.data || []).filter((a) => a.type !== "observation");
  const assessmentNameById = Object.fromEntries(assessments.map((a) => [a.id, a.name]));
  const queryClient = useQueryClient();
  const availableToImport = catalogAreas.filter(
    (c) => !areas.some((a) => a.name.toLowerCase() === c.name.toLowerCase())
  );

  const [showForm, setShowForm]   = useState(false);
  const [editId,   setEditId]     = useState(null);
  const [name,     setName]       = useState("");
  const [desc,     setDesc]       = useState("");
  const [color,    setColor]      = useState(AREA_COLORS[0]);
  const [courses,  setCourses]    = useState([]);
  const [minAge,   setMinAge]     = useState("");
  const [maxAge,   setMaxAge]     = useState("");
  const [diagnosticAssessmentId, setDiagnosticAssessmentId] = useState("");
  const nameRef = useRef(null);

  // Quick diagnostic assign/change — separate from the create/edit form so it can be set
  // directly from the card without opening full edit mode (see openDiagPicker/saveDiagPicker).
  const [diagPickerAreaId, setDiagPickerAreaId] = useState(null);
  const [diagPickerValue,  setDiagPickerValue]  = useState("");

  function openDiagPicker(area) {
    setDiagPickerAreaId(area.id);
    setDiagPickerValue(area.diagnosticAssessmentId || "");
  }
  function closeDiagPicker() { setDiagPickerAreaId(null); }
  function saveDiagPicker(area) {
    update({ id: area.id, data: { diagnosticAssessmentId: diagPickerValue || null } }, { onSuccess: closeDiagPicker });
  }
  function clearDiagnostic(area) {
    update({ id: area.id, data: { diagnosticAssessmentId: null } });
  }

  useEffect(() => { if (showForm) nameRef.current?.focus(); }, [showForm]);

  function openCreate() {
    setEditId(null); setName(""); setDesc(""); setColor(AREA_COLORS[0]); setCourses([]);
    setMinAge(""); setMaxAge(""); setDiagnosticAssessmentId(""); setShowForm(true);
  }
  function openEdit(area) {
    setEditId(area.id); setName(area.name); setDesc(area.description || ""); setColor(area.color || AREA_COLORS[0]);
    setCourses(area.courses || []);
    setMinAge(area.minAge ?? ""); setMaxAge(area.maxAge ?? ""); setDiagnosticAssessmentId(area.diagnosticAssessmentId || ""); setShowForm(true);
  }
  function cancel() { setShowForm(false); setEditId(null); }

  const ageRangeInvalid = minAge !== "" && maxAge !== "" && Number(maxAge) < Number(minAge);

  function submit() {
    if (!name.trim() || ageRangeInvalid) return;
    const data = {
      name: name.trim(), description: desc.trim(), color, courses,
      minAge: minAge === "" ? null : Number(minAge),
      maxAge: maxAge === "" ? null : Number(maxAge),
      diagnosticAssessmentId: diagnosticAssessmentId || null,
    };
    if (editId) {
      update({ id: editId, data }, { onSuccess: cancel });
    } else {
      // A brand-new area authored here should also become a Settings default so other
      // curricula/courses/assessments can pick it up — but only if it's genuinely new;
      // otherwise we'd mint a duplicate catalog entry alongside the existing one. Synced
      // silently (no toast) since the curriculum-copy creation above already confirmed the save.
      const existsInCatalog = catalogAreas.some((c) => c.name.toLowerCase() === data.name.toLowerCase());
      create(data, {
        onSuccess: () => {
          if (!existsInCatalog) {
            catalogLearningAreasApi.createLearningArea(data).then(() => {
              queryClient.invalidateQueries({ queryKey: LEARNING_AREA_KEYS.areas });
            }).catch(() => {});
          }
          cancel();
        },
      });
    }
  }

  if (isLoading) return <div className="cp-spinner" style={{ marginTop: "32px" }} />;
  if (isError) return <ErrorNotice message="Couldn't load Learning Areas — try refreshing the page." />;

  return (
    <div className="cp-card">
      {confirmDialog}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Learning Areas</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {areas.length} area{areas.length !== 1 ? "s" : ""} — broad domains that group the competencies this curriculum uses (e.g. Language, STEM, Arts)
          </p>
        </div>
        {!showForm && (
          <div style={{ display: "flex", gap: "8px" }}>
            <ImportLearningAreaDropdown available={availableToImport} onImport={importArea} isPending={importing} />
            <button type="button" className="cp-btn-add" onClick={openCreate}>
              + Add Area
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="cp-form">
          <div className="cp-form-row">
            <input
              ref={nameRef}
              className="cp-input"
              placeholder="Area name (e.g. Language & Literacy)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
            />
          </div>
          <textarea
            className="cp-textarea"
            placeholder="Description (optional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
          />
          <div className="cp-swatches">
            {AREA_COLORS.map((c) => (
              <button
                key={c} type="button" className={`cp-swatch${color === c ? " active" : ""}`}
                style={{ backgroundColor: c }} onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>

          <div style={{ marginTop: "12px" }}>
            <label className="cp-field-label">
              Courses <span className="cp-optional">(optional)</span>
              {courses.length > 0 && (
                <span style={{ fontWeight: 400, color: "#9CA3AF" }}> · {courses.length} added</span>
              )}
            </label>
            <div style={{ marginTop: "4px" }}>
              <CoursePickerField value={courses} onChange={setCourses} color={color} />
            </div>
          </div>

          <div style={{ marginTop: "12px" }}>
            <label className="cp-field-label">Age Range <span className="cp-optional">(optional)</span></label>
            <p style={{ margin: "2px 0 8px", fontSize: "11px", color: "#9CA3AF" }}>
              Only learners in this age range are auto-issued this area's diagnostic. Leave blank to apply to every age.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div className="cp-comp-eval-input-wrap" style={{ width: "90px" }}>
                <input
                  type="number" min="0" max="120" className="cp-comp-config-input"
                  placeholder="Min" value={minAge}
                  onChange={(e) => setMinAge(e.target.value)}
                />
              </div>
              <span style={{ color: "#9CA3AF", fontSize: "13px" }}>to</span>
              <div className="cp-comp-eval-input-wrap" style={{ width: "90px" }}>
                <input
                  type="number" min="0" max="120" className="cp-comp-config-input"
                  placeholder="Max" value={maxAge}
                  onChange={(e) => setMaxAge(e.target.value)}
                />
              </div>
              <span style={{ color: "#9CA3AF", fontSize: "12px" }}>years</span>
            </div>
            {ageRangeInvalid && (
              <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#DC2626" }}>Max age must be greater than or equal to min age.</p>
            )}
          </div>

          {/* Existing areas set/change their diagnostic from the dedicated section on the card
              instead (see the "Diagnostic Assessment" cp-diag-section below) — kept here only
              for create, since a brand-new area has no card yet to attach that to. */}
          {!editId && (
            <div style={{ marginTop: "12px" }}>
              <label className="cp-field-label">Diagnostic Assessment <span className="cp-optional">(optional)</span></label>
              <p style={{ margin: "2px 0 8px", fontSize: "11px", color: "#9CA3AF" }}>
                Auto-issued once to a learner whose class exposes one of this area's courses. Its graded score places them at a starting course via the Placement Thresholds set up in Learning Journey.
              </p>
              <select
                className="cp-input" style={{ width: "100%", boxSizing: "border-box" }}
                value={diagnosticAssessmentId}
                onChange={(e) => setDiagnosticAssessmentId(e.target.value)}
              >
                <option value="">— None —</option>
                {assessments.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button type="button" className="cp-btn-primary" onClick={submit} disabled={creating || updating || !name.trim() || ageRangeInvalid}>
              {creating || updating ? "Saving…" : editId ? "Update" : "Create"}
            </button>
            <button type="button" className="cp-btn-secondary" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {areas.length === 0 && !showForm ? (
        <div className="cp-empty">
          <div style={{ fontSize: "32px", color: "#9CA3AF", display: "flex", justifyContent: "center", marginBottom: "10px" }}><FolderOpenIcon fontSize="inherit" /></div>
          <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No learning areas yet</p>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#9CA3AF" }}>Group the competencies this curriculum uses under broad learning areas.</p>
          <button type="button" className="cp-btn-ghost" onClick={openCreate}>+ Add First Area</button>
        </div>
      ) : (
        <div className="cp-list">
          {areas.map((area) => {
            const areaColor = area.color || "#25476a";
            return (
              <div key={area.id} className="cp-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div className="cp-item-dot" style={{ backgroundColor: areaColor }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cp-item-name">{area.name}</div>
                    {area.description && <div className="cp-item-sub">{area.description}</div>}
                    {(area.minAge != null || area.maxAge != null) && (
                      <p style={{ margin: "2px 0 0", fontSize: "11px", fontWeight: "600", color: "#9CA3AF" }}>
                        {area.minAge != null && area.maxAge != null
                          ? `${area.minAge}–${area.maxAge} yrs`
                          : area.minAge != null
                          ? `${area.minAge}+ yrs`
                          : `up to ${area.maxAge} yrs`}
                      </p>
                    )}
                  </div>
                  <button type="button" className="cp-icon-btn" onClick={() => openEdit(area)} title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button
                    type="button"
                    className="cp-icon-btn danger"
                    onClick={() => requestDelete({
                      title: `Delete "${area.name}"?`,
                      message: "This learning area will be permanently removed, along with its course sequence and placement thresholds. This cannot be undone.",
                      onConfirm: () => remove(area.id),
                    })}
                    disabled={deleting}
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>

                {area.courses?.length > 0 && (
                  <div className="cp-course-section">
                    <div className="cp-course-header">
                      <div className="cp-course-header-left">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: areaColor, flexShrink: 0 }}>
                          <path d="M12 3L2 8l10 5 8-4.09V17h2V8L12 3z" fill="currentColor"/>
                          <path d="M6 10.5V15c0 1.66 2.69 3 6 3s6-1.34 6-3v-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="cp-course-title">Courses</span>
                      </div>
                      <span className="cp-course-count-badge" style={{ backgroundColor: `${areaColor}12`, borderColor: `${areaColor}35`, color: areaColor }}>
                        {area.courses.length}
                      </span>
                    </div>
                    <div className="cp-course-list">
                      {sequenceFor(area).map((id, i) => {
                        const c = courseById.get(id);
                        const sessionCount = c?.sessionCount ?? 0;
                        return (
                          <div key={id} className="cp-course-row">
                            <span className="cp-course-index" style={{ backgroundColor: `${areaColor}15`, color: areaColor }}>{i + 1}</span>
                            <span className="cp-course-name">{c?.name || "Unknown course"}</span>
                            <span className="cp-course-meta">{sessionCount} lesson{sessionCount !== 1 ? "s" : ""}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="cp-diag-section">
                  <div className="cp-diag-header">
                    <span className="cp-diag-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><MedicalServicesIcon fontSize="inherit" /> Diagnostic Assessment</span>
                  </div>

                  {diagPickerAreaId === area.id ? (
                    <div className="cp-diag-picker">
                      <select
                        className="cp-select" style={{ flex: 1, minWidth: "160px" }}
                        value={diagPickerValue}
                        onChange={(e) => setDiagPickerValue(e.target.value)}
                      >
                        <option value="">— None —</option>
                        {assessments.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <button type="button" className="cp-diag-btn cp-diag-btn-assign" onClick={() => saveDiagPicker(area)} disabled={updating}>
                        {updating ? "Saving…" : "Save"}
                      </button>
                      <button type="button" className="cp-diag-btn cp-diag-btn-clear" onClick={closeDiagPicker}>Cancel</button>
                    </div>
                  ) : area.diagnosticAssessmentId ? (
                    <div className="cp-diag-row">
                      <span className="cp-diag-name">{assessmentNameById[area.diagnosticAssessmentId] || "Diagnostic assigned"}</span>
                      <div className="cp-diag-actions">
                        <button type="button" className="cp-diag-btn cp-diag-btn-change" onClick={() => openDiagPicker(area)}>Change</button>
                        <button type="button" className="cp-diag-btn cp-diag-btn-clear" onClick={() => clearDiagnostic(area)} disabled={updating}>Clear</button>
                      </div>
                    </div>
                  ) : (
                    <div className="cp-diag-empty">
                      <span className="cp-diag-hint">Auto-issued once a learner's class exposes one of this area's courses.</span>
                      <button type="button" className="cp-diag-btn cp-diag-btn-assign" onClick={() => openDiagPicker(area)}>+ Assign</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Learning Journey ──────────────────────────────────────────────────────
 * Course Sequence is read-only display, not configuration — a learning area's
 * starting course is just whichever course was added to it first, over on the
 * Learning Areas tab (see sequenceFor()); there's no reordering or per-
 * Developmental-Stage override step to do here anymore. Mirrors the same
 * read-only treatment LearnerViewPage.jsx's LearningJourneyCard already uses
 * for a learner's own placement — same underlying getLearningJourney default,
 * just shown here at the curriculum level instead of per-learner. What IS
 * still configured here is Placement Thresholds: the diagnostic score needed
 * to place a learner at each course. Per-learner placement (including
 * diagnostic-driven placement) lives on the learner's own profile page, not
 * here. The old Progression Ladder API/model is left untouched (superseded,
 * but still referenced by the Learner page's legacy placement dropdown). */

function LearningJourneyPanel({ curriculumId }) {
  const { data: areas = [], isLoading: areasLoading, isError: areasError } = useLearningAreas(curriculumId);
  const { data: coursesResponse } = useCoursesQuery();
  const { data: allBands = [], isLoading: bandsLoading, isError: bandsError } = usePerformanceBands(curriculumId);
  const { mutate: createBand, isPending: creatingBand } = useCreatePerformanceBand(curriculumId);
  const { mutate: removeBand, isPending: deletingBand } = useDeletePerformanceBand(curriculumId);
  const allCourses = coursesResponse?.data || [];
  const courseNameById = new Map(allCourses.map((c) => [c.id, c.name]));

  const areasWithCourses = areas.filter((a) => (a.courses || []).length > 0);

  if (areasLoading || bandsLoading) return <div className="cp-spinner" style={{ marginTop: "32px" }} />;
  if (areasError || bandsError) return <ErrorNotice message="Couldn't load Learning Journey — try refreshing the page." />;

  return (
    <div>
      <div className="cp-card" style={{ marginBottom: "20px" }}>
        <div style={{ marginBottom: "18px" }}>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Course Sequence</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            The course a learner starts at in each learning area — the first course added to it, over on the Learning Areas tab.
          </p>
        </div>
        {areasWithCourses.length === 0 ? (
          <div className="cp-empty">
            <div style={{ fontSize: "32px", color: "#9CA3AF", display: "flex", justifyContent: "center", marginBottom: "10px" }}><TrackChangesIcon fontSize="inherit" /></div>
            <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No sequenced learning areas yet</p>
            <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", maxWidth: "320px", marginInline: "auto" }}>
              Add courses to a Learning Area first, over on the Learning Areas tab.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {areasWithCourses.map((area) => {
              const ids = sequenceFor(area);
              const areaColor = area.color || "#25476a";
              return (
                <div key={area.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "10px", border: "1px solid #EEF1F5" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: areaColor, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: "13px", fontWeight: "800", color: "#0F2645" }}>{area.name}</span>
                  <span style={{ fontSize: "12.5px", fontWeight: "600", color: "#374151" }}>{courseNameById.get(ids[0]) || "Unknown course"}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="cp-card" style={{ marginTop: "20px" }}>
        <div style={{ marginBottom: "18px" }}>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Placement Thresholds</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            The diagnostic score needed to be placed at each course — a learner scoring below every threshold is placed at the first course in the sequence instead of left unplaced.
          </p>
        </div>
        {areasWithCourses.length === 0 ? (
          <div className="cp-empty">
            <div style={{ fontSize: "32px", color: "#9CA3AF", display: "flex", justifyContent: "center", marginBottom: "10px" }}><TrackChangesIcon fontSize="inherit" /></div>
            <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", maxWidth: "320px", marginInline: "auto" }}>
              Sequence a Learning Area's courses above first.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {areasWithCourses.map((area) => (
              <PlacementThresholdsForArea
                key={area.id}
                area={area}
                ids={sequenceFor(area)}
                courseNameById={courseNameById}
                bands={allBands.filter((b) => b.learningAreaId === area.id)}
                onCreate={createBand}
                onDelete={removeBand}
                saving={creatingBand}
                deleting={deletingBand}
              />
            ))}
          </div>
        )}
      </div>

      <p style={{ margin: "16px 4px 0", fontSize: "12px", color: "#9CA3AF" }}>
        Individual learner placement — including diagnostic-driven placement and manual overrides — happens on each learner's profile page.
      </p>
    </div>
  );
}

function PlacementThresholdsForArea({ area, ids, courseNameById, bands, onCreate, onDelete, saving, deleting }) {
  const [adding, setAdding]     = useState(false);
  const [courseId, setCourseId] = useState(ids[0] || "");
  const [minScore, setMinScore] = useState("");
  const { requestDelete, confirmDialog } = useConfirmDelete();
  const areaColor = area.color || "#25476a";
  const sorted = [...bands].sort((a, b) => a.minScore - b.minScore);

  function openAdd() { setCourseId(ids[0] || ""); setMinScore(""); setAdding(true); }
  function submit() {
    if (!courseId || minScore === "") return;
    const course = courseNameById.get(courseId) || "Course";
    onCreate(
      { name: `${area.name} — ${course}`, minScore: Number(minScore), learningAreaId: area.id, courseId },
      { onSuccess: () => setAdding(false) }
    );
  }

  return (
    <div style={{ border: "1px solid #EEF1F5", borderRadius: "12px", padding: "14px 16px" }}>
      {confirmDialog}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: areaColor }} />
          <span style={{ fontSize: "13px", fontWeight: "800", color: "#0F2645" }}>{area.name}</span>
        </div>
        {!adding && (
          <button type="button" className="cp-btn-secondary" style={{ padding: "5px 10px", fontSize: "11.5px" }} onClick={openAdd}>
            + Add Threshold
          </button>
        )}
      </div>

      {sorted.length === 0 && !adding && (
        <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>
          No thresholds set — a diagnostic for this area always places at the first course in the sequence.
        </p>
      )}

      {sorted.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: adding ? "10px" : 0 }}>
          {sorted.map((b) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 10px", borderRadius: "8px", background: "#FAFCFF" }}>
              <span style={{ fontSize: "11px", fontWeight: "800", color: areaColor, minWidth: "56px" }}>{b.minScore}%+</span>
              <span style={{ flex: 1, fontSize: "12.5px", fontWeight: "600", color: "#1F2937" }}>{courseNameById.get(b.courseId) || "Unknown course"}</span>
              <button
                type="button"
                className="cp-icon-btn danger"
                disabled={deleting}
                onClick={() => requestDelete({
                  title: "Remove this placement threshold?",
                  message: `Learners will no longer be placed into "${courseNameById.get(b.courseId) || "this course"}" at ${b.minScore}%+ on this area's diagnostic. This cannot be undone.`,
                  onConfirm: () => onDelete(b.id),
                })}
                title="Remove threshold"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            style={{ padding: "7px 9px", borderRadius: "8px", border: "1.5px solid #E5E7EB", fontSize: "12.5px", fontFamily: "Inter, sans-serif", color: "#111827" }}
          >
            {ids.map((cid) => (
              <option key={cid} value={cid}>{courseNameById.get(cid) || "Unknown course"}</option>
            ))}
          </select>
          <span style={{ fontSize: "12px", color: "#9CA3AF" }}>at score ≥</span>
          <input
            type="number" min="0" max="100" value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            style={{ width: "70px", padding: "7px 9px", borderRadius: "8px", border: "1.5px solid #E5E7EB", fontSize: "12.5px", fontFamily: "Inter, sans-serif", color: "#111827" }}
          />
          <span style={{ fontSize: "12px", color: "#9CA3AF" }}>%</span>
          <button type="button" className="cp-btn-primary" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={submit} disabled={saving || !courseId || minScore === ""}>
            {saving ? "Saving…" : "Add"}
          </button>
          <button type="button" className="cp-btn-secondary" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => setAdding(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

/* ── CardKebab ──────────────────────────────────────────────────────────── */

// `itemLabel`/`itemType` (e.g. "Continuous Assessment" / "assessment type") drive the delete
// confirmation copy — every caller of this kebab previously fired onDelete() straight from the
// menu click with no confirmation at all, so a mis-click permanently destroyed configuration.
function CardKebab({ onEdit, onDelete, disabled, itemLabel = "this item", itemType = "item", message, onDuplicate, duplicateLabel, duplicateTitle, duplicateMessage }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        className="cp-card-kebab-btn"
        onClick={() => setOpen((v) => !v)}
        title="Options"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
        </svg>
      </button>

      {open && (
        <div className="cp-card-menu">
          <button
            type="button"
            className="cp-card-menu-item"
            onClick={() => { setOpen(false); onEdit(); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Edit
          </button>
          {onDuplicate && (
            <button
              type="button"
              className="cp-card-menu-item"
              onClick={() => { setOpen(false); setDuplicating(true); }}
              disabled={disabled}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {duplicateLabel || "Duplicate"}
            </button>
          )}
          <button
            type="button"
            className="cp-card-menu-item cp-card-menu-item--danger"
            onClick={() => { setOpen(false); setConfirming(true); }}
            disabled={disabled}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Delete
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirming}
        title={`Delete "${itemLabel}"?`}
        message={message || `This ${itemType} will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { setConfirming(false); onDelete(); }}
        onCancel={() => setConfirming(false)}
      />

      {onDuplicate && (
        <ConfirmDialog
          isOpen={duplicating}
          title={duplicateTitle || "Duplicate configuration?"}
          message={duplicateMessage || "This will overwrite the target's current configuration."}
          confirmLabel="Duplicate"
          variant="default"
          onConfirm={() => { setDuplicating(false); onDuplicate(); }}
          onCancel={() => setDuplicating(false)}
        />
      )}
    </div>
  );
}

/* ── CompetencyPickerPanel ───────────────────────────────────────────────
 * Competencies (name/description) are authored once in Settings and shared
 * across the whole app. This panel just lets a curriculum import entries
 * from that catalog so it's on record which competencies it uses — nothing
 * about how they're evaluated is configured here. */

const COMP_PALETTE = [
  "#25476a","#38aae1","#059669","#7C3AED",
  "#DC2626","#D97706","#0891B2","#BE185D",
  "#2e7db5","#0A3880",
];

function AddCompetencyDropdown({ available, onAdd, isPending }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
    else setQuery("");
  }, [open]);

  const trimmed = query.trim();
  const filtered = trimmed
    ? available.filter((c) => c.name.toLowerCase().includes(trimmed.toLowerCase()))
    : available;

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button type="button" className="cp-btn-primary" onClick={() => setOpen((v) => !v)}>
        + Add Competency
      </button>
      {open && (
        <div className="cp-card-menu" style={{ width: "280px", maxHeight: "360px", overflow: "hidden", display: "flex", flexDirection: "column", right: 0, padding: 0 }}>
          <div style={{ position: "relative", flexShrink: 0, borderBottom: "1px solid #F0F2F5" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              style={{
                width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 34px", border: "none",
                fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none", color: "#111827", background: "#fff",
              }}
            />
          </div>
          <div style={{ overflowY: "auto", padding: "6px" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "22px 12px", textAlign: "center" }}>
                <div style={{ fontSize: "22px", marginBottom: "4px" }}>{available.length === 0 ? <CheckCircleIcon fontSize="medium" /> : <SearchIcon fontSize="medium" />}</div>
                <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>
                  {available.length === 0 ? "All competencies are already added to this curriculum." : "No matches found."}
                </p>
              </div>
            )}
            {filtered.map((comp) => (
              <button
                key={comp.id}
                type="button"
                className="cp-card-menu-item"
                disabled={isPending}
                onClick={() => { onAdd(comp.id); setOpen(false); }}
              >
                {comp.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompetencyRemoveMenu({ onRemove, competencyName }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button type="button" className="cp-card-kebab-btn" onClick={() => setOpen((v) => !v)} title="Options">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
        </svg>
      </button>
      {open && (
        <div className="cp-card-menu">
          <button
            type="button"
            className="cp-card-menu-item cp-card-menu-item--danger"
            onClick={() => { setOpen(false); setConfirming(true); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Remove from curriculum
          </button>
        </div>
      )}
      <ConfirmDialog
        isOpen={confirming}
        title={`Remove "${competencyName}"?`}
        message="This competency will no longer be used in this curriculum — any Performance Band or Assessment Type configuration tied to it here will lose that link. This cannot be undone."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => { setConfirming(false); onRemove(); }}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

function CompetencyPickerPanel({ curriculumId }) {
  const { data: allComps = [], isLoading: loadingAll, isError: errorAll } = useGlobalCompetencies();
  const { data: linkedComps = [], isLoading: loadingLinked, isError: errorLinked } = useCompetencies(curriculumId);
  const { mutate: link, isPending: linking } = useLinkCompetency(curriculumId);
  const { mutate: unlink } = useUnlinkCompetency(curriculumId);

  const linkedIds = new Set(linkedComps.map((c) => c.id));
  const availableComps = allComps.filter((c) => !linkedIds.has(c.id));
  const isLoading = loadingAll || loadingLinked;

  if (isLoading) return <div className="cp-spinner" style={{ marginTop: "48px" }} />;
  if (errorAll || errorLinked) return <ErrorNotice message="Couldn't load Competencies — try refreshing the page." />;

  return (
    <div className="cp-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Competencies</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {linkedComps.length} competenc{linkedComps.length !== 1 ? "ies" : "y"} used in this curriculum
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link to="/settings" className="cp-btn-secondary" style={{ textDecoration: "none" }}>
            Manage in Settings →
          </Link>
          <AddCompetencyDropdown available={availableComps} onAdd={link} isPending={linking} />
        </div>
      </div>

      {linkedComps.length === 0 ? (
        <div className="cp-empty">
          <div style={{ fontSize: "40px", color: "#9CA3AF", display: "flex", justifyContent: "center", marginBottom: "12px" }}><TrackChangesIcon fontSize="inherit" /></div>
          <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "800", color: "#374151" }}>
            No competencies added yet
          </p>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9CA3AF", maxWidth: "340px", marginInline: "auto", lineHeight: "1.6" }}>
            {allComps.length === 0
              ? "Competencies are authored in Settings so every curriculum, course, and assessment can share the same catalog."
              : "Add competencies from the shared catalog to use them in this curriculum."}
          </p>
          {allComps.length === 0 ? (
            <Link to="/settings" className="cp-btn-ghost">+ Define Competencies in Settings</Link>
          ) : (
            <AddCompetencyDropdown available={availableComps} onAdd={link} isPending={linking} />
          )}
        </div>
      ) : (
        <div className="cp-comp-grid">
          {linkedComps.map((comp, idx) => (
            <LinkedCompetencyCard
              key={comp.id}
              comp={comp}
              color={COMP_PALETTE[idx % COMP_PALETTE.length]}
              onRemove={() => unlink(comp.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LinkedCompetencyCard({ comp, color, onRemove }) {
  const initial = comp.name.charAt(0).toUpperCase();
  const indicators = comp.indicators || [];
  const [open, setOpen] = useState(false);

  return (
    <div className="cp-comp-card">
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
        <div style={{
          width: "42px", height: "42px", borderRadius: "12px", flexShrink: 0,
          backgroundColor: `${color}15`, border: `2px solid ${color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "17px", fontWeight: "800", color,
        }}>
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827", lineHeight: 1.35, wordBreak: "break-word" }}>
            {comp.name}
          </p>
        </div>
        <CompetencyRemoveMenu onRemove={onRemove} competencyName={comp.name} />
      </div>

      <div style={{ flex: 1 }}>
        {comp.description ? (
          <p style={{
            margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: "1.65",
            display: "-webkit-box", WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {comp.description}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>
            No description added
          </p>
        )}
      </div>

      {/* Read-only mirror of how this competency is authored in Settings — nothing here is editable or curriculum-specific. */}
      {indicators.length > 0 && (
        <div>
          <button type="button" className="cp-comp-ind-toggle" onClick={() => setOpen((v) => !v)}>
            <span>{indicators.length} indicator{indicators.length !== 1 ? "s" : ""}</span>
            <svg className={`cp-comp-ind-chevron${open ? " open" : ""}`} width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {open && (
            <div className="cp-comp-ind-list">
              {indicators.map((ind, idx) => (
                <div key={ind.id || idx} className="cp-comp-ind-item">
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#374151" }}>{ind.name}</p>
                  {ind.description && (
                    <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "#9CA3AF" }}>{ind.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Assessment Framework helpers ───────────────────────────────────────── */

function CrudPanel({ title, subtitle, emptyIcon, emptyTitle, emptyText, addLabel, items, isLoading, isError, onAdd, renderCard, mode, formContent }) {
  if (isLoading) return <div className="cp-spinner" style={{ marginTop: "48px" }} />;
  if (isError) return <ErrorNotice message={`Couldn't load ${title} — try refreshing the page.`} />;
  return (
    <div>
      {/* ── Modal overlay for add / edit form ── */}
      {mode !== "list" && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(15,38,69,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px",
        }}>
          <div style={{
            background: "#fff", borderRadius: "16px",
            width: "100%", maxWidth: "480px",
            maxHeight: "88vh", overflowY: "auto",
            boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
          }}>
            {formContent}
          </div>
        </div>
      )}

      {/* ── Panel header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>{title}</h3>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>{subtitle}</p>
        </div>
        <button type="button" className="cp-btn-primary" onClick={onAdd}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
          {addLabel}
        </button>
      </div>

      {/* ── List / empty state ── */}
      {items.length === 0 ? (
        <div className="cp-empty">
          <div style={{ fontSize: "36px", color: "#9CA3AF", display: "flex", justifyContent: "center", marginBottom: "10px" }}>{emptyIcon}</div>
          <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>{emptyTitle}</p>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#9CA3AF", maxWidth: "300px", marginInline: "auto" }}>{emptyText}</p>
          <button type="button" className="cp-btn-ghost" onClick={onAdd}>+ {addLabel}</button>
        </div>
      ) : (
        <div className="cp-comp-grid">
          {items.map(renderCard)}
        </div>
      )}
    </div>
  );
}

/* ── AssessmentTypesSubPanel ─────────────────────────────────────────────── */

const BEHAVIOR_OPTIONS = [
  { value: "diagnostic", label: "Diagnostic", desc: "Evaluates prior knowledge and placement — no pass/fail" },
  { value: "formative",  label: "Formative",  desc: "Tracks continuous progress — flexible evaluation" },
  { value: "summative",  label: "Summative",  desc: "Determines final competency — strict requirements" },
];

const BEHAVIOR_COLORS = { diagnostic: "#feb139", formative: "#38aae1", summative: "#25476a" };

function AssessmentTypesSubPanel({ curriculumId }) {
  const { data: types = [], isLoading, isError } = useAssessmentTypes(curriculumId);
  const { data: evidences = [] }        = useEvidenceTypes(curriculumId);
  const { mutate: create, isPending: creating } = useCreateAssessmentType(curriculumId);
  const { mutate: update, isPending: updating } = useUpdateAssessmentType(curriculumId);
  const { mutate: remove, isPending: deleting } = useDeleteAssessmentType(curriculumId);

  const [mode, setMode]         = useState("list");
  const [editTarget, setEdit]   = useState(null);
  const [name, setName]         = useState("");
  const [desc, setDesc]         = useState("");
  const [behavior, setBehavior] = useState("formative");
  const nameRef = useRef(null);
  useEffect(() => { if (mode !== "list") nameRef.current?.focus(); }, [mode]);

  function openAdd()  { setEdit(null); setName(""); setDesc(""); setBehavior("formative"); setMode("add"); }
  function openEdit(t){ setEdit(t); setName(t.name); setDesc(t.description || ""); setBehavior(t.behaviorType || "formative"); setMode("edit"); }
  function cancel()   { setMode("list"); setEdit(null); }
  function submit() {
    if (!name.trim()) return;
    const data = { name: name.trim(), description: desc.trim(), behaviorType: behavior };
    if (mode === "edit") update({ id: editTarget.id, data }, { onSuccess: cancel });
    else create(data, { onSuccess: () => { setName(""); setDesc(""); setBehavior("formative"); nameRef.current?.focus(); } });
  }

  const form = (
    <div className="cp-comp-form-card" style={{ marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0F2645" }}>{mode === "edit" ? "Edit Type" : "New Assessment Type"}</h3>
        <button type="button" className="cp-icon-btn" onClick={cancel}><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <label className="cp-field-label">Name <span className="cp-required">*</span></label>
          <input ref={nameRef} className="cp-input" style={{ width: "100%", boxSizing: "border-box" }}
            placeholder="e.g. Continuous Assessment, End of Term Test…"
            value={name} maxLength={150}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
          />
          <div className="cp-char-count">{name.length} / 150</div>
        </div>
        <div>
          <label className="cp-field-label">Behavior Mode <span className="cp-required">*</span></label>
          <p style={{ margin: "2px 0 8px", fontSize: "11px", color: "#9CA3AF" }}>Controls how scoring rules and outcomes are applied for this type.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {BEHAVIOR_OPTIONS.map((opt) => {
              const active = behavior === opt.value;
              const col    = BEHAVIOR_COLORS[opt.value];
              return (
                <button
                  key={opt.value} type="button"
                  onClick={() => setBehavior(opt.value)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "9px 12px", borderRadius: "8px", cursor: "pointer", textAlign: "left",
                    border: `2px solid ${active ? col : "#E5E7EB"}`,
                    background: active ? `${col}10` : "#F9FAFB",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ width: "14px", height: "14px", borderRadius: "50%", border: `2px solid ${active ? col : "#D1D5DB"}`, background: active ? col : "transparent", flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: active ? col : "#374151" }}>{opt.label}</span>
                    <span style={{ fontSize: "11px", color: "#9CA3AF", marginLeft: "8px" }}>{opt.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="cp-field-label">Description <span className="cp-optional">(optional)</span></label>
          <textarea className="cp-textarea" rows={3} placeholder="What is this assessment type used for?" value={desc} maxLength={1000} onChange={(e) => setDesc(e.target.value)} />
          <div className="cp-char-count">{desc.length} / 1000</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
        <button type="button" className="cp-btn-primary" onClick={submit} disabled={(creating || updating) || !name.trim()}>
          {creating || updating ? "Saving…" : mode === "edit" ? "Save Changes" : "Add Type"}
        </button>
        <button type="button" className="cp-btn-secondary" onClick={cancel}>Cancel</button>
      </div>
    </div>
  );

  return (
    <CrudPanel
      title="Assessment Types" subtitle={types.length === 0 ? "Define the categories of assessment used in this curriculum" : `${types.length} type${types.length !== 1 ? "s" : ""} defined`}
      emptyIcon={<AssignmentIcon fontSize="inherit" />} emptyTitle="No assessment types yet" addLabel="Add Type" mode={mode} onAdd={openAdd} formContent={form} items={types} isLoading={isLoading} isError={isError}
      emptyText="Create assessment types like 'Continuous Assessment' or 'End of Term Test'."
      renderCard={(t, idx) => {
        const color = BEHAVIOR_COLORS[t.behaviorType] || "#25476a";
        return (
          <div key={t.id} className={`cp-comp-card${mode === "edit" && editTarget?.id === t.id ? " cp-comp-card--editing" : ""}`}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "12px", flexShrink: 0, backgroundColor: `${color}15`, border: `2px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", fontWeight: "800", color }}>
                {t.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827", lineHeight: 1.35 }}>{t.name}</p>
                <div style={{ display: "flex", gap: "6px", marginTop: "5px", flexWrap: "wrap" }}>
                  {t.behaviorType && (
                    <span style={{ fontSize: "10px", fontWeight: "700", color: BEHAVIOR_COLORS[t.behaviorType] || "#6B7280", background: `${BEHAVIOR_COLORS[t.behaviorType] || "#6B7280"}15`, padding: "2px 7px", borderRadius: "20px", textTransform: "capitalize" }}>
                      {t.behaviorType}
                    </span>
                  )}
                  {(t.evidenceWeights || []).length > 0 && (
                    <span style={{ fontSize: "10px", fontWeight: "600", color: "#059669", background: "#05966915", padding: "2px 7px", borderRadius: "20px" }}>
                      {(t.evidenceWeights || []).length} evidence scored
                    </span>
                  )}
                </div>
              </div>
              <CardKebab onEdit={() => openEdit(t)} onDelete={() => remove(t.id)} disabled={deleting} itemLabel={t.name} itemType="assessment type" />
            </div>
            <div style={{ flex: 1 }}>
              {t.description && (
                <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#6B7280", lineHeight: "1.65", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.description}</p>
              )}

              {/* ── Evidence breakdown (from Score Evidence config) ── */}
              {(t.evidenceWeights || []).length > 0 ? (() => {
                const evTotal = Math.round((t.evidenceWeights || []).reduce((s, ew) => s + (ew.contribution || 0), 0));
                const evOk    = evTotal === 100;
                const bCol    = BEHAVIOR_COLORS[t.behaviorType] || color;
                return (
                  <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "10px" }}>
                    <p style={{ margin: "0 0 7px", fontSize: "10px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Evidence Breakdown</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      {(t.evidenceWeights || []).map((ew) => {
                        const ev = evidences.find((e) => e.id === ew.evidenceTypeId);
                        return (
                          <div key={ew.evidenceTypeId}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                              <span style={{ fontSize: "11px", fontWeight: "600", color: "#374151", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {ev?.name || "Unknown evidence"}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginLeft: "8px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "800", color: bCol }}>{ew.contribution}%</span>
                              </div>
                            </div>
                            <div style={{ height: "4px", borderRadius: "2px", background: "#F3F4F6", overflow: "hidden" }}>
                              <div style={{ height: "100%", borderRadius: "2px", width: `${Math.min(100, ew.contribution)}%`, background: `${bCol}70`, transition: "width 0.3s" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Totals row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px", paddingTop: "7px", borderTop: "1px dashed #EBEBEB" }}>
                      <span style={{ fontSize: "10px", color: "#9CA3AF", fontWeight: "600" }}>Evidence total</span>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: evOk ? "#059669" : "#D97706" }}>
                        {evTotal}%{evOk ? "" : " — incomplete"}
                      </span>
                    </div>
                    {t.typeWeight > 0 && (
                      <div style={{ marginTop: "7px", padding: "5px 10px", borderRadius: "8px", background: `${bCol}08`, border: `1px solid ${bCol}20`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "10px", color: "#9CA3AF", fontWeight: "600" }}>Final score contribution</span>
                        <span style={{ fontSize: "12px", fontWeight: "800", color: bCol }}>{t.typeWeight}%</span>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "10px" }}>
                  <p style={{ margin: 0, fontSize: "11px", color: "#C4C9D4", fontStyle: "italic" }}>
                    No evidence assigned — configure in <strong style={{ fontWeight: "600" }}>Score Evidence</strong>.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      }}
    />
  );
}

/* ── EvidenceTypesSubPanel ───────────────────────────────────────────────── */

const EVIDENCE_PALETTE = ["#25476a","#feb139","#38aae1"];

// Mirrors the fixed type list on the real Assessment Builder (quiz/exam/project/assignment/observation)
// so a course-attached assessment can be auto-matched to the evidence type that scores it.
const EVIDENCE_CATEGORY_OPTIONS = [
  { value: "",             label: "— No builder match (custom evidence) —" },
  { value: "quiz",         label: "Quiz" },
  { value: "exam",         label: "Exam" },
  { value: "project",      label: "Project" },
  { value: "assignment",   label: "Assignment" },
  { value: "observation",  label: "Observation" },
];

function EvidenceTypesSubPanel({ curriculumId }) {
  const { data: evidences = [], isLoading, isError } = useEvidenceTypes(curriculumId);
  const { data: types = [] }               = useAssessmentTypes(curriculumId);
  const { mutate: create, isPending: creating } = useCreateEvidenceType(curriculumId);
  const { mutate: update, isPending: updating } = useUpdateEvidenceType(curriculumId);
  const { mutate: remove, isPending: deleting } = useDeleteEvidenceType(curriculumId);

  const [mode,        setMode]       = useState("list");
  const [editTarget,  setEdit]       = useState(null);
  const [name,        setName]       = useState("");
  const [desc,        setDesc]       = useState("");
  const [category,    setCategory]   = useState("");
  const [defContrib,  setDefContrib] = useState("0");
  const [minCount,    setMinCount]   = useState("0");
  const nameRef = useRef(null);
  useEffect(() => { if (mode !== "list") nameRef.current?.focus(); }, [mode]);

  function openAdd()  { setEdit(null); setName(""); setDesc(""); setCategory(""); setDefContrib("0"); setMinCount("0"); setMode("add"); }
  function openEdit(e){ setEdit(e); setName(e.name); setDesc(e.description || ""); setCategory(e.category || ""); setDefContrib(String(e.defaultContribution ?? 0)); setMinCount(String(e.minItemCount ?? 0)); setMode("edit"); }
  function cancel()   { setMode("list"); setEdit(null); }
  function submit() {
    if (!name.trim()) return;
    const data = {
      name: name.trim(), description: desc.trim(),
      category: category || null,
      defaultContribution: Math.min(100, Math.max(0, Number(defContrib) || 0)),
      minItemCount:        Math.max(0, Math.floor(Number(minCount) || 0)),
    };
    if (mode === "edit") update({ id: editTarget.id, data }, { onSuccess: cancel });
    else create(data, { onSuccess: () => { setName(""); setDesc(""); setCategory(""); setDefContrib("0"); setMinCount("0"); nameRef.current?.focus(); } });
  }

  const form = (
    <div className="cp-comp-form-card" style={{ marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0F2645" }}>{mode === "edit" ? "Edit Evidence Type" : "New Evidence Type"}</h3>
        <button type="button" className="cp-icon-btn" onClick={cancel}><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <label className="cp-field-label">Name <span className="cp-required">*</span></label>
          <input ref={nameRef} className="cp-input" style={{ width: "100%", boxSizing: "border-box" }}
            placeholder="e.g. Quiz, Assignment, Project, Teacher Observation…"
            value={name} maxLength={150}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
          />
          <div className="cp-char-count">{name.length} / 150</div>
        </div>
        <div>
          <label className="cp-field-label">Assessment Category</label>
          <p style={{ margin: "2px 0 6px", fontSize: "11px", color: "#9CA3AF" }}>
            Which builder assessment type does this evidence come from? Lets a course-attached assessment auto-match to this evidence type.
          </p>
          <select className="cp-select" style={{ width: "100%", boxSizing: "border-box" }} value={category} onChange={(e) => setCategory(e.target.value)}>
            {EVIDENCE_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="cp-field-label">Default Contribution %</label>
          <p style={{ margin: "2px 0 6px", fontSize: "11px", color: "#9CA3AF" }}>Auto-filled when attached to an assessment type.</p>
          <div style={{ position: "relative" }}>
            <input className="cp-input" type="number" min="0" max="100" style={{ width: "100%", boxSizing: "border-box", paddingRight: "30px" }}
              value={defContrib}
              onChange={(e) => setDefContrib(e.target.value)}
            />
            <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "12px", color: "#9CA3AF", pointerEvents: "none" }}>%</span>
          </div>
        </div>
        <div>
          <label className="cp-field-label">Minimum Count</label>
          <p style={{ margin: "2px 0 6px", fontSize: "11px", color: "#9CA3AF" }}>
            {name.trim()
              ? `Minimum number of "${name.trim()}" expected in a course. Reference only — not yet enforced by scoring.`
              : "Minimum number of this evidence type expected in a course (e.g. minimum quizzes to complete). Reference only — not yet enforced by scoring."}
          </p>
          <input className="cp-input" type="number" min="0" step="1" style={{ width: "100%", boxSizing: "border-box" }}
            value={minCount}
            onChange={(e) => setMinCount(e.target.value)}
          />
        </div>
        <div>
          <label className="cp-field-label">Description <span className="cp-optional">(optional)</span></label>
          <textarea className="cp-textarea" rows={2} placeholder="Briefly describe what this evidence type involves…" value={desc} maxLength={500} onChange={(e) => setDesc(e.target.value)} />
          <div className="cp-char-count">{desc.length} / 500</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
        <button type="button" className="cp-btn-primary" onClick={submit} disabled={(creating || updating) || !name.trim()}>
          {creating || updating ? "Saving…" : mode === "edit" ? "Save Changes" : "Add Evidence Type"}
        </button>
        <button type="button" className="cp-btn-secondary" onClick={cancel}>Cancel</button>
      </div>
    </div>
  );

  return (
    <CrudPanel
      title="Evidence Types" subtitle={evidences.length === 0 ? "Define the evidence methods used to assess learning" : `${evidences.length} evidence type${evidences.length !== 1 ? "s" : ""} defined`}
      emptyIcon={<ScienceIcon fontSize="inherit" />} emptyTitle="No evidence types yet" addLabel="Add Evidence Type" mode={mode} onAdd={openAdd} formContent={form} items={evidences} isLoading={isLoading} isError={isError}
      emptyText="Add evidence types like Quiz, Assignment, Project, or Teacher Observation."
      renderCard={(e, idx) => {
        const color = EVIDENCE_PALETTE[idx % EVIDENCE_PALETTE.length];
        return (
          <div key={e.id} className={`cp-comp-card${mode === "edit" && editTarget?.id === e.id ? " cp-comp-card--editing" : ""}`}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "12px", flexShrink: 0, backgroundColor: `${color}15`, border: `2px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", fontWeight: "800", color }}>
                {e.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827", lineHeight: 1.35 }}>{e.name}</p>
                <div style={{ display: "flex", gap: "6px", marginTop: "5px", flexWrap: "wrap" }}>
                  {e.category && (
                    <span style={{ fontSize: "10px", fontWeight: "700", color: "#7C3AED", background: "#7C3AED15", padding: "2px 7px", borderRadius: "20px", textTransform: "capitalize" }}>
                      {e.category}
                    </span>
                  )}
                  {e.defaultContribution > 0 && (
                    <span style={{ fontSize: "10px", fontWeight: "600", color: "#2563EB", background: "#2563EB15", padding: "2px 7px", borderRadius: "20px" }}>
                      {e.defaultContribution}% default
                    </span>
                  )}
                  {e.minItemCount > 0 && (
                    <span style={{ fontSize: "10px", fontWeight: "600", color: "#059669", background: "#05966915", padding: "2px 7px", borderRadius: "20px" }}>
                      min {e.minItemCount} item{e.minItemCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
              <CardKebab onEdit={() => openEdit(e)} onDelete={() => remove(e.id)} disabled={deleting} itemLabel={e.name} itemType="evidence type" />
            </div>
            <div style={{ flex: 1 }}>
              {e.description && (
                <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#6B7280", lineHeight: "1.65", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.description}</p>
              )}

              {/* ── Used in (from Score Evidence config) ── */}
              {(() => {
                const usedIn = types.filter((at) =>
                  (at.evidenceWeights || []).some((ew) => ew.evidenceTypeId === e.id)
                );
                if (usedIn.length === 0) return (
                  <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "10px" }}>
                    <p style={{ margin: 0, fontSize: "11px", color: "#C4C9D4", fontStyle: "italic" }}>
                      Not assigned to any assessment type yet — configure in <strong style={{ fontWeight: "600" }}>Score Evidence</strong>.
                    </p>
                  </div>
                );
                return (
                  <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: "10px" }}>
                    <p style={{ margin: "0 0 7px", fontSize: "10px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Used In</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      {usedIn.map((at) => {
                        const ew  = (at.evidenceWeights || []).find((w) => w.evidenceTypeId === e.id);
                        const col = BEHAVIOR_COLORS[at.behaviorType] || "#6B7280";
                        return (
                          <div key={at.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", borderRadius: "8px", background: `${col}08`, border: `1px solid ${col}18` }}>
                            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: col, flexShrink: 0 }} />
                            <span style={{ fontSize: "12px", fontWeight: "600", color: col, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {at.name}
                            </span>
                            <span style={{ fontSize: "12px", fontWeight: "800", color: col, flexShrink: 0 }}>
                              {ew?.contribution ?? 0}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      }}
    />
  );
}


/* ── ScoreEvidenceSubPanel ──────────────────────────────────────────────── */

function ScoreEvidenceSubPanel({ curriculumId }) {
  const { data: types     = [], isLoading: typesLoading, isError: typesError } = useAssessmentTypes(curriculumId);
  const { data: evidences = [], isLoading: evLoading, isError: evError } = useEvidenceTypes(curriculumId);
  const { mutate: saveGlobal, isPending: saving }         = useUpdateGlobalScoring(curriculumId);

  // typeConfigs: { [atId]: { [etId]: { selected: bool, contribution } } }
  const [typeConfigs,    setTypeConfigs]    = useState({});
  const [typeWeights,    setTypeWeights]    = useState({});
  const [isDirty,        setIsDirty]        = useState(false);
  const [activeTypeId,   setActiveTypeId]   = useState(null);

  useEffect(() => {
    if (!types.length || !evidences.length) return;
    // Skip reinitialisation while the user has unsaved changes — only reset from
    // server data on initial load or after a successful save (which sets isDirty=false
    // via the onSuccess callback before this effect fires with the new data).
    if (isDirty) return;
    const tcfg = {};
    types.forEach((at) => {
      const slot = {};
      evidences.forEach((et) => {
        slot[et.id] = { selected: false, contribution: et.defaultContribution ?? 0 };
      });
      (at.evidenceWeights || []).forEach((ew) => {
        if (slot[ew.evidenceTypeId]) {
          slot[ew.evidenceTypeId] = {
            selected:     true,
            contribution: ew.contribution,
          };
        }
      });
      tcfg[at.id] = slot;
    });
    setTypeConfigs(tcfg);
    const tw = {};
    types.forEach((at) => { tw[at.id] = at.typeWeight ?? 0; });
    setTypeWeights(tw);
    setActiveTypeId((prev) => prev ?? types[0]?.id ?? null);
  }, [types, evidences, isDirty]);

  function toggleEvidence(atId, etId) {
    const et = evidences.find((e) => e.id === etId);
    setTypeConfigs((prev) => {
      const slot = prev[atId] || {};
      const cur  = slot[etId] || { selected: false, contribution: et?.defaultContribution ?? 0 };
      const nowOn = !cur.selected;
      return { ...prev, [atId]: { ...slot, [etId]: { ...cur, selected: nowOn, contribution: nowOn ? (cur.contribution || (et?.defaultContribution ?? 0)) : 0 } } };
    });
    setIsDirty(true);
  }

  function setContrib(atId, etId, val) {
    setTypeConfigs((prev) => {
      const slot = prev[atId] || {};
      return { ...prev, [atId]: { ...slot, [etId]: { ...slot[etId], contribution: Math.min(100, Math.max(0, Number(val) || 0)) } } };
    });
    setIsDirty(true);
  }

  const anyAssigned = types.some((at) => Object.values(typeConfigs[at.id] || {}).some((v) => v.selected));

  // Tier-1: per-type evidence totals (each must hit 100% if it has any evidence)
  const typeTotals = Object.fromEntries(
    types.map((at) => {
      const total = Object.values(typeConfigs[at.id] || {})
        .filter((v) => v.selected)
        .reduce((s, v) => s + (v.contribution || 0), 0);
      return [at.id, Math.round(total)];
    })
  );
  const evOk = (atId) => {
    const count = Object.values(typeConfigs[atId] || {}).filter((v) => v.selected).length;
    return count === 0 || typeTotals[atId] === 100;
  };

  // Tier-2: type weights must sum to 100%
  const typeWeightTotal   = Object.values(typeWeights).reduce((s, w) => s + (w || 0), 0);
  const typeWeightRounded = Math.round(typeWeightTotal);
  const twOk    = typeWeightRounded === 100;
  const twColor = twOk ? "#059669" : typeWeightRounded > 100 ? "#DC2626" : "#D97706";
  const twBg    = twOk ? "#05966910" : typeWeightRounded > 100 ? "#DC262610" : "#D9770610";

  const allTypesOk = types.every((at) => evOk(at.id)) && twOk;

  function handleSave() {
    if (!allTypesOk) return;
    const assessmentTypes = types.map((at) => ({
      id:         at.id,
      typeWeight: typeWeights[at.id] ?? 0,
      evidenceWeights: Object.entries(typeConfigs[at.id] || {})
        .filter(([, v]) => v.selected)
        .map(([etId, v]) => ({
          evidenceTypeId: etId,
          contribution:   v.contribution,
        })),
    }));
    setIsDirty(false);
    saveGlobal({ assessmentTypes, competencyWeights: [] });
  }


  if (typesLoading || evLoading) return <div className="cp-spinner" style={{ marginTop: "48px" }} />;
  if (typesError || evError) return <ErrorNotice message="Couldn't load Score Evidence — try refreshing the page." />;
  if (types.length === 0) return (
    <div className="cp-empty">
      <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No Assessment Types Yet</p>
      <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>Create assessment types first, then configure scoring here.</p>
    </div>
  );
  if (evidences.length === 0) return (
    <div className="cp-empty">
      <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No Evidence Types Yet</p>
      <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>Create evidence types first, then assign them here.</p>
    </div>
  );

  return (
    <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>

      {/* ══ LEFT — Config ══ */}
      <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: "28px" }}>

      {/* ══ STEP 1 — Evidence Weights ══ */}
      <div>
        {/* Step header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "14px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", borderRadius: "50%", background: "#0F2645", color: "#fff", fontSize: "11px", fontWeight: "800", flexShrink: 0, marginTop: "1px" }}>1</span>
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: "800", color: "#0F2645" }}>Evidence Weights</h3>
            <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>For each assessment type, select the evidence types that apply and set how much each one contributes. Contributions must total 100%.</p>
          </div>
        </div>

        {/* Assessment type pill tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
          {types.map((at) => {
            const col    = BEHAVIOR_COLORS[at.behaviorType] || "#6B7280";
            const active = activeTypeId === at.id;
            const ok     = evOk(at.id);
            const count  = Object.values(typeConfigs[at.id] || {}).filter((v) => v.selected).length;
            const total  = typeTotals[at.id] ?? 0;
            return (
              <button key={at.id} type="button" onClick={() => setActiveTypeId(at.id)} style={{
                display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px",
                borderRadius: "24px", cursor: "pointer", transition: "all 0.18s",
                border: `2px solid ${active ? col : "#E5E7EB"}`,
                background: active ? col : "#fff",
                boxShadow: active ? `0 2px 10px ${col}30` : "none",
              }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: active ? "#fff" : "#374151" }}>{at.name}</span>
                {count > 0 && (
                  <span style={{
                    fontSize: "10px", fontWeight: "800", padding: "2px 7px", borderRadius: "12px",
                    color: active ? col : (ok ? "#059669" : "#D97706"),
                    background: active ? "#fff" : (ok ? "#05966914" : "#D9770614"),
                    border: `1px solid ${active ? "transparent" : (ok ? "#05966930" : "#D9770630")}`,
                  }}>
                    {total}%{ok && count > 0 ? "" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Evidence panel for active type */}
        {(() => {
          const at = types.find((t) => t.id === activeTypeId);
          if (!at) return null;
          const col   = BEHAVIOR_COLORS[at.behaviorType] || "#6B7280";
          const total = typeTotals[at.id] ?? 0;
          const ok    = evOk(at.id);
          return (
            <div style={{ border: `1.5px solid ${col}30`, borderRadius: "12px", overflow: "hidden" }}>
              {/* Panel header */}
              <div style={{ padding: "11px 16px", background: `${col}0c`, borderBottom: `1px solid ${col}20`, display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: col, flexShrink: 0 }} />
                <span style={{ fontSize: "13px", fontWeight: "800", color: col }}>{at.name}</span>
                {at.behaviorType && (
                  <span style={{ fontSize: "10px", fontWeight: "700", color: col, background: `${col}18`, padding: "2px 9px", borderRadius: "10px", textTransform: "capitalize", letterSpacing: "0.03em" }}>
                    {at.behaviorType}
                  </span>
                )}
              </div>

              {/* Evidence rows */}
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "6px", background: "#fff" }}>
                {evidences.map((et) => {
                  const slot = typeConfigs[at.id]?.[et.id] || { selected: false, contribution: et.defaultContribution ?? 0 };
                  const isOn = slot.selected;
                  return (
                    <div key={et.id} style={{
                      borderRadius: "10px", overflow: "hidden",
                      border: `1.5px solid ${isOn ? col + "35" : "#F0F0F0"}`,
                      background: isOn ? `${col}06` : "#FAFAFA",
                      transition: "all 0.15s",
                    }}>
                      {/* Main row */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px" }}>
                        {/* Checkbox */}
                        <button type="button" onClick={() => toggleEvidence(at.id, et.id)} style={{
                          width: "19px", height: "19px", borderRadius: "5px", flexShrink: 0, cursor: "pointer",
                          border: `2px solid ${isOn ? col : "#D1D5DB"}`,
                          background: isOn ? col : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                        }}>
                          {isOn && <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </button>
                        {/* Name */}
                        <span style={{ fontSize: "13px", fontWeight: isOn ? "700" : "500", color: isOn ? "#111827" : "#9CA3AF", flex: 1, transition: "color 0.15s" }}>
                          {et.name}
                        </span>
                        {/* Contribution input — inline when selected */}
                        {isOn ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                            <span style={{ fontSize: "11px", color: "#9CA3AF", fontWeight: "600" }}>Contribution</span>
                            <div style={{ position: "relative" }}>
                              <input className="cp-input" type="number" min="0" max="100"
                                style={{ width: "76px", boxSizing: "border-box", padding: "5px 24px 5px 10px", fontSize: "14px", fontWeight: "800", color: col, borderColor: `${col}45`, background: `${col}07`, textAlign: "right" }}
                                value={slot.contribution}
                                onChange={(e) => setContrib(at.id, et.id, e.target.value)}
                              />
                              <span style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", fontSize: "11px", fontWeight: "700", color: `${col}90`, pointerEvents: "none" }}>%</span>
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: "11px", color: "#D1D5DB", fontWeight: "500" }}>not assigned</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progress bar footer */}
              <div style={{ padding: "10px 16px", background: ok && total > 0 ? "#05966908" : total > 0 ? "#D9770908" : "#F9FAFB", borderTop: `1px solid ${ok && total > 0 ? "#05966922" : total > 0 ? "#D9770922" : "#F0F0F0"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#6B7280" }}>Evidence total</span>
                  <span style={{ fontSize: "12px", fontWeight: "800", color: ok && total > 0 ? "#059669" : total > 0 ? "#D97706" : "#9CA3AF" }}>
                    {total}% / 100%
                    {ok && total > 0 ? "" : total > 100 ? `  (${total - 100} over)` : total > 0 ? `  (need ${100 - total} more)` : ""}
                  </span>
                </div>
                <div style={{ height: "6px", borderRadius: "3px", background: "#E5E7EB", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: "3px", width: `${Math.min(100, total)}%`, background: ok && total > 0 ? "#059669" : total > 0 ? "#D97706" : "#E5E7EB", transition: "width 0.25s, background 0.2s" }} />
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ══ STEP 2 — Assessment Type Weights ══ */}
      <div>
        {/* Step header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "14px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", borderRadius: "50%", background: "#0F2645", color: "#fff", fontSize: "11px", fontWeight: "800", flexShrink: 0, marginTop: "1px" }}>2</span>
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: "800", color: "#0F2645" }}>Assessment Type Weights</h3>
            <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>Set how much each assessment type counts toward the final score. All weights must total 100%.</p>
          </div>
        </div>

        <div style={{ border: "1.5px solid #E5E7EB", borderRadius: "12px", overflow: "hidden" }}>
          {types.map((at, i) => {
            const col = BEHAVIOR_COLORS[at.behaviorType] || "#6B7280";
            const tw  = typeWeights[at.id] ?? 0;
            return (
              <div key={at.id} style={{ padding: "14px 16px", borderBottom: i < types.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                {/* Top row: dot + name + badge + input */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: col, flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827", flex: 1 }}>{at.name}</span>
                  {at.behaviorType && (
                    <span style={{ fontSize: "10px", fontWeight: "600", color: col, background: `${col}15`, padding: "2px 8px", borderRadius: "8px", textTransform: "capitalize", flexShrink: 0 }}>
                      {at.behaviorType}
                    </span>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                    <input className="cp-input" type="number" min="0" max="100"
                      style={{ width: "60px", padding: "5px 8px", fontSize: "14px", fontWeight: "800", color: col, borderColor: `${col}45`, background: `${col}07`, textAlign: "right" }}
                      value={tw}
                      onChange={(e) => {
                        const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                        setTypeWeights((prev) => ({ ...prev, [at.id]: val }));
                        setIsDirty(true);
                      }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: "700", color: col, minWidth: "14px" }}>%</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ height: "5px", borderRadius: "3px", background: "#F3F4F6", overflow: "hidden", marginLeft: "19px" }}>
                  <div style={{ height: "100%", borderRadius: "3px", width: `${Math.min(100, tw)}%`, background: col, opacity: tw > 0 ? 1 : 0.2, transition: "width 0.25s, opacity 0.2s" }} />
                </div>
              </div>
            );
          })}
          {/* Totals footer */}
          <div style={{ padding: "11px 16px", background: twBg, borderTop: `1.5px solid ${twColor}25`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#374151" }}>Total</span>
            <span style={{ fontSize: "14px", fontWeight: "800", color: twColor }}>
              {typeWeightRounded}% / 100%
              {twOk ? "" : typeWeightRounded > 100 ? `  (${typeWeightRounded - 100} over)` : `  (need ${100 - typeWeightRounded} more)`}
            </span>
          </div>
        </div>
      </div>

      {/* ══ Save ══ */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button type="button" className="cp-btn-primary" onClick={handleSave}
          disabled={!allTypesOk || !isDirty || saving || !anyAssigned}>
          {saving ? "Saving…" : "Save Configuration"}
        </button>
        {isDirty && !allTypesOk && anyAssigned && (
          <span style={{ fontSize: "12px", color: "#D97706", fontWeight: "600" }}>
            {!twOk
              ? `Type weights total ${typeWeightRounded}% — must be 100%`
              : `${types.filter((at) => !evOk(at.id)).map((at) => at.name).join(", ")} evidence doesn't total 100%`}
          </span>
        )}
      </div>

      </div>{/* end LEFT column */}

      {/* ══ RIGHT — Scoring Preview ══ */}
      <div style={{ flex: "0 0 272px", display: "flex", flexDirection: "column", gap: "10px" }}>

        {/* Header */}
        <div style={{ paddingBottom: "4px" }}>
          <h3 style={{ margin: "0 0 2px", fontSize: "13px", fontWeight: "800", color: "#0F2645" }}>Scoring Preview</h3>
          <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>Live view of your scoring structure.</p>
        </div>

        {!anyAssigned ? (
          <div style={{ padding: "28px 16px", borderRadius: "12px", background: "#F9FAFB", border: "1.5px dashed #E5E7EB", textAlign: "center" }}>
            <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: "700", color: "#9CA3AF" }}>Nothing configured yet</p>
            <p style={{ margin: 0, fontSize: "12px", color: "#C4C9D4" }}>Assign evidence types on the left to see the breakdown here.</p>
          </div>
        ) : (
          <>
            {/* Per-type evidence breakdown cards */}
            {types.map((at) => {
              const col     = BEHAVIOR_COLORS[at.behaviorType] || "#6B7280";
              const typeEvs = Object.entries(typeConfigs[at.id] || {}).filter(([, v]) => v.selected);
              if (typeEvs.length === 0) return null;
              const tw    = typeWeights[at.id] ?? 0;
              const total = typeTotals[at.id] ?? 0;
              const ok    = evOk(at.id);
              return (
                <div key={at.id} style={{ borderRadius: "10px", border: `1.5px solid ${col}25`, overflow: "hidden" }}>
                  {/* Card header */}
                  <div style={{ padding: "8px 12px", background: `${col}0e`, borderBottom: `1px solid ${col}18`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: col, flexShrink: 0 }} />
                      <span style={{ fontSize: "12px", fontWeight: "800", color: col }}>{at.name}</span>
                      {at.behaviorType && <span style={{ fontSize: "9px", fontWeight: "700", color: col, opacity: 0.7, textTransform: "capitalize" }}>{at.behaviorType}</span>}
                    </div>
                    {tw > 0 && (
                      <span style={{ fontSize: "11px", fontWeight: "700", color: col, background: `${col}15`, padding: "2px 8px", borderRadius: "20px", border: `1px solid ${col}25` }}>
                        {tw}% of final
                      </span>
                    )}
                  </div>
                  {/* Evidence rows */}
                  <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {typeEvs.map(([etId, v]) => {
                      const et = evidences.find((e) => e.id === etId);
                      return (
                        <div key={etId}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                            <span style={{ fontSize: "11px", fontWeight: "600", color: "#374151" }}>{et?.name || etId}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "12px", fontWeight: "800", color: col }}>{v.contribution}%</span>
                            </div>
                          </div>
                          <div style={{ height: "4px", borderRadius: "2px", background: "#F3F4F6", overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: "2px", width: `${Math.min(100, v.contribution)}%`, background: `${col}80`, transition: "width 0.25s" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Evidence total footer */}
                  <div style={{ padding: "6px 12px", background: "#FAFAFA", borderTop: `1px solid ${col}10`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "10px", color: "#9CA3AF", fontWeight: "600" }}>Evidence total</span>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: ok && total > 0 ? "#059669" : total > 0 ? "#D97706" : "#9CA3AF" }}>
                      {total}%{ok && total > 0 ? "" : total > 100 ? ` (${total - 100} over)` : total > 0 ? ` (${100 - total} short)` : ""}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Final formula */}
            <div style={{ borderRadius: "10px", border: `1.5px solid ${allTypesOk ? "#05966930" : "#E9EAEC"}`, overflow: "hidden", background: allTypesOk ? "#05966906" : "#FAFAFA" }}>
              <div style={{ padding: "8px 12px", borderBottom: `1px solid ${allTypesOk ? "#05966920" : "#F0F0F0"}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#374151" }}>Final Score Formula</span>
                {allTypesOk
                  ? <span style={{ fontSize: "10px", fontWeight: "700", color: "#059669", background: "#05966912", padding: "2px 8px", borderRadius: "20px", border: "1px solid #05966930" }}>Ready</span>
                  : <span style={{ fontSize: "10px", fontWeight: "600", color: "#D97706" }}>Incomplete</span>
                }
              </div>
              <div style={{ padding: "10px 12px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                {types.filter((at) => Object.values(typeConfigs[at.id] || {}).some((v) => v.selected)).map((at, i) => {
                  const col = BEHAVIOR_COLORS[at.behaviorType] || "#6B7280";
                  const tw  = typeWeights[at.id] ?? 0;
                  return (
                    <span key={at.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {i > 0 && <span style={{ fontSize: "12px", fontWeight: "700", color: "#C4C9D4" }}>+</span>}
                      <span style={{ fontSize: "11px", fontWeight: "700", color: col, background: `${col}10`, padding: "4px 10px", borderRadius: "7px", border: `1.5px solid ${col}20` }}>
                        {at.name} × {tw}%
                      </span>
                    </span>
                  );
                })}
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#C4C9D4" }}>=</span>
                <span style={{ fontSize: "12px", fontWeight: "800", color: "#0F2645", background: "#F0F4F8", padding: "4px 10px", borderRadius: "7px" }}>Final Score</span>
              </div>
            </div>
          </>
        )}

      </div>{/* end RIGHT column */}

    </div>
  );
}

/* ── AssessmentsPanel ───────────────────────────────────────────────────── */

const AF_SECTIONS = [
  { key: "types",    label: "Types" },
  { key: "evidence", label: "Evidence Type" },
  { key: "scoring",  label: "Score Evidence" },
];

function AssessmentsPanel({ curriculumId }) {
  const [sub, setSub] = useState("types");

  return (
    <div className="cp-card">
      {/* Header + sub-nav on same row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "24px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Assessment Framework</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            Define assessment types, evidence methods, and scoring weights for this curriculum.
          </p>
        </div>
        <div className="cp-arc-section-nav" style={{ marginBottom: 0, flexShrink: 0 }}>
          {AF_SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`cp-arc-section-btn${sub === s.key ? " active" : ""}`}
              onClick={() => setSub(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {sub === "types"    && <AssessmentTypesSubPanel curriculumId={curriculumId} />}
      {sub === "evidence" && <EvidenceTypesSubPanel   curriculumId={curriculumId} />}
      {sub === "scoring"  && <ScoreEvidenceSubPanel   curriculumId={curriculumId} />}
    </div>
  );
}

/* ── AgeCategoriesPanel ─────────────────────────────────────────────────── */

const ARC_PALETTE = ["#25476a", "#feb139", "#38aae1"];

// The conventional Performance Band progression. Band names are free text (any name, no cap —
// see PerformanceBandsPanel's Band Name field), but a band whose name matches one of these five
// still auto-sorts into this rank on creation regardless of creation order, so admins who do
// follow the convention end up with consistently-ordered ladders across stages without having to
// think about it.
const PERFORMANCE_BAND_SEQUENCE = ["Explorer", "Builder", "Creator", "Innovator", "Pioneer"];

// Same accent system as everything else in Progress Arc (bands, threshold track) — navy/gold/
// accent-blue — rather than a separate palette family, so Developmental Stages and Performance
// Bands read as one consistent color language instead of two differently-branded panels.
const STAGE_PALETTE = ARC_PALETTE;

// Whether two [minAge, maxAge] ranges (either bound possibly null/open-ended) overlap at all.
function agesOverlap(aMin, aMax, bMin, bMax) {
  const lowOk = aMin == null || bMax == null || aMin <= bMax;
  const highOk = aMax == null || bMin == null || aMax >= bMin;
  return lowOk && highOk;
}

// maybeAutoIssueDiagnostic (learner.service.js) matches a learner's age against a curriculum's
// stages in creation order and stops at the FIRST match — so when two stages' age ranges
// overlap, whichever was created earlier always wins for any learner in that overlap, silently.
// This surfaces that instead of leaving it invisible: for each stage, every other stage (in
// list order, which is creation order) whose range overlaps it and that appears EARLIER in the
// list is the one actually winning the overlap.
function findOverlaps(cats) {
  const warnings = new Map();
  cats.forEach((cat, i) => {
    if (cat.minAge == null && cat.maxAge == null) return;
    const shadowedBy = cats.slice(0, i).find((earlier) => agesOverlap(cat.minAge, cat.maxAge, earlier.minAge, earlier.maxAge));
    if (shadowedBy) warnings.set(cat.id, shadowedBy.name);
  });
  return warnings;
}

function AgeCategoriesPanel({ curriculumId }) {
  const { data: cats = [], isLoading, isError } = useAgeCategories(curriculumId);
  const { mutate: create, isPending: creating } = useCreateAgeCategory(curriculumId);
  const { mutate: update, isPending: updating } = useUpdateAgeCategory(curriculumId);
  const { mutate: remove, isPending: deleting } = useDeleteAgeCategory(curriculumId);

  const [mode,       setMode]       = useState("list");
  const [editTarget, setEditTarget] = useState(null);
  const [name,       setName]       = useState("");
  const [desc,       setDesc]       = useState("");
  const [minAge,     setMinAge]     = useState("");
  const [maxAge,     setMaxAge]     = useState("");
  const nameRef = useRef(null);

  useEffect(() => { if (mode !== "list") nameRef.current?.focus(); }, [mode]);

  function openAdd() {
    setEditTarget(null); setName(""); setDesc(""); setMinAge(""); setMaxAge("");
    setMode("add");
  }
  function openEdit(c) {
    setEditTarget(c); setName(c.name); setDesc(c.description || "");
    setMinAge(c.minAge ?? ""); setMaxAge(c.maxAge ?? "");
    setMode("edit");
  }
  function cancel() { setMode("list"); setEditTarget(null); }

  const ageRangeInvalid = minAge !== "" && maxAge !== "" && Number(maxAge) < Number(minAge);

  function submit() {
    if (!name.trim() || ageRangeInvalid) return;
    const data = {
      name: name.trim(),
      description: desc.trim(),
      minAge: minAge === "" ? null : Number(minAge),
      maxAge: maxAge === "" ? null : Number(maxAge),
    };
    if (mode === "edit") {
      // diagnosticAssessmentId is deliberately omitted — the update endpoint only touches
      // fields present in the request body (see onlySentKeys), so any legacy value already on
      // an existing stage is left exactly as-is, neither wiped nor re-shown.
      update({ id: editTarget.id, data }, { onSuccess: cancel });
    } else {
      create(data, { onSuccess: cancel });
    }
  }

  // Draft overlap check for the open form — compares the in-progress min/max against every
  // OTHER existing stage (excluding the one being edited), regardless of list order, since the
  // form doesn't yet know where a new stage will land in creation order.
  const draftMin = minAge === "" ? null : Number(minAge);
  const draftMax = maxAge === "" ? null : Number(maxAge);
  const draftOverlapsWith = !ageRangeInvalid && (draftMin != null || draftMax != null)
    ? cats.filter((c) => c.id !== editTarget?.id && agesOverlap(draftMin, draftMax, c.minAge, c.maxAge))
    : [];

  const overlapWarnings = findOverlaps(cats);
  const colorByStageId = new Map(cats.map((c, idx) => [c.id, STAGE_PALETTE[idx % STAGE_PALETTE.length]]));

  if (isLoading) return <div className="cp-spinner" style={{ marginTop: "48px" }} />;
  if (isError) return <ErrorNotice message="Couldn't load Developmental Stages — try refreshing the page." />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Developmental Stages</h3>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {cats.length === 0 ? "Define the developmental stages for this curriculum" : `${cats.length} stage${cats.length !== 1 ? "s" : ""} defined`}
          </p>
        </div>
        {mode === "list" && (
          <button type="button" className="cp-btn-primary" onClick={openAdd}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            Add Stage
          </button>
        )}
      </div>

      {mode !== "list" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,38,69,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "520px", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
        <div className="cp-comp-form-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0F2645" }}>{mode === "edit" ? "Edit Stage" : "New Developmental Stage"}</h3>
            </div>
            <button type="button" className="cp-icon-btn" onClick={cancel}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label className="cp-field-label">Name <span className="cp-required">*</span></label>
              <input ref={nameRef} className="cp-input" style={{ width: "100%", boxSizing: "border-box" }}
                placeholder="e.g. Early Childhood, Primary, Secondary…"
                value={name} maxLength={100}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
              />
              <div className="cp-char-count">{name.length} / 100</div>
            </div>
            <div>
              <label className="cp-field-label">Description <span className="cp-optional">(optional)</span></label>
              <textarea className="cp-textarea" rows={2}
                placeholder="Describe the characteristics or focus of this stage…"
                value={desc} maxLength={500}
                onChange={(e) => setDesc(e.target.value)}
              />
              <div className="cp-char-count">{desc.length} / 500</div>
            </div>
            <div>
              <label className="cp-field-label">Age Range <span className="cp-optional">(optional)</span></label>
              <p style={{ margin: "2px 0 8px", fontSize: "11px", color: "#9CA3AF" }}>
                A learner whose age falls in this range is auto-placed at this stage. Leave blank to match every age.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div className="cp-comp-eval-input-wrap" style={{ width: "90px" }}>
                  <input
                    type="number" min="0" max="120" className="cp-comp-config-input"
                    placeholder="Min" value={minAge}
                    onChange={(e) => setMinAge(e.target.value)}
                  />
                </div>
                <span style={{ color: "#9CA3AF", fontSize: "13px" }}>to</span>
                <div className="cp-comp-eval-input-wrap" style={{ width: "90px" }}>
                  <input
                    type="number" min="0" max="120" className="cp-comp-config-input"
                    placeholder="Max" value={maxAge}
                    onChange={(e) => setMaxAge(e.target.value)}
                  />
                </div>
                <span style={{ color: "#9CA3AF", fontSize: "12px" }}>years</span>
              </div>
              {ageRangeInvalid && (
                <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#DC2626" }}>Max age must be greater than or equal to min age.</p>
              )}
              {!ageRangeInvalid && draftOverlapsWith.length > 0 && (
                <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#D97706" }}>
                  Overlaps {draftOverlapsWith.map((c) => c.name).join(", ")} — a learner whose age falls in
                  both ranges will be placed wherever the two stages' creation order puts them first, not
                  necessarily this one.
                </p>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "18px" }}>
            <button type="button" className="cp-btn-primary" onClick={submit} disabled={(creating || updating) || !name.trim() || ageRangeInvalid}>
              {creating || updating ? "Saving…" : mode === "edit" ? "Save Changes" : "Add Stage"}
            </button>
            <button type="button" className="cp-btn-secondary" onClick={cancel}>Cancel</button>
          </div>
        </div>
          </div>
        </div>
      )}

      {mode === "list" && (cats.length === 0 ? (
        <div className="cp-empty">
          <div style={{ fontSize: "36px", color: "#9CA3AF", display: "flex", justifyContent: "center", marginBottom: "10px" }}><ChildCareIcon fontSize="inherit" /></div>
          <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No developmental stages yet</p>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#9CA3AF", maxWidth: "300px", marginInline: "auto" }}>
            Create stages to organize the progress arc for different learner developmental phases.
          </p>
          <button type="button" className="cp-btn-ghost" onClick={openAdd}>+ Add First Stage</button>
        </div>
      ) : (
        <div className="cp-comp-grid">
          {cats.map((cat) => {
            const color     = colorByStageId.get(cat.id);
            const isEditing = mode === "edit" && editTarget?.id === cat.id;
            const initial   = cat.name.charAt(0).toUpperCase();
            const ageLabel  = cat.minAge != null && cat.maxAge != null
              ? `${cat.minAge}–${cat.maxAge} yrs`
              : cat.minAge != null
              ? `${cat.minAge}+ yrs`
              : cat.maxAge != null
              ? `up to ${cat.maxAge} yrs`
              : null;
            return (
              <div key={cat.id} className={`cp-comp-card${isEditing ? " cp-comp-card--editing" : ""}`}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "10px" }}>
                  <div style={{
                    width: "42px", height: "42px", borderRadius: "12px", flexShrink: 0,
                    backgroundColor: `${color}15`, border: `2px solid ${color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "17px", fontWeight: "800", color,
                  }}>
                    {initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827", lineHeight: 1.35 }}>{cat.name}</p>
                    {ageLabel ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "5px",
                        padding: "2px 8px", borderRadius: "20px",
                        fontSize: "10px", fontWeight: "700", backgroundColor: `${color}12`, color, border: `1px solid ${color}28`,
                      }}
                        title="Learners in this age range are auto-placed at this stage"
                      >
                        <ChildCareIcon style={{ fontSize: "12px" }} />
                        {ageLabel}
                      </span>
                    ) : (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "5px",
                        padding: "2px 8px", borderRadius: "20px",
                        fontSize: "10px", fontWeight: "700", color: "#D97706", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A",
                      }}>
                        <WarningAmberIcon style={{ fontSize: "12px" }} /> No age range set
                      </span>
                    )}
                  </div>
                  <CardKebab onEdit={() => openEdit(cat)} onDelete={() => remove(cat.id)} disabled={deleting} itemLabel={cat.name} itemType="developmental stage" />
                </div>

                {overlapWarnings.has(cat.id) && (
                  <p style={{ margin: "0 0 8px", fontSize: "10.5px", fontWeight: "700", color: "#D97706", display: "flex", alignItems: "flex-start", gap: 4 }}>
                    <WarningAmberIcon style={{ fontSize: "13px", flexShrink: 0, marginTop: "1px" }} />
                    Overlaps {overlapWarnings.get(cat.id)} — that stage wins for learners in the overlap
                  </p>
                )}

                <div style={{ flex: 1 }}>
                  {cat.description ? (
                    <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: "1.65", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {cat.description}
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>No description</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ── CompetencyLinkDropdown ─────────────────────────────────────────────────
 * Picks from the existing global competency catalog only — no inline "create
 * new competency" shortcut here (unlike AddCompetencyDropdown above), since a
 * band should only ever reference competencies already defined in Settings. */

function CompetencyLinkDropdown({ available, onAdd }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
    else setQuery("");
  }, [open]);

  const trimmed = query.trim();
  const filtered = trimmed
    ? available.filter((c) => c.name.toLowerCase().includes(trimmed.toLowerCase()))
    : available;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="cp-btn-secondary" onClick={() => setOpen((v) => !v)} style={{ width: "100%", justifyContent: "space-between", display: "flex", alignItems: "center" }}>
        <span>Choose a competency…</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="cp-card-menu" style={{ width: "100%", maxHeight: "280px", overflow: "hidden", display: "flex", flexDirection: "column", left: 0, right: "auto", padding: 0 }}>
          <div style={{ position: "relative", flexShrink: 0, borderBottom: "1px solid #F0F2F5" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search competencies…"
              style={{
                width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 34px", border: "none",
                fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none", color: "#111827", background: "#fff",
              }}
            />
          </div>
          <div style={{ overflowY: "auto", padding: "6px" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "22px 12px", textAlign: "center" }}>
                <div style={{ fontSize: "22px", marginBottom: "4px" }}>{available.length === 0 ? <CheckCircleIcon fontSize="medium" /> : <SearchIcon fontSize="medium" />}</div>
                <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>
                  {available.length === 0 ? "All available competencies are already linked." : "No matches found."}
                </p>
              </div>
            )}
            {filtered.map((comp) => (
              <button
                key={comp.id}
                type="button"
                className="cp-card-menu-item"
                onClick={() => { onAdd(comp.id); setOpen(false); }}
              >
                {comp.name}
                <span style={{ marginLeft: "8px", fontSize: "10.5px", fontWeight: "700", color: "#9CA3AF" }}>
                  {comp.indicators.length} indicator{comp.indicators.length !== 1 ? "s" : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── PerformanceBandsPanel ───────────────────────────────────────────────── */

// A percentage weight is a proportion, not an arbitrary number — a slider + live fill-bar lets
// an admin see the share at a glance while dragging, rather than reading a bare digit and
// imagining what "30%" looks like. The number field stays alongside it for precise entry/typing,
// kept in sync both ways. Same blur/commit-on-release save contract as before — dragging the
// slider doesn't fire a save per pixel, only on release, so this is no chattier than the old
// plain input was.
function BandIndicatorContributionRow({ ind, percentage, color, onSave }) {
  const [value, setValue] = useState(percentage ?? 0);
  const [saved, setSaved] = useState(false);
  const savedTimeout = useRef(null);

  useEffect(() => { setValue(percentage ?? 0); }, [percentage]);
  useEffect(() => () => clearTimeout(savedTimeout.current), []);

  const commit = (raw) => {
    const v = Math.min(100, Math.max(0, Number(raw) || 0));
    setValue(v);
    if (v !== (percentage ?? 0)) {
      onSave(v);
      setSaved(true);
      clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setSaved(false), 1500);
    }
  };

  return (
    <div className="cp-indicator-row" style={{ alignItems: "flex-start", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", width: "100%" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block" }}>
            {ind.name}
            {ind.marksPossible > 0 && (
              <span style={{ marginLeft: "8px", fontSize: "10.5px", fontWeight: 700, color: "#9CA3AF" }}>
                {ind.marksPossible} pt{ind.marksPossible !== 1 ? "s" : ""} possible
              </span>
            )}
          </span>
          {ind.description && (
            <span style={{ display: "block", marginTop: "2px", fontSize: "11px", color: "#9CA3AF" }}>{ind.description}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          {saved && (
            <span style={{ flex: "none", fontSize: "10px", fontWeight: 700, color: "#059669", display: "flex", alignItems: "center", gap: "3px" }}>
              <CheckIcon style={{ fontSize: "12px" }} /> Saved
            </span>
          )}
          <div className="cp-comp-eval-input-wrap" style={{ width: "58px" }}>
            <input
              type="number" min="0" max="100" className="cp-comp-config-input"
              style={{ padding: "5px 22px 5px 8px", fontSize: "11.5px" }}
              value={value} onChange={(e) => setValue(e.target.value)}
              onBlur={(e) => commit(e.target.value)}
            />
            <span className="cp-comp-eval-suffix" style={{ right: "6px", fontSize: "10px" }}>%</span>
          </div>
        </div>
      </div>
      <input
        type="range" min="0" max="100" step="1" value={Math.min(100, Math.max(0, Number(value) || 0))}
        onChange={(e) => setValue(e.target.value)}
        onMouseUp={(e) => commit(e.target.value)}
        onTouchEnd={(e) => commit(e.target.value)}
        onKeyUp={(e) => commit(e.target.value)}
        style={{
          width: "100%", height: "5px", borderRadius: "3px", appearance: "none", cursor: "pointer",
          background: `linear-gradient(to right, ${color} ${value}%, #E5E7EB ${value}%)`,
          accentColor: color,
        }}
      />
    </div>
  );
}

// One competency imported into a band — its indicators are whichever ones are actually
// tagged on a question/rubric criterion/observation item somewhere in this curriculum's
// attached assessments (see CompetencyService.getPopulatedIndicators), listed automatically
// as soon as they're populated — no manual add step. Each gets a % contribution scoped to
// this band only — a share of the BAND's 100% (not this competency's own 100%) — when a
// band draws on more than one competency, all of their indicators' percentages share that
// same 100% budget between them.
function BandCompetencyBlock({ comp, color, populatedIndicators, percentageByIndicator, onSaveContribution }) {
  const [open, setOpen] = useState(false);

  // How much of this BAND's 100% budget this one competency currently accounts for — the sum of
  // every one of its indicator % contributions. A band can draw on several competencies that all
  // share the same 100%, so this per-competency subtotal shows how that 100% is split between
  // them (the band card's own "Indicators: X%" chip is the sum of these across every competency).
  // Only the indicators actually listed here count — a stale contribution for an indicator no
  // longer populated is ignored, same as Engine 4 does.
  const competencyTotal = populatedIndicators.reduce(
    (s, ind) => s + (Number(percentageByIndicator[ind.id]) || 0),
    0
  );
  const totalRounded = Math.round(competencyTotal * 10) / 10;

  return (
    <div style={{ marginTop: "10px" }}>
      <button type="button" className="cp-indicators-toggle" onClick={() => setOpen((v) => !v)} style={{ marginTop: 0 }}>
        <span style={{ color }}>{comp.name}</span>
        <span style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <span
            className="cp-indicator-count"
            style={{
              background: totalRounded > 0 ? `${color}14` : "#F3F4F6",
              color: totalRounded > 0 ? color : "#9CA3AF",
            }}
            title={`${comp.name} contributes ${totalRounded}% toward this band — the sum of its indicator weights below. Every competency on the band shares one 100% budget.`}
          >
            {totalRounded}%
          </span>
          <svg className={`cp-indicators-chevron${open ? " open" : ""}`} width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="cp-indicators-body">
          {populatedIndicators.length === 0 ? (
            <p style={{ margin: 0, fontSize: "11.5px", color: "#D1D5DB", fontStyle: "italic" }}>
              This competency has no indicators defined at all yet — add some in Settings → Competencies first.
            </p>
          ) : (
            populatedIndicators.map((ind) => (
              <BandIndicatorContributionRow
                key={ind.id}
                ind={ind}
                percentage={percentageByIndicator[ind.id]}
                color={color}
                onSave={(percentage) => onSaveContribution(ind.id, percentage)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── CombinedThresholdTrack ─────────────────────────────────────────────────
 * One single horizontal ladder for the SELECTED stage's own bands, in ladder order — every stage
 * now carries the full canonical band set (Explorer..Pioneer), so flattening every stage's bands
 * into one line would be an unreadable 25+-node horizontal scroll; the dropdown above already
 * picks which one stage to look at, and this track mirrors that same choice. Each node shows its
 * advancement threshold directly (not an ordinal), with the band name below it. One consistent
 * accent color throughout (matching ARC_PALETTE's navy, used system-wide) rather than a
 * first/middle/last color progression — the position in the ladder is already conveyed by the
 * node's left-to-right order, so recoloring each one doesn't add information, just noise. Every
 * node is clickable — jumps down to that band's own card in the list below (id="band-card-<id>"),
 * a quick way to reach a specific band without scrolling past every card before it. Deliberately
 * NOT opening the edit modal on click — that's what the card's own Edit action is for; a click
 * here is navigation, not an edit action. */

const TRACK_COLOR = "#25476a"; // navy — matches ARC_PALETTE / T.accent, used for every node alike

function CombinedThresholdTrack({ bands }) {
  if (bands.length === 0) return null;

  function scrollToBand(bandId) {
    document.getElementById(`band-card-${bandId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 0,
        padding: "16px 20px", background: "#F8FAFC", border: "1px solid #EEF1F5",
        borderRadius: "14px", overflowX: "auto",
      }}>
        {bands.map((band, idx) => {
          const isLast = idx === bands.length - 1;
          return (
            <div key={band.id} style={{ display: "flex", alignItems: "flex-start", flex: isLast ? "0 0 auto" : "1 1 0", minWidth: "96px" }}>
              <button
                type="button"
                onClick={() => scrollToBand(band.id)}
                title={`Jump to ${band.name}`}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", flexShrink: 0,
                  background: "none", border: "none", padding: 0, cursor: "pointer",
                }}
              >
                <div style={{
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: `${TRACK_COLOR}18`,
                  border: `2px solid ${TRACK_COLOR}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "13px", fontWeight: "800", color: TRACK_COLOR,
                }}>
                  {band.advancementThreshold ?? 0}
                </div>
                <span style={{ fontSize: "12px", fontWeight: "800", color: TRACK_COLOR, whiteSpace: "nowrap" }}>{band.name}</span>
              </button>
              {!isLast && (
                <div style={{ flex: 1, height: "2px", marginTop: "20px", background: TRACK_COLOR }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── OrphanedBandsBanner ─────────────────────────────────────────────────
 * Legacy bands from before Developmental Stages existed (a multi- or zero-stage curriculum the
 * migration couldn't safely auto-assign — see the backfill migration's comment) are invisible in
 * the normal per-stage view, since every read is now filtered by ageCategoryId. Rather than
 * silently dropping them, this surfaces them with a manual per-band stage-assignment action. */

function OrphanedBandsBanner({ bands, stages, onAssign, updating }) {
  const [open, setOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState(null);

  return (
    <div style={{ marginBottom: "16px", border: "1.5px solid #FDE68A", background: "#FFFBEB", borderRadius: "12px", padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#92400E" }}>
          {bands.length} legacy performance band{bands.length !== 1 ? "s" : ""} from before Developmental Stages existed{" "}
          {bands.length !== 1 ? "have" : "has"} no stage assigned and {bands.length !== 1 ? "aren't" : "isn't"} shown above.
        </span>
        <button type="button" className="cp-btn-ghost" style={{ flexShrink: 0 }} onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "View"}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {bands.map((band) => (
            <div key={band.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", background: "#fff", border: "1px solid #FDE68A", borderRadius: "8px", padding: "8px 10px" }}>
              <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#111827" }}>{band.name}</span>
              {pickerFor === band.id ? (
                <select
                  className="cp-input"
                  style={{ maxWidth: "220px" }}
                  autoFocus
                  disabled={updating}
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) { onAssign(band, e.target.value); setPickerFor(null); } }}
                  onBlur={() => setPickerFor(null)}
                >
                  <option value="" disabled>Choose a stage…</option>
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <button type="button" className="cp-btn-secondary" onClick={() => setPickerFor(band.id)} disabled={stages.length === 0}>
                  Assign to stage
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PerformanceBandsPanel({ curriculumId }) {
  // Each Developmental Stage now has its own independent Progress Arc ladder — this panel
  // always edits exactly one stage's bands at a time, picked via the dropdown below.
  const { data: stages = [], isLoading: stagesLoading, isError: stagesError } = useAgeCategories(curriculumId);
  const [selectedStageId, setSelectedStageId] = useState(null);

  // Default to the first stage once stages load, and re-default if the previously-selected
  // stage disappeared (e.g. deleted from the Developmental Stages tab).
  useEffect(() => {
    if (stages.length === 0) { setSelectedStageId(null); return; }
    if (!stages.some((s) => s.id === selectedStageId)) setSelectedStageId(stages[0].id);
  }, [stages, selectedStageId]);

  // Learning Journey reuses this same model for per-Learning-Area placement thresholds
  // (learningAreaId set) — exclude those here (alongside the stage filter) so this panel only
  // ever shows Progress Arc bands.
  const { data: allBands = [], isLoading, isError } = usePerformanceBands(curriculumId);
  const progressArcBands = allBands.filter((b) => !b.learningAreaId);
  const bands = !selectedStageId ? [] : progressArcBands
    .filter((b) => b.ageCategoryId === selectedStageId)
    .sort((a, b) => a.order - b.order);
  const orphanedBands = progressArcBands.filter((b) => !b.ageCategoryId);

  const { mutate: create, isPending: creating }    = useCreatePerformanceBand(curriculumId);
  const { mutate: update, isPending: updating }    = useUpdatePerformanceBand(curriculumId);
  const { mutate: remove, isPending: deleting }    = useDeletePerformanceBand(curriculumId);
  const { mutate: reorder }                        = useReorderPerformanceBands(curriculumId);
  const { mutate: duplicateToNext, isPending: duplicating } = useDuplicatePerformanceBandToNext(curriculumId);
  const { data: adoptedCompetencies = [] }         = useCompetencies(curriculumId);
  const { data: populatedIndicatorGroups = [] }    = usePopulatedIndicators(curriculumId);
  const populatedByCompetencyId = new Map(populatedIndicatorGroups.map((g) => [g.competencyId, g.indicators]));
  const { data: bandProgressList = [] }            = useBandProgress(curriculumId, selectedStageId);
  const progressByBandId = new Map(bandProgressList.map((p) => [p.bandId, p]));

  // Default: only competencies actually IN USE in this curriculum — tagged on at least one
  // question/rubric criterion/observation item of an assessment this curriculum's courses
  // attach (see populatedIndicatorGroups, computed live by getPopulatedIndicators). Being
  // merely "adopted" (added on the Competencies tab) or having indicators defined in Settings
  // isn't enough on its own for this default list; a competency with zero tagged assessment
  // content has nothing real to score a band against YET, so it's excluded until it does.
  const usedCompetencyIds = new Set(populatedIndicatorGroups.map((g) => g.competencyId));
  const linkableCompetencies = adoptedCompetencies.filter((c) => usedCompetencyIds.has(c.id));

  // Opt-in escape hatch: the ENTIRE global catalog (Settings → Competencies), regardless of
  // whether this curriculum has adopted it or anything has been tagged yet — for an admin who
  // wants to pre-configure a band's weights/threshold ahead of real assessment content existing.
  // Such a competency's indicators come from the global catalog (see BandCompetencyBlock's own
  // fallback below, since populatedIndicatorGroups has no entry for it yet) and score 0%/nothing
  // for every learner until a real assessment actually tags them — this doesn't change how
  // Engine 4 computes completion, it just lets the config exist before the data does.
  const { data: allGlobalCompetencies = [] } = useGlobalCompetencies();
  const [showAllCompetencies, setShowAllCompetencies] = useState(false);
  const pickableCompetencies = showAllCompetencies ? allGlobalCompetencies : linkableCompetencies;

  // Resolve a band's linked competency by id from whichever source actually has it — a
  // curriculum-adopted one first (carries the curriculum's own indicator set), falling back to
  // the raw global catalog entry for a competency added via "all competencies" that this
  // curriculum hasn't formally adopted.
  const competencyById = new Map([
    ...allGlobalCompetencies.map((c) => [c.id, c]),
    ...adoptedCompetencies.map((c) => [c.id, c]),
  ]);

  const [mode,          setMode]          = useState("list");
  const [editTarget,    setEdit]          = useState(null);
  const [name,          setName]          = useState("");
  const [desc,          setDesc]          = useState("");
  const [competencyIds, setCompetencyIds] = useState([]);
  // Advancement bar is a range: `thresholdMin` is a display-only "on track" floor,
  // `threshold` is the max — the bar that actually advances the learner to the next band.
  const [thresholdMin,  setThresholdMin]  = useState(0);
  const [threshold,     setThreshold]     = useState(0);
  const nameRef    = useRef(null);

  useEffect(() => { if (mode !== "list") nameRef.current?.focus(); }, [mode]);

  function openAdd()  { setEdit(null); setName(""); setDesc(""); setCompetencyIds([]); setThresholdMin(0); setThreshold(0); setMode("add"); }
  function openEdit(b){ setEdit(b); setName(b.name); setDesc(b.description || ""); setCompetencyIds([...(b.competencyIds || [])]); setThresholdMin(b.advancementMin ?? 0); setThreshold(b.advancementThreshold ?? 0); setMode("edit"); }
  function cancel()   { setMode("list"); setEdit(null); }

  function toggleCompetency(id) {
    setCompetencyIds((prev) => prev.includes(id) ? prev.filter((cId) => cId !== id) : [...prev, id]);
  }

  function submit() {
    if (!name.trim() || !selectedStageId) return;
    const clampedMax = Math.min(100, Math.max(0, Number(threshold) || 0));
    // The "on track" floor can't sit above the advancement max — clamp it down if it does.
    const clampedMin = Math.min(clampedMax || 100, Math.min(100, Math.max(0, Number(thresholdMin) || 0)));
    const data = {
      name: name.trim(), description: desc.trim(), competencyIds,
      advancementMin: clampedMin,
      advancementThreshold: clampedMax,
      ageCategoryId: selectedStageId,
    };
    // A band's name fixes its position in the ladder (Explorer=1, Builder=2, …) regardless of
    // the order it was created in — this keeps every stage's ladder in the same canonical shape.
    if (mode === "add") {
      const rank = PERFORMANCE_BAND_SEQUENCE.indexOf(name.trim());
      if (rank !== -1) data.order = rank + 1;
    }
    if (mode === "edit") {
      // The update endpoint's Zod schema defaults any field missing from the request body
      // (e.g. minScore/maxScore aren't edited by this form) rather than leaving it
      // untouched — carry the rest of the band's current fields through so they survive.
      data.minScore  = editTarget.minScore;
      data.maxScore  = editTarget.maxScore;
      // Dropping a competency from the band also drops any % already assigned to its
      // indicators — nothing to score against a competency the band no longer uses.
      data.indicatorContributions = (editTarget.indicatorContributions || []).filter((p) => competencyIds.includes(p.competencyId));
      update({ id: editTarget.id, data }, { onSuccess: cancel });
    } else {
      create(data, { onSuccess: cancel });
    }
  }

  // The update endpoint validates with a Zod .partial() schema whose fields still carry
  // .default(...) — a field entirely absent from the request body gets silently defaulted
  // (e.g. competencyIds -> [], ageCategoryId -> null) rather than left untouched, so a truly
  // partial payload here would wipe every other field on this band (and, for ageCategoryId,
  // fail the "must have a stage" validation entirely). Send the full editable record back.
  function persistIndicatorContributions(band, next) {
    update({
      id: band.id,
      data: {
        name: band.name,
        description: band.description,
        minScore: band.minScore,
        maxScore: band.maxScore,
        competencyIds: band.competencyIds,
        advancementMin: band.advancementMin,
        advancementThreshold: band.advancementThreshold,
        ageCategoryId: band.ageCategoryId,
        indicatorContributions: next,
      },
    });
  }

  function saveIndicatorContribution(band, competencyId, indicatorId, percentage) {
    const filtered = (band.indicatorContributions || []).filter(
      (p) => !(p.competencyId === competencyId && p.indicatorId === indicatorId)
    );
    const next = percentage > 0 ? [...filtered, { competencyId, indicatorId, percentage }] : filtered;
    persistIndicatorContributions(band, next);
  }

  // A competencyId this band references was deleted from the global catalog since — strip
  // it (and any indicator % it had) from this band rather than leaving a dead reference.
  function removeDeadCompetency(band, competencyId) {
    update({
      id: band.id,
      data: {
        name: band.name,
        description: band.description,
        minScore: band.minScore,
        maxScore: band.maxScore,
        advancementMin: band.advancementMin,
        advancementThreshold: band.advancementThreshold,
        ageCategoryId: band.ageCategoryId,
        competencyIds: (band.competencyIds || []).filter((id) => id !== competencyId),
        indicatorContributions: (band.indicatorContributions || []).filter((p) => p.competencyId !== competencyId),
      },
    });
  }

  // A legacy band from before Developmental Stages existed — assign it to a stage so it
  // rejoins that stage's ladder, rather than sitting invisible/orphaned forever.
  function assignOrphanToStage(band, ageCategoryId) {
    update({
      id: band.id,
      data: {
        name: band.name,
        description: band.description,
        minScore: band.minScore,
        maxScore: band.maxScore,
        advancementMin: band.advancementMin,
        advancementThreshold: band.advancementThreshold,
        competencyIds: band.competencyIds,
        indicatorContributions: band.indicatorContributions,
        ageCategoryId,
      },
    });
  }

  function moveUp(idx) {
    if (idx === 0) return;
    const ids = bands.map((b) => b.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    reorder({ ageCategoryId: selectedStageId, orderedIds: ids });
  }

  function moveDown(idx) {
    if (idx === bands.length - 1) return;
    const ids = bands.map((b) => b.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    reorder({ ageCategoryId: selectedStageId, orderedIds: ids });
  }

  if (stagesLoading || isLoading) return <div className="cp-spinner" style={{ marginTop: "48px" }} />;
  if (stagesError || isError) return <ErrorNotice message="Couldn't load Performance Bands — try refreshing the page." />;

  return (
    <div>
      {orphanedBands.length > 0 && (
        <OrphanedBandsBanner bands={orphanedBands} stages={stages} onAssign={assignOrphanToStage} updating={updating} />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Performance Bands</h3>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {stages.length === 0
              ? "Add a Developmental Stage first, then build its performance ladder here"
              : bands.length === 0
              ? "Define this stage's performance ladder"
              : `${bands.length} band${bands.length !== 1 ? "s" : ""} in this stage's ladder · ordered from lowest to highest`}
          </p>
        </div>
        {mode === "list" && stages.length > 0 && (
          <button type="button" className="cp-btn-primary" onClick={openAdd}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
            Add Band
          </button>
        )}
      </div>

      {/* Stage picker — the primary control driving everything below it on this panel, so it
          carries a persistent navy tint (not just on focus like a plain cp-input) to read as
          the featured selector rather than an ordinary form field. */}
      <div style={{ marginBottom: "20px" }}>
        <label className="cp-field-label" style={{ textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.05em", color: "#25476a" }}>
          Developmental Stage
        </label>
        {stages.length === 0 ? (
          <p style={{ margin: "6px 0 0", fontSize: "12.5px", color: "#9CA3AF" }}>
            No Developmental Stages defined yet — add one on the Developmental Stages tab first.
          </p>
        ) : (
          <div style={{ position: "relative", maxWidth: "320px", marginTop: "6px" }}>
            <select
              value={selectedStageId || ""}
              onChange={(e) => setSelectedStageId(e.target.value)}
              style={{
                width: "100%", boxSizing: "border-box", appearance: "none",
                padding: "9px 36px 9px 14px", borderRadius: "10px",
                border: "1.5px solid #a8d5ee", background: "#e8f5fb",
                color: "#0A3880", fontSize: "13.5px", fontWeight: "700",
                fontFamily: "Inter, sans-serif", cursor: "pointer", outline: "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#25476a"; e.target.style.boxShadow = "0 0 0 3px rgba(37,71,106,0.12)"; }}
              onBlur={(e) => { e.target.style.borderColor = "#a8d5ee"; e.target.style.boxShadow = "none"; }}
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.minAge != null || s.maxAge != null ? ` · Ages ${s.minAge ?? "0"}-${s.maxAge ?? "∞"}` : ""}
                </option>
              ))}
            </select>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#25476a" }}>
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>

      <CombinedThresholdTrack bands={bands} />

      {/* Form */}
      {mode !== "list" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,38,69,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "520px", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
        <div className="cp-comp-form-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0F2645" }}>
              {mode === "edit" ? "Edit Band" : "New Performance Band"}
            </h3>
            <button type="button" className="cp-icon-btn" onClick={cancel}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Name — free text; a band whose name matches the canonical Explorer→Pioneer
                sequence still auto-sorts into that rank on creation (see submit()) regardless
                of what order it was created in, but any name is allowed and there's no cap on
                how many bands a stage can have. */}
            <div>
              <label className="cp-field-label">Band Name <span className="cp-required">*</span></label>
              <input ref={nameRef} className="cp-input" style={{ width: "100%", boxSizing: "border-box" }}
                placeholder="e.g. Explorer, Builder, Creator, Innovator, Pioneer…"
                value={name} maxLength={100}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
              />
              <div className="cp-char-count">{name.length} / 100</div>
            </div>

            {/* Description */}
            <div>
              <label className="cp-field-label">Description <span className="cp-optional">(optional)</span></label>
              <textarea className="cp-textarea" rows={2}
                placeholder="Briefly describe what this performance band represents…"
                value={desc} maxLength={1000}
                onChange={(e) => setDesc(e.target.value)}
              />
              <div className="cp-char-count">{desc.length} / 1000</div>
            </div>

            {/* Advancement threshold range */}
            <div>
              <label className="cp-field-label">Threshold to Advance <span className="cp-optional">(optional)</span></label>
              <p style={{ margin: "2px 0 8px", fontSize: "11px", color: "#9CA3AF" }}>
                The % of this band's indicator contributions a learner completes. <strong>Minimum</strong> marks them as "on track" toward the next band; reaching the <strong>maximum</strong> is what actually moves them to the next band. Different bands can use different ranges.
              </p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
                <div>
                  <span style={{ display: "block", fontSize: "10.5px", fontWeight: 700, color: "#9CA3AF", marginBottom: "3px" }}>MINIMUM (on track)</span>
                  <div className="cp-comp-eval-input-wrap" style={{ width: "100px" }}>
                    <input
                      type="number" min="0" max="100" className="cp-comp-config-input"
                      value={thresholdMin} onChange={(e) => setThresholdMin(e.target.value)}
                    />
                    <span className="cp-comp-eval-suffix">%</span>
                  </div>
                </div>
                <span style={{ paddingBottom: "9px", color: "#D1D5DB", fontWeight: 700 }}>–</span>
                <div>
                  <span style={{ display: "block", fontSize: "10.5px", fontWeight: 700, color: "#9CA3AF", marginBottom: "3px" }}>MAXIMUM (advances)</span>
                  <div className="cp-comp-eval-input-wrap" style={{ width: "100px" }}>
                    <input
                      type="number" min="0" max="100" className="cp-comp-config-input"
                      value={threshold} onChange={(e) => setThreshold(e.target.value)}
                    />
                    <span className="cp-comp-eval-suffix">%</span>
                  </div>
                </div>
              </div>
              {Number(thresholdMin) > 0 && Number(threshold) > 0 && Number(thresholdMin) > Number(threshold) && (
                <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#DC2626", fontWeight: 600 }}>
                  Minimum can't be higher than maximum — it'll be clamped down on save.
                </p>
              )}
            </div>

            {/* Linked Competencies */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <label className="cp-field-label" style={{ marginBottom: 0 }}>Competencies <span className="cp-optional">(optional)</span></label>
                <button
                  type="button"
                  onClick={() => setShowAllCompetencies((v) => !v)}
                  style={{
                    fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "20px",
                    border: `1px solid ${showAllCompetencies ? "#a8d5ee" : "#E5E7EB"}`,
                    background: showAllCompetencies ? "#e8f5fb" : "#fff",
                    color: showAllCompetencies ? "#25476a" : "#6B7280",
                    cursor: "pointer",
                  }}
                >
                  {showAllCompetencies ? "Showing all competencies" : "Browse all competencies"}
                </button>
              </div>
              <p style={{ margin: "2px 0 8px", fontSize: "11px", color: "#9CA3AF" }}>
                {showAllCompetencies
                  ? "Every competency in the global catalog, including ones this curriculum hasn't adopted or that have no tagged assessment content yet — useful for pre-configuring a band's threshold ahead of real usage. It scores 0% for every learner until real content exists."
                  : "Import from the competencies this curriculum already uses. Once added, you can set each indicator's % contribution toward that competency's 100% from the band card."}
              </p>

              {competencyIds.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                  {competencyIds.map((id) => {
                    const comp = competencyById.get(id);
                    if (!comp) return null;
                    return (
                      <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", color: "#25476a", background: "#e8f5fb", border: "1px solid #a8d5ee", borderRadius: "20px", padding: "4px 6px 4px 12px" }}>
                        {comp.name}
                        <button type="button" onClick={() => toggleCompetency(id)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "16px", height: "16px", border: "none", borderRadius: "50%", background: "rgba(37,71,106,0.12)", color: "#25476a", cursor: "pointer", fontSize: "12px", lineHeight: 1, padding: 0 }}>×</button>
                      </span>
                    );
                  })}
                </div>
              )}

              {pickableCompetencies.length === 0 ? (
                <div style={{ padding: "12px 14px", background: "#F8FAFC", border: "1px dashed #E5E7EB", borderRadius: "10px", fontSize: "12px", color: "#9CA3AF", lineHeight: 1.6 }}>
                  {showAllCompetencies
                    ? "No competencies exist in the global catalog yet — add some in Settings → Competencies."
                    : adoptedCompetencies.length === 0
                    ? "This curriculum hasn't adopted any competencies yet — add some in the Competencies tab, or browse all competencies above."
                    : "None of this curriculum's competencies are in use yet — tag one on a question, rubric criterion, or observation item in an attached assessment, or browse all competencies above."}
                </div>
              ) : (
                <CompetencyLinkDropdown
                  available={pickableCompetencies.filter((c) => !competencyIds.includes(c.id))}
                  onAdd={toggleCompetency}
                />
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "18px" }}>
            <button type="button" className="cp-btn-primary" onClick={submit} disabled={(creating || updating) || !name.trim()}>
              {creating || updating ? "Saving…" : mode === "edit" ? "Save Changes" : "Add Band"}
            </button>
            <button type="button" className="cp-btn-secondary" onClick={cancel}>Cancel</button>
          </div>
        </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {mode === "list" && bands.length === 0 && stages.length === 0 && (
        <div className="cp-empty">
          <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No Developmental Stages yet</p>
          <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", maxWidth: "360px", marginInline: "auto" }}>
            Performance Bands now belong to a Developmental Stage — add a stage on the Developmental Stages tab first, then come back here to build its ladder.
          </p>
        </div>
      )}
      {mode === "list" && bands.length === 0 && stages.length > 0 && (
        <div className="cp-empty">
          <div style={{ fontSize: "36px", color: "#9CA3AF", display: "flex", justifyContent: "center", marginBottom: "10px" }}><EmojiEventsIcon fontSize="inherit" /></div>
          <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No performance bands yet</p>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#9CA3AF", maxWidth: "320px", marginInline: "auto" }}>
            Bands like Explorer, Builder, and Pioneer give learners and teachers clear language for where this stage's performance sits.
          </p>
          <button type="button" className="cp-btn-ghost" onClick={openAdd}>+ Add First Band</button>
        </div>
      )}

      {/* Band cards — ordered list with move arrows */}
      {mode === "list" && bands.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {bands.map((band, idx) => {
            const color     = ARC_PALETTE[idx % ARC_PALETTE.length];
            const isEditing = mode === "edit" && editTarget?.id === band.id;
            return (
              <div key={band.id} id={`band-card-${band.id}`} style={{
                background: "#fff", border: `1.5px solid ${isEditing ? "#25476a" : "#E5E7EB"}`,
                borderRadius: "16px", padding: "18px 20px",
                boxShadow: isEditing ? "0 0 0 3px rgba(37,71,106,0.08)" : "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  {/* Order badge + move arrows */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", flexShrink: 0, paddingTop: "2px" }}>
                    <button type="button" className="cp-icon-btn" onClick={() => moveUp(idx)} disabled={idx === 0} title="Move up">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><polyline points="18 15 12 9 6 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "10px",
                      background: `${color}18`, border: `2px solid ${color}35`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "12px", fontWeight: "800", color,
                    }}>
                      {idx + 1}
                    </div>
                    <button type="button" className="cp-icon-btn" onClick={() => moveDown(idx)} disabled={idx === bands.length - 1} title="Move down">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{
                          display: "inline-block", padding: "3px 12px", borderRadius: "20px",
                          background: `${color}18`, border: `1.5px solid ${color}35`,
                          fontSize: "13px", fontWeight: "800", color,
                        }}>
                          {band.name}
                        </span>
                        {idx === bands.length - 1 && (
                          <span
                            style={{
                              display: "inline-flex", alignItems: "center", gap: "5px",
                              padding: "3px 11px", borderRadius: "20px",
                              fontSize: "11px", fontWeight: "700",
                              color: "#B45309", background: "#FFFBEB", border: "1.5px solid #FDE68A",
                            }}
                            title="The top of this stage's own ladder — what a learner in this Developmental Stage sees as the highest level they can reach"
                          >
                            <EmojiEventsIcon fontSize="inherit" /> Highest Level
                          </span>
                        )}
                        {band.advancementThreshold > 0 && (
                          <span
                            style={{
                              display: "inline-flex", alignItems: "center", gap: "5px",
                              padding: "3px 11px 3px 9px", borderRadius: "20px",
                              fontSize: "11px", fontWeight: "700",
                              color: "#25476a", background: "#e8f5fb", border: "1.5px solid #a8d5ee",
                            }}
                            title={
                              band.advancementMin > 0
                                ? `On track from ${band.advancementMin}%; reaching ${band.advancementThreshold}% advances the learner to the next band`
                                : `A learner reaching ${band.advancementThreshold}% of this band's indicators advances to the next band`
                            }
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                              <circle cx="12" cy="12" r="3.5" fill="currentColor" />
                            </svg>
                            {band.advancementMin > 0
                              ? `${band.advancementMin}–${band.advancementThreshold}% to advance`
                              : `${band.advancementThreshold}% to advance`}
                          </span>
                        )}
                        {(band.indicatorContributions || []).length > 0 && (() => {
                          const progress = progressByBandId.get(band.id);
                          if (!progress) return null;
                          const met = progress.thresholdMet;
                          const onTrack = progress.onTrack;
                          // met (green) = reached the advancement max; onTrack (blue) = past the
                          // "on track" min but not yet the max; neither (amber) = below the min.
                          const c = met ? "#059669" : onTrack ? "#2563EB" : "#D97706";
                          return (
                            <span
                              style={{
                                display: "inline-flex", alignItems: "center", gap: "5px",
                                padding: "3px 11px", borderRadius: "20px",
                                fontSize: "11px", fontWeight: "700",
                                color: c, background: `${c}12`, border: `1.5px solid ${c}40`,
                              }}
                              title={
                                met ? "Reached the advancement maximum — ready to advance to the next band"
                                : onTrack ? `On track — past the ${progress.advancementMin}% minimum, working toward the ${progress.advancementThreshold}% maximum`
                                : "Below this band's 'on track' minimum"
                              }
                            >
                              {progress.completion}% complete{met ? "" : onTrack ? " · on track" : ""}
                            </span>
                          );
                        })()}
                        {(() => {
                          // Every indicator % contribution assigned anywhere in this band — across
                          // all of its competencies, since they share one 100% budget (see
                          // BandCompetencyBlock) — should sum to exactly 100. A band stuck below
                          // 100% (including 0%, when competencies are attached but never weighted)
                          // can mathematically never be fully completed by any learner, no matter
                          // what they do — Engine 4 sums exactly these weights, nothing more. That
                          // used to be hidden entirely at 0% (the worst case, and the easiest state
                          // to leave behind mid-setup), so it's surfaced here instead of suppressed.
                          if ((band.competencyIds || []).length === 0) return null;
                          const total = (band.indicatorContributions || []).reduce((s, c) => s + (Number(c.percentage) || 0), 0);
                          const ok = total === 100;
                          const over = total > 100;
                          const color = ok ? "#059669" : "#DC2626";
                          const label = total === 0 ? "Not weighted — always 0%" : over ? `Indicators: ${total}% (exceeds 100%)` : `Indicators: ${total}% — can't reach 100%`;
                          const title = ok
                            ? "Sum of every indicator's % contribution across this band's competencies — totals 100%"
                            : "This band's indicator weights don't total 100% — no learner can ever fully complete it until they do. Add or adjust weights below.";
                          return (
                            <span
                              style={{
                                display: "inline-flex", alignItems: "center", gap: "5px",
                                padding: "3px 11px", borderRadius: "20px",
                                fontSize: "11px", fontWeight: "700",
                                color, background: `${color}12`, border: `1.5px solid ${color}40`,
                              }}
                              title={title}
                            >
                              {ok ? `Indicators: ${total}%` : label}
                            </span>
                          );
                        })()}
                      </div>
                      {(() => {
                        // "Duplicate to next level" — copies this band's competencies, indicator
                        // weights and advancement thresholds onto the next band in THIS stage's
                        // ladder (Explorer -> Builder), overwriting its current config. Only
                        // offered when there is a next band and this one has something to copy.
                        const nextBand = bands[idx + 1];
                        const hasConfig = (band.competencyIds || []).length > 0
                          || (band.advancementThreshold ?? 0) > 0
                          || (band.advancementMin ?? 0) > 0;
                        const canDuplicate = !!nextBand && hasConfig && !duplicating;
                        return (
                          <CardKebab
                            onEdit={() => openEdit(band)}
                            onDelete={() => remove(band.id)}
                            disabled={deleting}
                            itemLabel={band.name}
                            itemType="performance band"
                            message={(() => {
                              const otherStageNames = stages.filter((s) => s.id !== selectedStageId).map((s) => s.name);
                              return otherStageNames.length > 0
                                ? `Every Developmental Stage shares the same band names — deleting "${band.name}" here also removes it from ${otherStageNames.join(", ")}, including each stage's own configured indicators and threshold for it. This cannot be undone.`
                                : undefined;
                            })()}
                            onDuplicate={canDuplicate ? () => duplicateToNext(band.id) : undefined}
                            duplicateLabel={nextBand ? `Duplicate to ${nextBand.name}` : undefined}
                            duplicateTitle={nextBand ? `Copy ${band.name}'s setup to ${nextBand.name}?` : undefined}
                            duplicateMessage={nextBand
                              ? `${nextBand.name}'s competencies, indicator weights and advancement thresholds will be replaced with ${band.name}'s. Only ${nextBand.name} in this stage is affected.`
                              : undefined}
                          />
                        );
                      })()}
                    </div>

                    {band.description && (
                      <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#6B7280", lineHeight: "1.6" }}>{band.description}</p>
                    )}

                    {(band.competencyIds || []).length === 0 ? (
                      <p style={{ margin: "10px 0 0", fontSize: "11.5px", color: "#D1D5DB", fontStyle: "italic" }}>
                        No competencies imported yet — edit this band to add some.
                      </p>
                    ) : (
                      band.competencyIds.map((cId) => {
                        const comp = competencyById.get(cId);
                        if (!comp) {
                          return (
                            <div
                              key={cId}
                              style={{
                                marginTop: "10px", padding: "9px 12px", borderRadius: "8px",
                                background: "#FFF7ED", border: "1px solid #FED7AA",
                                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
                              }}
                            >
                              <span style={{ fontSize: "11.5px", color: "#C2410C" }}>
                                A competency attached here was deleted from Settings — it can no longer be configured.
                              </span>
                              <button
                                type="button" className="cp-icon-btn danger" style={{ width: "22px", height: "22px", flexShrink: 0 }}
                                onClick={() => removeDeadCompetency(band, cId)} title="Remove from this level"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                              </button>
                            </div>
                          );
                        }
                        const percentageByIndicator = {};
                        (band.indicatorContributions || []).forEach((p) => {
                          if (p.competencyId === cId) percentageByIndicator[p.indicatorId] = p.percentage;
                        });
                        // Real tagged-on-assessment indicators first; if none exist yet (a
                        // competency added via "browse all competencies" ahead of real usage),
                        // fall back to the competency's own global indicator list so there's
                        // still something to weight/track — it just scores 0% for every learner
                        // until a real assessment actually tags these indicators. No visual
                        // distinction is made either way — it's shown exactly like any other
                        // competency on this band.
                        const populated = populatedByCompetencyId.get(cId);
                        const blockIndicators = populated && populated.length > 0 ? populated : (comp.indicators || []);
                        return (
                          <BandCompetencyBlock
                            key={cId}
                            comp={comp}
                            color={color}
                            populatedIndicators={blockIndicators}
                            percentageByIndicator={percentageByIndicator}
                            onSaveContribution={(indicatorId, percentage) => saveIndicatorContribution(band, cId, indicatorId, percentage)}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}

        </div>
      )}
    </div>
  );
}

/* ── ProgressArcPanel ────────────────────────────────────────────────────── */

const ARC_SECTIONS = [
  { key: "age-categories", label: "Developmental Stages" },
  { key: "bands",          label: "Performance Bands" },
];

function ProgressArcPanel({ curriculumId, arcSub = "age-categories", onArcSubChange }) {
  const setArcSub = onArcSubChange ?? (() => {});

  return (
    <div className="cp-card">
      <div className="cp-arc-section-header">
        <div>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0F2645" }}>Progress Arc</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            Define developmental stages and bands (score-based) — together they form each learner's identity.
          </p>
        </div>
        <div className="cp-arc-section-nav">
          {ARC_SECTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`cp-arc-section-btn${arcSub === key ? " active" : ""}`}
              onClick={() => setArcSub(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {arcSub === "age-categories" && <AgeCategoriesPanel    curriculumId={curriculumId} />}
      {arcSub === "bands"          && <PerformanceBandsPanel curriculumId={curriculumId} />}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────── */

export default function CompetenciesPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { data: curriculum } = useCurriculumQuery(id);

  const [activeNav, setActiveNav] = useState("competencies");
  const [arcSub,    setArcSub]    = useState("age-categories");

  useEffect(() => {
    const el = document.createElement("style");
    el.id = "cp-styles";
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => { document.getElementById("cp-styles")?.remove(); };
  }, []);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <button type="button" onClick={() => navigate("/curriculum")} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: "12px", fontFamily: "Inter,sans-serif", cursor: "pointer", padding: 0 }}>
              Curriculum
            </button>
            <span style={{ color: "#E5E7EB" }}>/</span>
            <span style={{ fontSize: "12px", color: "#9CA3AF", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{curriculum?.name}</span>
            <span style={{ color: "#E5E7EB" }}>/</span>
            <span style={{ fontSize: "12px", color: "#374151", fontWeight: "600" }}>Competencies</span>
          </div>
          <h1 style={{ margin: "0 0 3px", fontSize: "22px", fontWeight: "800", color: "#0F2645" }}>Competencies</h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>Pick which competencies this curriculum uses, and configure its progress arc and assessments.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <button type="button" onClick={() => navigate("/curriculum")} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Done
          </button>
          <button type="button" className="cp-btn-primary" style={{ background: "#0F2645" }} onClick={() => navigate(`/curriculum/${id}/structure`)}>
            Next: Structure →
          </button>
        </div>
      </div>

      <StepIndicator current={2} />

      {/* ── Panel navigation ────────────────────────────────────────── */}
      <div className="cp-nav">
        <button
          type="button"
          className={`cp-nav-btn${activeNav === "competencies" ? " active" : ""}`}
          onClick={() => setActiveNav("competencies")}
        >
          Competencies
        </button>

        <button
          type="button"
          className={`cp-nav-btn${activeNav === "arc" ? " active" : ""}`}
          onClick={() => setActiveNav("arc")}
        >
          Progress Arc
        </button>

        <button
          type="button"
          className={`cp-nav-btn${activeNav === "areas" ? " active" : ""}`}
          onClick={() => setActiveNav("areas")}
        >
          Learning Areas
        </button>

        <button
          type="button"
          className={`cp-nav-btn${activeNav === "journey" ? " active" : ""}`}
          onClick={() => setActiveNav("journey")}
        >
          Learning Journey
        </button>

        <button
          type="button"
          className={`cp-nav-btn${activeNav === "assessments" ? " active" : ""}`}
          onClick={() => setActiveNav("assessments")}
        >
          Assessments
        </button>
      </div>

      {/* ── Panels ──────────────────────────────────────────────────── */}
      {activeNav === "competencies" && <CompetencyPickerPanel curriculumId={id} />}
      {activeNav === "arc"          && <ProgressArcPanel      curriculumId={id} arcSub={arcSub} onArcSubChange={setArcSub} />}
      {activeNav === "areas"        && <LearningAreasPanel    curriculumId={id} />}
      {activeNav === "journey"      && <LearningJourneyPanel curriculumId={id} />}
      {activeNav === "assessments"  && <AssessmentsPanel curriculumId={id} />}
    </div>
  );
}
