import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  useAssessmentQuery, useCreateAssessment, useUpdateAssessment,
  useAssessmentCompetencies, useAssessmentPathways, useAssessmentInventory,
} from "../hooks/useAssessment";
import { assessmentApi } from "../services/assessmentApi";
import { usePermissions } from "../../../hooks/usePermissions";
import { useWorkspaceDraft, isSameContent } from "../../../hooks/useWorkspaceDraft";
import { useDraftQuery, useDraftsQuery, useDeleteDraft, useDraftsSeenAtOpen, draftsApi, DRAFT_ENDPOINTS } from "../../../hooks/useDrafts";
import DraftRestoreDialog, { WorkspaceDraftNote } from "../../../components/ui/DraftRestoreDialog";
import { useCompetencies } from "../../settings/competencies/hooks/useCompetencies";
import { usePathwayTemplates } from "../../settings/pathways/hooks/usePathwayTemplates";
import { useGoods } from "../../settings/items/hooks/useItems";
import { INVENTORY_CATEGORY_COLORS, INVENTORY_CATEGORY_ICONS } from "../../settings/items/constants";
import { FiPlus, FiX, FiPackage, FiCheck, FiEdit3, FiAward, FiTool, FiFileText, FiEye, FiBarChart2 } from "react-icons/fi";
import CreateCompetencyModal from "../../courses/components/CreateCompetencyModal";
import CreatePathwayModal from "../../courses/components/CreatePathwayModal";
import CreateInventoryItemModal from "../../courses/components/CreateInventoryItemModal";
import RichTextEditor from "../components/RichTextEditor";
import RichContent, { stripHtml, isEmptyHtml } from "../components/RichContent";
import PhotoGalleryField from "../../learning-hubs/components/PhotoGalleryField";
import {
  STRUCTURE_MODES, STRUCTURE_MODE_LABELS, ITEM_GROUPS, ITEM_GROUP_COLORS,
  ITEM_KIND_LABELS, OBSERVATION_ITEM_KINDS, TASK_TYPES, TASK_TYPE_LABELS, SUBMISSION_ITEM_KINDS,
  BUILDER_REGISTRY, kindLabel, groupLabel, normalizeLegacyItem, entryMarks, roundMarks, marksInput, splitMarks, DEFAULT_SURVEY_SCALE, CAN_DO_LEVELS, correctOptionsOf,
} from "../schemas/assessment.schema";

const TYPE_LABELS = { quiz: "Quiz", exam: "Exam", assignment: "Assignment", project: "Project", observation: "Teacher Observation", survey: "Survey" };
const TYPE_COLORS = { quiz: "#25476a", exam: "#38aae1", project: "#7C3AED", assignment: "#059669", observation: "#D97706", survey: "#0891B2" };
const TYPE_ICONS = { quiz: <FiEdit3 />, exam: <FiAward />, project: <FiTool />, assignment: <FiFileText />, observation: <FiEye />, survey: <FiBarChart2 /> };
const TAG_PALETTE = ["#25476a", "#38aae1", "#059669", "#7C3AED", "#DC2626", "#D97706", "#0891B2", "#BE185D"];

function genId() {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
}

/* ── CSS ────────────────────────────────────────────────────────────────── */

const CSS = `
  .tb-page { font-family: Inter, sans-serif; }
  .tb-header {
    display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;
    padding:18px 24px; background:#fff; border-bottom:1.5px solid #E5E7EB; margin-bottom:18px;
  }
  .tb-crumb { font-size:12px; color:#9CA3AF; margin-bottom:4px; }
  .tb-crumb a { color:#38aae1; text-decoration:none; cursor:pointer; }
  .tb-title-row { display:flex; align-items:center; gap:12px; min-width:0; }
  .tb-title-text { min-width:0; }
  .tb-title, .tb-subtitle { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:60vw; }
  .tb-title-icon {
    width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center;
    font-size:18px; flex-shrink:0;
  }
  .tb-title { margin:0; font-size:18px; font-weight:800; color:#0F2645; }
  .tb-subtitle { margin:2px 0 0; font-size:12.5px; color:#9CA3AF; }
  .tb-actions { display:flex; gap:10px; flex-shrink:0; }
  .tb-btn-primary {
    padding:9px 18px; background:#feb139; color:#25476a; border:none; border-radius:10px;
    font-size:13px; font-weight:700; font-family:Inter,sans-serif; cursor:pointer; white-space:nowrap;
  }
  .tb-btn-primary:hover:not(:disabled) { background:#f5a827; }
  .tb-btn-primary:disabled { background:#fde3b0; cursor:not-allowed; }
  .tb-btn-secondary {
    padding:9px 16px; background:#fff; color:#374151; border:1.5px solid #E5E7EB; border-radius:10px;
    font-size:13px; font-weight:600; font-family:Inter,sans-serif; cursor:pointer; white-space:nowrap;
  }
  .tb-btn-secondary:hover { background:#F3F4F6; }

  /* Was a 158px rail + content grid — the rail was a type-picker (Quiz/Exam/etc.) that just
     duplicated AssessmentsPage.jsx's own NewAssessmentMenu, the thing you actually use to pick a
     type before ever landing here, so it was dead weight in both create and edit modes. Plain
     block now; the Structure & Items workspace gets the width back. */
  .tb-body { padding:0 24px 32px; max-width:100%; box-sizing:border-box; }
  .tb-body-content { min-width:0; }

  .tb-two-col { display:grid; grid-template-columns:minmax(0,1fr) 280px; gap:16px; align-items:start; }
  @media(max-width:1000px){ .tb-two-col{ grid-template-columns:1fr; } }

  .tb-tabs { display:flex; gap:6px; margin-bottom:18px; border-bottom:2px solid #F3F4F6; }
  .tb-tab-btn {
    padding:9px 16px; background:none; border:none; border-bottom:2.5px solid transparent;
    font-size:13px; font-weight:600; font-family:Inter,sans-serif; color:#6B7280;
    cursor:pointer; margin-bottom:-2px; transition:color 0.15s, border-color 0.15s; white-space:nowrap;
  }
  .tb-tab-btn:hover  { color:#25476a; }
  .tb-tab-btn.active { color:#25476a; border-bottom-color:#25476a; }

  .tb-input, .tb-textarea, .tb-select {
    padding:10px 12px; border-radius:10px; border:1.5px solid #E5E7EB;
    font-size:13.5px; font-family:Inter,sans-serif; background:#F9FAFB;
    color:#374151; outline:none; width:100%; box-sizing:border-box;
  }
  .tb-input:focus, .tb-textarea:focus, .tb-select:focus { border-color:#38aae1; background:#fff; box-shadow:0 0 0 3px rgba(56,170,225,0.12); }
  .tb-label { font-size:12px; font-weight:700; color:#374151; display:block; margin-bottom:5px; }

  .tb-segmented { display:inline-flex; border:1.5px solid #E5E7EB; border-radius:10px; overflow:hidden; }
  .tb-segmented button {
    padding:8px 16px; background:#fff; border:none; font-size:12.5px; font-weight:700;
    font-family:Inter,sans-serif; color:#6B7280; cursor:pointer; border-left:1.5px solid #E5E7EB;
  }
  .tb-segmented button:first-child { border-left:none; }
  .tb-segmented button.active { background:#25476a; color:#fff; }

  /* Middle column gets a protected minimum so the item list never gets squeezed thinner than
     it can actually render — the fixed-width badge/points/actions on each row already eat a
     good chunk of it, so a narrower track than this just forces the item text back into the
     single-line truncation this replaces (see .tb-entry-text below). */
  .tb-workspace { display:grid; grid-template-columns:210px minmax(420px,1fr) 340px; gap:14px; align-items:start; }
  @media(max-width:1500px){ .tb-workspace{ grid-template-columns:190px minmax(380px,1fr) 300px; } }
  @media(max-width:1250px){ .tb-workspace{ grid-template-columns:1fr; } }

  .tb-card { background:#fff; border-radius:14px; border:1.5px solid #E5E7EB; padding:16px; min-width:0; box-sizing:border-box; }
  .tb-card-title { margin:0 0 10px; font-size:12.5px; font-weight:800; color:#0F2645; text-transform:uppercase; letter-spacing:0.04em; }

  .tb-palette-group { margin-bottom:14px; }
  .tb-palette-group-label { font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; margin:0 0 6px; }
  .tb-palette-group-toggle {
    display:flex; align-items:center; justify-content:space-between; width:100%; padding:2px 0 6px;
    border:none; background:none; cursor:pointer; font-family:Inter,sans-serif;
  }
  .tb-palette-chevron { transition:transform 0.15s; flex-shrink:0; }
  .tb-palette-chevron.open { transform:rotate(180deg); }
  .tb-palette-btn {
    display:flex; align-items:center; gap:8px; width:100%; padding:9px 10px; margin-bottom:6px;
    border-radius:9px; border:1.5px solid #E5E7EB; background:#fff; font-size:12.5px; font-weight:600;
    color:#374151; cursor:pointer; text-align:left; transition:border-color 0.12s, background 0.12s;
  }
  .tb-palette-btn:hover { background:#F9FAFB; }
  .tb-palette-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }

  .tb-section-block { border:1.5px solid #E5E7EB; border-radius:12px; margin-bottom:14px; overflow:hidden; }
  .tb-section-head {
    display:flex; align-items:center; gap:8px; padding:11px 14px; background:#F9FAFB; border-bottom:1px solid #F0F1F3;
  }
  .tb-section-title { flex:1; font-size:13px; font-weight:700; color:#111827; }
  .tb-section-body { padding:10px 14px; display:flex; flex-direction:column; gap:8px; }
  .tb-icon-btn {
    width:26px; height:26px; border-radius:7px; border:none; background:transparent; cursor:pointer;
    display:flex; align-items:center; justify-content:center; color:#9CA3AF; flex-shrink:0;
  }
  .tb-icon-btn:hover { background:#F3F4F6; color:#374151; }
  .tb-icon-btn.danger:hover { background:#FEF2F2; color:#DC2626; }

  /* Two rows, not one — a meta line (number/badge/points/actions, all fixed-width) on top, and
     the item's own text given its full row width below. Packing everything onto a single flex
     line left .tb-entry-text fighting five flex-shrink:0 siblings for whatever room was left,
     which is what forced item text down to 1-2 visible characters at normal widths. */
  .tb-entry-row {
    display:flex; flex-direction:column; gap:6px; padding:9px 10px; border-radius:9px; border:1.5px solid #EEF0F2;
    background:#FAFBFF; cursor:pointer; transition:border-color 0.12s; min-width:0;
  }
  .tb-entry-row:hover { border-color:#b8d9ee; }
  .tb-entry-row.selected { border-color:#25476a; background:#F0F7FF; }
  .tb-entry-meta { display:flex; align-items:center; gap:8px; min-width:0; }
  .tb-entry-num { font-size:12px; font-weight:700; color:#9CA3AF; width:16px; flex-shrink:0; }
  .tb-entry-badge { font-size:10px; font-weight:700; padding:2px 8px; border-radius:20px; white-space:nowrap; flex-shrink:0; }
  .tb-entry-points { font-size:11px; color:#9CA3AF; flex-shrink:0; }
  .tb-entry-actions { display:flex; align-items:center; gap:2px; margin-left:auto; flex-shrink:0; }
  .tb-entry-text {
    font-size:12.5px; line-height:1.4; color:#374151; padding-left:24px;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
  }

  .tb-add-item-btn {
    display:flex; align-items:center; justify-content:center; gap:6px; width:100%; padding:9px;
    border-radius:9px; border:1.5px dashed #D1D5DB; background:transparent; color:#6B7280;
    font-size:12.5px; font-weight:600; cursor:pointer;
  }
  .tb-add-item-btn:hover { border-color:#25476a; color:#25476a; background:#F0F7FF; }

  .tb-placeholder { text-align:center; padding:28px 14px; color:#9CA3AF; }
  .tb-placeholder-icon {
    width:44px; height:44px; border-radius:12px; background:#F3F4F6; display:flex; align-items:center;
    justify-content:center; margin:0 auto 10px; color:#D1D5DB;
  }

  .tb-tag-chip {
    display:inline-flex; align-items:center; gap:6px; padding:5px 7px 5px 11px; border-radius:20px;
    font-size:12px; font-weight:700; font-family:Inter,sans-serif; max-width:100%; line-height:1.3;
  }
  .tb-tag-chip-x {
    width:15px; height:15px; border-radius:50%; border:none; background:rgba(0,0,0,0.08); color:inherit;
    cursor:pointer; font-size:10px; font-weight:900; display:inline-flex; align-items:center; justify-content:center; padding:0; flex-shrink:0;
  }
  .tb-tag-dropdown {
    position:absolute; top:calc(100% + 6px); left:0; z-index:20; background:#fff; border:1px solid #E5E7EB;
    border-radius:12px; box-shadow:0 10px 28px rgba(15,38,69,0.14), 0 2px 8px rgba(0,0,0,0.06);
    width:240px; max-height:260px; overflow-y:auto; padding:6px;
  }
  .tb-tag-dropdown-item {
    display:block; width:100%; padding:8px 10px; border:none; border-radius:8px; background:transparent;
    font-size:12.5px; font-weight:600; font-family:Inter,sans-serif; color:#374151; text-align:left; cursor:pointer;
  }
  .tb-tag-dropdown-item:hover { background:#F3F4F6; }
  .tb-tag-dropdown-item--material { display:flex; align-items:center; gap:8px; }

  .tb-material-row {
    display:flex; align-items:center; gap:10px; padding:9px 10px; border:1px solid #EEF0F2;
    border-radius:10px; background:#FAFBFF;
  }
  .tb-material-icon {
    width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0;
  }
  .tb-material-empty {
    display:flex; flex-direction:column; align-items:center; gap:8px; padding:22px 14px; margin-bottom:12px;
    border:1.5px dashed #E5E7EB; border-radius:12px; background:#FAFBFF;
  }
  .tb-material-empty-icon {
    width:36px; height:36px; border-radius:10px; background:#F3F4F6; color:#9CA3AF;
    display:flex; align-items:center; justify-content:center;
  }
  .tb-qty-stepper { display:flex; align-items:center; border:1.5px solid #E5E7EB; border-radius:9px; overflow:hidden; flex-shrink:0; }
  .tb-qty-btn {
    width:24px; height:28px; border:none; background:#F9FAFB; color:#374151; font-size:14px; font-weight:700;
    cursor:pointer; display:flex; align-items:center; justify-content:center; font-family:Inter,sans-serif;
  }
  .tb-qty-btn:hover:not(:disabled) { background:#F3F4F6; }
  .tb-qty-btn:disabled { color:#D1D5DB; cursor:not-allowed; }
  .tb-qty-input {
    width:36px; border:none; border-left:1.5px solid #E5E7EB; border-right:1.5px solid #E5E7EB; text-align:center;
    font-size:12.5px; font-family:Inter,sans-serif; color:#111827; outline:none; padding:5px 2px;
  }
  .tb-qty-input::-webkit-outer-spin-button, .tb-qty-input::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }

  .tb-material-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(190px,1fr)); gap:10px; margin-bottom:14px; }
  .tb-material-card {
    border:1.5px solid #E5E7EB; border-radius:14px; overflow:hidden; background:#fff;
    display:flex; flex-direction:column; transition:box-shadow 0.15s, transform 0.15s;
  }
  .tb-material-card:hover { box-shadow:0 6px 20px rgba(37,71,106,0.1); transform:translateY(-2px); }
  .tb-material-card-img { height:100px; position:relative; flex-shrink:0; }
  .tb-material-card-remove {
    position:absolute; top:6px; right:6px; width:24px; height:24px; border-radius:8px;
    background:rgba(255,255,255,0.92); border:none; display:flex; align-items:center; justify-content:center;
    cursor:pointer; color:#EF4444;
  }
  .tb-material-card-body { padding:10px 12px 12px; display:flex; flex-direction:column; gap:7px; }
`;

/* ── small shared bits ─────────────────────────────────────────────────── */

function Label({ children }) {
  return <label className="tb-label">{children}</label>;
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="tb-segmented">
      {options.map((opt) => (
        <button key={opt} type="button" className={value === opt ? "active" : ""} onClick={() => onChange(opt)}>
          {STRUCTURE_MODE_LABELS[opt] || opt}
        </button>
      ))}
    </div>
  );
}

const SALE_LEVEL_LABELS = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

// Info-tab card, Project only. Flip "For sale on the website" on and the marketing fields
// (cover image, price, level, age, tagline) appear. When off, everything stays authored but the
// public /api/public/projects endpoint won't serve this assessment. The description / overview /
// deliverables / milestones the buyer sees come from the assessment's own fields elsewhere in
// the builder — this panel only adds the shopfront metadata.
function SellingPanel({ form, setForm }) {
  const on = form.saleStatus === "for_sale";
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const ageInvalid =
    form.ageMin !== "" && form.ageMax !== "" && Number(form.ageMax) < Number(form.ageMin);

  return (
    <div className="tb-card">
      <p className="tb-card-title">Selling</p>

      <label style={{ display: "flex", alignItems: "flex-start", gap: "9px", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => set({ saleStatus: e.target.checked ? "for_sale" : "internal" })}
          style={{ marginTop: "2px", width: "15px", height: "15px", flexShrink: 0 }}
        />
        <span>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>
            For sale on the website
          </span>
          <span style={{ display: "block", fontSize: "11.5px", color: "#9CA3AF", marginTop: "1px" }}>
            Appears in the public Projects section (africa.digifunzi.com/projects). Off = internal
            use only.
          </span>
        </span>
      </label>

      {on && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>
          {/* The first photo is the project's cover (cards, listings); the rest are its website gallery. */}
          <PhotoGalleryField
            label="Photos"
            value={[form.coverImage, ...form.gallery].filter(Boolean)}
            onChange={(photos) => set({ coverImage: photos[0] || "", gallery: photos.slice(1) })}
            max={12}
            cropAspect={16 / 9}
            sortable
            coverLabel="Cover"
            hint="Up to 12 photos. The first is the cover; drag to reorder."
          />

          <div>
            <Label>Short Tagline</Label>
            <input
              className="tb-input"
              placeholder="e.g. Make a model room that reacts to you"
              maxLength={200}
              value={form.saleTagline}
              onChange={(e) => set({ saleTagline: e.target.value })}
            />
          </div>

          <div>
            <Label>Price</Label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                className="tb-input"
                style={{ width: "70px", flexShrink: 0 }}
                value={form.priceCurrency}
                onChange={(e) => set({ priceCurrency: e.target.value })}
                aria-label="Currency"
              />
              <input
                className="tb-input"
                type="number"
                min="0"
                style={{ width: "120px", flexShrink: 0 }}
                placeholder="1800"
                value={form.priceAmount}
                onChange={(e) => set({ priceAmount: e.target.value })}
                aria-label="Amount"
              />
              <span style={{ fontSize: "11.5px", color: "#9CA3AF" }}>
                Leave blank to show &ldquo;Enquire for pricing&rdquo;
              </span>
            </div>
            <input
              className="tb-input"
              style={{ marginTop: "6px" }}
              placeholder="Price note (e.g. One-time purchase — lifetime access)"
              maxLength={300}
              value={form.priceNote}
              onChange={(e) => set({ priceNote: e.target.value })}
            />
          </div>

          <div>
            <Label>Materials Kit Price</Label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                className="tb-input"
                type="number"
                min="0"
                style={{ width: "120px", flexShrink: 0 }}
                placeholder="e.g. 2500"
                value={form.kitPriceAmount}
                onChange={(e) => set({ kitPriceAmount: e.target.value })}
                aria-label="Kit price"
              />
              <span style={{ fontSize: "11.5px", color: "#9CA3AF" }}>
                Offered at checkout as &ldquo;Add the materials kit&rdquo; (the items linked under Materials). Leave blank for no kit.
              </span>
            </div>
          </div>

          <div>
            <Label>Level</Label>
            <div style={{ display: "flex", gap: "6px" }}>
              {["beginner", "intermediate", "advanced"].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => set({ saleLevel: form.saleLevel === lvl ? "" : lvl })}
                  style={{
                    padding: "5px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                    border: `1.5px solid ${form.saleLevel === lvl ? "#25476a" : "#E5E7EB"}`,
                    background: form.saleLevel === lvl ? "#e8f5fb" : "#fff",
                    color: form.saleLevel === lvl ? "#25476a" : "#6B7280",
                  }}
                >
                  {SALE_LEVEL_LABELS[lvl]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Age Range <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(optional)</span></Label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                className="tb-input" type="number" min="0" max="25" style={{ width: "80px" }}
                placeholder="Min" value={form.ageMin}
                onChange={(e) => set({ ageMin: e.target.value })}
              />
              <span style={{ color: "#9CA3AF", fontSize: "13px" }}>to</span>
              <input
                className="tb-input" type="number" min="0" max="25" style={{ width: "80px" }}
                placeholder="Max" value={form.ageMax}
                onChange={(e) => set({ ageMax: e.target.value })}
              />
              <span style={{ color: "#9CA3AF", fontSize: "12px" }}>years</span>
            </div>
            {ageInvalid && (
              <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#DC2626" }}>
                Max age must be greater than or equal to min age.
              </p>
            )}
          </div>

          <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF", lineHeight: 1.5 }}>
            The buyer also sees this project&rsquo;s Description, Project Overview, Deliverables and
            Milestones — author those in the tabs above. Linked inventory shows as &ldquo;what
            you&rsquo;ll need&rdquo;.
          </p>
        </div>
      )}
    </div>
  );
}

function ChipList({ values, options, labels, onToggle }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {options.map((opt) => {
        const active = values.includes(opt);
        return (
          <button
            key={opt} type="button" onClick={() => onToggle(opt)}
            style={{
              padding: "4px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: 600, cursor: "pointer",
              border: `1.5px solid ${active ? "#25476a" : "#E5E7EB"}`, background: active ? "#e8f5fb" : "#fff",
              color: active ? "#25476a" : "#6B7280",
            }}
          >
            {active && <FiCheck size={11} style={{ marginRight: 4, verticalAlign: "-1px" }} />}{labels[opt] || opt}
          </button>
        );
      })}
    </div>
  );
}

/* ── Competency / Pathway tag picker ──────────────────────────────── */

function TagPicker({ label, items, selectedIds, onChange, onCreateNew }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = selectedIds.map((id) => items.find((i) => i.id === id)).filter(Boolean);
  const available = items.filter((i) => !selectedIds.includes(i.id));

  return (
    <div>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
          {selected.map((item, idx) => {
            const color = item.color || TAG_PALETTE[idx % TAG_PALETTE.length];
            return (
              <span key={item.id} className="tb-tag-chip" style={{ background: `${color}12`, border: `1.5px solid ${color}30`, color }}>
                {item.chipName || item.name}
                <button type="button" className="tb-tag-chip-x" onClick={() => onChange(selectedIds.filter((x) => x !== item.id))}>×</button>
              </span>
            );
          })}
        </div>
      )}
      <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
        <button type="button" className="tb-btn-secondary" onClick={() => setOpen((v) => !v)}>+ Add {label}</button>
        {open && (
          <div className="tb-tag-dropdown">
            {available.length === 0 && <div style={{ padding: "14px", textAlign: "center", fontSize: "12px", color: "#9CA3AF" }}>All {label.toLowerCase()}s already added.</div>}
            {available.map((item) => (
              <button key={item.id} type="button" className="tb-tag-dropdown-item" onClick={() => { onChange([...selectedIds, item.id]); setOpen(false); }}>{item.name}</button>
            ))}
            {onCreateNew && (
              <button
                type="button" className="tb-tag-dropdown-item"
                style={{ background: "#F0F7FF", color: "#25476a", fontWeight: 700, marginTop: available.length ? "4px" : 0 }}
                onClick={() => { onCreateNew(); setOpen(false); }}
              >
                + Create new {label.toLowerCase()}…
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Competency indicator picker (per question / criterion) ────────────── */

function IndicatorPicker({ options, selectedIds, onChange }) {
  if (!options || options.length === 0) {
    return <p style={{ margin: 0, fontSize: "11.5px", color: "#9CA3AF", fontStyle: "italic" }}>Attach a competency to this assessment (Info tab) to link indicators here.</p>;
  }
  return (
    <div>
      <Label>Competency Indicator(s)</Label>
      <TagPicker label="Indicator" items={options} selectedIds={selectedIds} onChange={onChange} />
    </div>
  );
}

/* ── marks per indicator: Direct marks or Rubric ───────────────────────────
   A question/criterion tagged to competency indicators gets its marks one of two ways, never
   both at once:
     Direct marks — the author types how many marks each indicator is worth.
     Rubric       — the author builds a checklist of criteria, each one marking ONE of the tagged
                    indicators; an indicator's marks are the sum of its criteria (the direct boxes
                    stay on screen, read-only, showing those sums).
   The mode is the data itself: a non-empty `scoringCriteria` means Rubric. Scoring downstream
   still only reads indicatorMarks/points, which Rubric mode keeps in step with the criteria. A
   criterion left without an indicator (a rubric built before criteria were assigned, or one whose
   indicator was untagged) is shared evenly across the tagged indicators, so no marks go missing. */


// Each tagged indicator's marks, worked out from the rubric's criteria (see above).
function indicatorMarksFromCriteria(indicatorMarks, criteria) {
  if (indicatorMarks.length === 0) return indicatorMarks;
  const single = indicatorMarks.length === 1;
  const sums = new Map(indicatorMarks.map((m) => [m.indicatorId, 0]));
  let unassigned = 0;
  criteria.forEach((c) => {
    const points = Number(c.points) || 0;
    if (single) sums.set(indicatorMarks[0].indicatorId, sums.get(indicatorMarks[0].indicatorId) + points);
    else if (sums.has(c.indicatorId)) sums.set(c.indicatorId, sums.get(c.indicatorId) + points);
    else unassigned += points;
  });
  const shares = splitMarks(unassigned, indicatorMarks.length);
  return indicatorMarks.map((m, i) => ({ ...m, marks: roundMarks(sums.get(m.indicatorId) + (unassigned > 0 ? shares[i] : 0)) }));
}

// Applies an IndicatorPicker's new selection to an entry — returns the fields to patch. Direct
// marks: indicators that stay keep their marks, a newly tagged one starts at an even share of the
// entry's points (never 0, so tagging never silently zeroes a question). Rubric: criteria marking
// an untagged indicator are left without one, and every indicator's marks are re-summed from the
// criteria. Untagging the last indicator drops the rubric and keeps its total as the flat marks.
function syncIndicatorMarksForEntry(entry, newIds) {
  const current = entry.indicatorMarks || [];
  const criteria = entry.scoringCriteria || [];
  if (criteria.length === 0) {
    const shares = splitMarks(entry.points, newIds.length);
    return { indicatorMarks: newIds.map((id, i) => current.find((m) => m.indicatorId === id) || { indicatorId: id, marks: shares[i] }) };
  }
  if (newIds.length === 0) {
    return { indicatorMarks: [], scoringCriteria: [], points: roundMarks(criteria.reduce((sum, c) => sum + (Number(c.points) || 0), 0)) };
  }
  const nextCriteria = criteria.map((c) => (newIds.includes(c.indicatorId) ? c : { ...c, indicatorId: newIds.length === 1 ? newIds[0] : null }));
  const base = newIds.map((id) => current.find((m) => m.indicatorId === id) || { indicatorId: id, marks: 0 });
  return { indicatorMarks: indicatorMarksFromCriteria(base, nextCriteria), scoringCriteria: nextCriteria };
}

// Switching into Rubric mode starts one criterion per tagged indicator, worth what that indicator
// is worth now (1 if nothing yet) — so the totals carry straight over.
function startScoringCriteria(entry) {
  const indicatorMarks = entry.indicatorMarks || [];
  const criteria = indicatorMarks.map((m) => ({ id: genId(), label: "", points: Number(m.marks) || 1, indicatorId: m.indicatorId }));
  return { scoringCriteria: criteria, indicatorMarks: indicatorMarksFromCriteria(indicatorMarks, criteria) };
}

function indicatorLabel(indicatorOptions, indicatorId) {
  const opt = indicatorOptions.find((o) => o.id === indicatorId);
  return opt?.chipName || opt?.name || indicatorId;
}

function ScoringCriteriaEditor({ entry, onChange, indicatorOptions }) {
  const criteria = entry.scoringCriteria || [];
  const indicatorMarks = entry.indicatorMarks || [];
  const several = indicatorMarks.length > 1;
  const total = roundMarks(criteria.reduce((sum, c) => sum + (Number(c.points) || 0), 0));
  const unassignedCount = several ? criteria.filter((c) => !indicatorMarks.some((m) => m.indicatorId === c.indicatorId)).length : 0;

  const commit = (nextCriteria) => onChange({ ...entry, scoringCriteria: nextCriteria, indicatorMarks: indicatorMarksFromCriteria(indicatorMarks, nextCriteria) });

  // A new criterion marks the first indicator that has none yet, else the same one as the last row.
  const nextIndicatorId = () => {
    const uncovered = indicatorMarks.find((m) => !criteria.some((c) => c.indicatorId === m.indicatorId));
    return (uncovered || indicatorMarks.find((m) => m.indicatorId === criteria[criteria.length - 1]?.indicatorId) || indicatorMarks[0])?.indicatorId || null;
  };
  const add = () => commit([...criteria, { id: genId(), label: "", points: 1, indicatorId: nextIndicatorId() }]);
  const update = (id, patch) => commit(criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id) => commit(criteria.filter((c) => c.id !== id));

  return (
    <div>
      <Label>Rubric</Label>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {criteria.map((c) => {
          const unassigned = several && !indicatorMarks.some((m) => m.indicatorId === c.indicatorId);
          return (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: "6px", padding: several ? "8px" : 0, border: several ? "1px solid #F3F4F6" : "none", borderRadius: "9px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input className="tb-input" placeholder="Criterion (e.g. Did the student answer)" value={c.label} onChange={(e) => update(c.id, { label: e.target.value })} style={{ flex: 1 }} />
                <input type="number" min="0" step="0.1" className="tb-input" style={{ width: "72px", flexShrink: 0 }} value={c.points} onChange={(e) => update(c.id, { points: marksInput(e.target.value) })} />
                <button type="button" className="tb-icon-btn danger" onClick={() => remove(c.id)}><FiX size={13} /></button>
              </div>
              {several && (
                <select
                  className="tb-input"
                  value={unassigned ? "" : c.indicatorId}
                  onChange={(e) => update(c.id, { indicatorId: e.target.value || null })}
                  style={{ fontSize: "12px", borderColor: unassigned ? "#FCA5A5" : undefined }}
                >
                  <option value="">Which indicator does this mark?</option>
                  {indicatorMarks.map((m) => <option key={m.indicatorId} value={m.indicatorId}>{indicatorLabel(indicatorOptions, m.indicatorId)}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" className="tb-add-item-btn" style={{ marginTop: "8px" }} onClick={add}>+ Add Criterion</button>
      {unassignedCount > 0 && (
        <p style={{ margin: "8px 0 0", fontSize: "11.5px", fontWeight: 600, color: "#DC2626" }}>
          {unassignedCount} {unassignedCount !== 1 ? "criteria have" : "criterion has"} no indicator yet — until you pick one, its marks are shared evenly.
        </p>
      )}
      <p style={{ margin: "8px 0 0", fontSize: "11.5px", fontWeight: total === 0 ? 700 : 400, color: total === 0 ? "#DC2626" : "#9CA3AF" }}>
        Total: {total} pt{total !== 1 ? "s" : ""}{total === 0 && " — worth nothing until you add criteria"}
      </p>
    </div>
  );
}

// The marks section for an entry tagged to at least one indicator (see the block comment above).
// `allowRubric` is false for types whose questions can't carry a rubric — those get Direct only.
function IndicatorMarksEditor({ entry, onChange, indicatorOptions, allowRubric }) {
  const indicatorMarks = entry.indicatorMarks || [];
  const rubricMode = allowRubric && (entry.scoringCriteria || []).length > 0;
  const total = entryMarks(entry);
  const setMode = (mode) => {
    if (mode === "rubric" && !rubricMode) onChange({ ...entry, ...startScoringCriteria(entry) });
    if (mode === "direct" && rubricMode) onChange({ ...entry, scoringCriteria: [] });
  };
  const modeBtn = (mode, label) => {
    const active = (mode === "rubric") === rubricMode;
    return (
      <button
        type="button"
        onClick={() => setMode(mode)}
        style={{ flex: 1, padding: "6px 10px", fontSize: "12px", fontWeight: 700, borderRadius: "7px", cursor: "pointer", border: "none", backgroundColor: active ? "#fff" : "transparent", color: active ? "#25476a" : "#6B7280", boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}
      >
        {label}
      </button>
    );
  };

  return (
    <div>
      <Label>Marks</Label>
      {allowRubric && (
        <div style={{ display: "flex", gap: "4px", padding: "3px", backgroundColor: "#F3F4F6", borderRadius: "9px", marginBottom: "8px" }}>
          {modeBtn("direct", "Direct marks")}
          {modeBtn("rubric", "Rubric")}
        </div>
      )}
      <p style={{ margin: "0 0 8px", fontSize: "11.5px", color: "#6B7280" }}>
        {rubricMode
          ? "Each indicator's marks come from the rubric criteria below that mark it."
          : "Type the marks each indicator is worth."}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {indicatorMarks.map((m) => (
          <div key={m.indicatorId} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", background: "#FAFBFF", border: "1px solid #F3F4F6", borderRadius: "9px", opacity: rubricMode ? 0.75 : 1 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: "12.5px", color: "#374151", lineHeight: 1.35, wordBreak: "break-word" }}>{indicatorLabel(indicatorOptions, m.indicatorId)}</span>
            <input
              type="number" min="0" step="0.1" className="tb-input" style={{ width: "72px", flexShrink: 0 }}
              value={m.marks}
              disabled={rubricMode}
              title={rubricMode ? "Set by the rubric" : undefined}
              onChange={(e) => onChange({ ...entry, indicatorMarks: indicatorMarks.map((x) => (x.indicatorId === m.indicatorId ? { ...x, marks: marksInput(e.target.value) } : x)) })}
            />
          </div>
        ))}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: "11.5px", fontWeight: total === 0 ? 700 : 400, color: total === 0 ? "#DC2626" : "#9CA3AF" }}>
        Total: {total} pt{total !== 1 ? "s" : ""}
        {total === 0 && (rubricMode ? " — worth nothing until the rubric has marks" : " — worth nothing until you set marks above")}
      </p>
      {rubricMode && (
        <div style={{ marginTop: "12px" }}>
          <ScoringCriteriaEditor entry={entry} onChange={onChange} indicatorOptions={indicatorOptions} />
        </div>
      )}
    </div>
  );
}

/* ── entry factory ──────────────────────────────────────────────────────── */

function defaultEntry(kind, sectionId, assessmentType) {
  const base = { id: genId(), kind, sectionId };
  if (OBSERVATION_ITEM_KINDS.includes(kind)) {
    return { ...base, text: "", points: 1, indicatorMarks: [], scoringCriteria: [], ratingScale: ["Not Yet", "Developing", "Proficient"], competencyIndicatorIds: [] };
  }
  // A survey-type assessment is never scored (see grading.utils.js) — its questions default to
  // 0 points so the (unused, but still-computed) maxScore/points display never implies a survey
  // question is "worth" anything, unlike the same "survey" item kind used inside a graded
  // quiz/exam, which keeps the normal points: 1 default.
  const points = assessmentType === "survey" ? 0 : 1;
  return {
    ...base,
    question: "", points, indicatorMarks: [], scoringCriteria: [],
    options: kind === "mcqSingle" || kind === "mcqMultiple" ? ["", ""] : [],
    correctAnswer: "",
    pairs: kind === "matching" ? [{ left: "", right: "" }, { left: "", right: "" }] : [],
    blanks: kind === "fillBlank" ? [""] : [],
    sequence: kind === "ordering" ? ["", ""] : [],
    ratingScale: kind === "survey" ? [...DEFAULT_SURVEY_SCALE] : [],
    levelLabels: kind === "canDo" ? CAN_DO_LEVELS.map((level) => level.label) : undefined,
    acceptedFileTypes: [],
    taskType: null,
    submissionKinds: [],
  };
}

function entryLabel(entry) {
  return entry.question ?? entry.text ?? "";
}

/* ── Item palette ───────────────────────────────────────────────────────── */

function ItemPalette({ type, structureType, onAdd }) {
  const registry = BUILDER_REGISTRY[type] || {};
  // The Structure setting picks the groups: structured questions (a survey's own "survey" group
  // counts as structured), open/unstructured ones and uploads, or both. A project's only items
  // are can-do checks, so it always shows them, whatever the structure type.
  const all = registry.itemGroups || [];
  const groups = registry.canDoOnly
    ? all
    : structureType === "structured"
      ? all.filter((g) => g === "structured" || g === "survey")
      : structureType === "unstructured"
        ? all.filter((g) => g === "unstructured" || g === "submission")
        : all;
  const kindsOf = (group) => registry.onlyKinds?.[group] || ITEM_GROUPS[group];

  // Groups always start collapsed on a fresh create/edit visit — opt-in (not opt-out) so any
  // group that only appears after switching structure type also starts collapsed.
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (group) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(group)) next.delete(group); else next.add(group);
    return next;
  });

  return (
    <div className="tb-card">
      <p className="tb-card-title">Add Item</p>
      <p style={{ margin: "-6px 0 12px", fontSize: "11px", color: "#9CA3AF" }}>Click to add an item to the focused section.</p>
      {groups.map((group) => {
        const isOpen = expanded.has(group);
        return (
          <div key={group} className="tb-palette-group">
            <button type="button" className="tb-palette-group-toggle" onClick={() => toggle(group)}>
              <span className="tb-palette-group-label" style={{ color: ITEM_GROUP_COLORS[group], margin: 0 }}>{groupLabel(type, group)}</span>
              <svg className={`tb-palette-chevron${isOpen ? " open" : ""}`} width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {isOpen && kindsOf(group).map((kind) => (
              <button key={kind} type="button" className="tb-palette-btn" onClick={() => onAdd(kind)}>
                <span className="tb-palette-dot" style={{ backgroundColor: ITEM_GROUP_COLORS[group] }} />
                {kindLabel(type, kind)}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ── Structure canvas ───────────────────────────────────────────────────── */

function StructureCanvas({ type, sections, entries, focusedSectionId, selectedId, onFocusSection, onSelect, onAddSection, onRenameSection, onDeleteSection, onDeleteEntry, onMoveEntry, onMoveSection }) {
  let counter = 0;
  const color = TYPE_COLORS[type];

  return (
    <div className="tb-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div>
          <p className="tb-card-title" style={{ marginBottom: "2px" }}>Structure</p>
          <p style={{ margin: 0, fontSize: "11.5px", color: "#9CA3AF" }}>Organize the assessment using sections and add items.</p>
        </div>
        <button type="button" className="tb-btn-secondary" onClick={onAddSection}>+ Add Section</button>
      </div>

      {sections.length === 0 && entries.length === 0 && (
        <div className="tb-placeholder">
          <p style={{ margin: 0, fontSize: "13px" }}>No sections yet — add one, or just click an item in the palette to get started.</p>
        </div>
      )}

      {sections.map((section, sIdx) => {
        const sectionEntries = entries.filter((e) => e.sectionId === section.id);
        return (
          <div
            key={section.id} className="tb-section-block"
            style={{ borderColor: focusedSectionId === section.id ? color : "#E5E7EB" }}
            onClick={() => onFocusSection(section.id)}
          >
            <div className="tb-section-head">
              <button type="button" className="tb-icon-btn" onClick={(e) => { e.stopPropagation(); onMoveSection(section.id, -1); }} disabled={sIdx === 0} title="Move up">↑</button>
              <button type="button" className="tb-icon-btn" onClick={(e) => { e.stopPropagation(); onMoveSection(section.id, 1); }} disabled={sIdx === sections.length - 1} title="Move down">↓</button>
              <input
                className="tb-section-title" style={{ border: "none", background: "transparent", outline: "none", fontFamily: "Inter, sans-serif" }}
                value={section.name} onChange={(e) => onRenameSection(section.id, e.target.value)} onClick={(e) => e.stopPropagation()}
              />
              <button type="button" className="tb-icon-btn danger" onClick={(e) => { e.stopPropagation(); onDeleteSection(section.id); }} title="Delete section"><FiX size={13} /></button>
            </div>
            <div className="tb-section-body">
              {sectionEntries.length === 0 && (
                <p style={{ margin: 0, fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>No items in this section yet.</p>
              )}
              {sectionEntries.map((entry, eIdx) => {
                counter += 1;
                return renderEntryRow(entry, counter, eIdx, sectionEntries.length);
              })}
            </div>
          </div>
        );
      })}

      {(() => {
        const sectionIds = new Set(sections.map((s) => s.id));
        const orphanEntries = entries.filter((e) => !e.sectionId || !sectionIds.has(e.sectionId));
        if (orphanEntries.length === 0) return null;
        return (
          <div className="tb-section-block" style={{ borderColor: "#E5E7EB" }}>
            <div className="tb-section-head">
              <span className="tb-section-title" style={{ color: "#9CA3AF", fontStyle: "italic" }}>Unsectioned</span>
            </div>
            <div className="tb-section-body">
              {orphanEntries.map((entry, eIdx) => {
                counter += 1;
                return renderEntryRow(entry, counter, eIdx, orphanEntries.length);
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );

  function renderEntryRow(entry, num, eIdx, siblingCount) {
    const group = OBSERVATION_ITEM_KINDS.includes(entry.kind)
      ? "observation"
      : Object.entries(ITEM_GROUPS).find(([, kinds]) => kinds.includes(entry.kind))?.[0];
    const badgeColor = ITEM_GROUP_COLORS[group] || color;
    return (
      <div
        key={entry.id} className={`tb-entry-row${selectedId === entry.id ? " selected" : ""}`}
        onClick={(e) => { e.stopPropagation(); onSelect(entry.id); }}
      >
        <div className="tb-entry-meta">
          <span className="tb-entry-num">{num}.</span>
          <span className="tb-entry-badge" style={{ color: badgeColor, backgroundColor: `${badgeColor}15`, border: `1px solid ${badgeColor}40` }}>
            {kindLabel(type, entry.kind)}
          </span>
          {type !== "survey" && <span className="tb-entry-points">{entryMarks(entry)} pt{entryMarks(entry) !== 1 ? "s" : ""}</span>}
          <div className="tb-entry-actions">
            <button type="button" className="tb-icon-btn" onClick={(e) => { e.stopPropagation(); onMoveEntry(entry.id, -1); }} disabled={eIdx === 0} title="Move up">↑</button>
            <button type="button" className="tb-icon-btn" onClick={(e) => { e.stopPropagation(); onMoveEntry(entry.id, 1); }} disabled={eIdx === siblingCount - 1} title="Move down">↓</button>
            <button type="button" className="tb-icon-btn danger" onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.id); }} title="Delete"><FiX size={13} /></button>
          </div>
        </div>
        <span className="tb-entry-text">{stripHtml(entryLabel(entry)) || <em style={{ color: "#D1D5DB" }}>Untitled item</em>}</span>
      </div>
    );
  }
}

/* ── Item configuration (right panel) ──────────────────────────────────── */

function ListEditor({ values, onChange, placeholder, minItems = 1, numbered = true }) {
  const set = (i, v) => { const next = [...values]; next[i] = v; onChange(next); };
  const add = () => onChange([...values, ""]);
  const remove = (i) => onChange(values.filter((_, idx) => idx !== i));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {values.map((v, i) => (
        <div key={i} style={{ display: "flex", gap: "6px" }}>
          <input className="tb-input" placeholder={numbered ? `${placeholder} ${i + 1}` : placeholder} value={v} onChange={(e) => set(i, e.target.value)} />
          {values.length > minItems && <button type="button" className="tb-icon-btn danger" onClick={() => remove(i)}><FiX size={13} /></button>}
        </div>
      ))}
      <button type="button" className="tb-add-item-btn" onClick={add}>+ Add</button>
    </div>
  );
}

// Options list for mcqSingle/mcqMultiple, each row pairing its text with a radio (single) or
// checkbox (multiple) marking it correct. `correctAnswer` holds the correct option by its text
// (mcqSingle), or the list of correct options' texts, trimmed (mcqMultiple — correctOptionsOf
// also reads the comma-joined string saved before 28 Oct 2026); grading.utils.js#gradeItem
// compares the learner's answer against it. Since correctness is tracked by text rather than by
// a stable id, editing/removing an option that's marked correct keeps `correctAnswer` in step —
// in the same `onChange({ options, correctAnswer })`, so neither change overwrites the other.
// `scored` false (a survey): just the choices — no correct answer to mark.
function McqOptionsEditor({ kind, options, correctAnswer, onChange, scored = true }) {
  const multiple = kind === "mcqMultiple";
  const correctList = multiple ? correctOptionsOf({ correctAnswer }) : [];
  const isCorrect = (v) => (multiple ? v.trim() !== "" && correctList.includes(v.trim()) : v !== "" && v === correctAnswer);

  const set = (i, v) => {
    const prev = options[i];
    const nextOptions = options.map((o, idx) => (idx === i ? v : o));
    if (!isCorrect(prev)) return onChange({ options: nextOptions });
    onChange({
      options: nextOptions,
      correctAnswer: multiple
        ? correctList.map((c) => (c === prev.trim() ? v.trim() : c)).filter(Boolean)
        : v,
    });
  };
  const add = () => onChange({ options: [...options, ""] });
  const remove = (i) => {
    const removed = options[i];
    const nextOptions = options.filter((_, idx) => idx !== i);
    if (!isCorrect(removed)) return onChange({ options: nextOptions });
    // Another option with the same text keeps it correct.
    const stillThere = nextOptions.some((o) => o.trim() === removed.trim());
    onChange({
      options: nextOptions,
      correctAnswer: multiple ? (stillThere ? correctList : correctList.filter((c) => c !== removed.trim())) : (stillThere ? correctAnswer : ""),
    });
  };
  const toggleCorrect = (v) => {
    if (!multiple) return onChange({ correctAnswer: v });
    const text = v.trim();
    onChange({ correctAnswer: correctList.includes(text) ? correctList.filter((c) => c !== text) : [...correctList, text] });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {options.map((v, i) => (
        <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {scored ? (
            <input
              type={kind === "mcqSingle" ? "radio" : "checkbox"}
              name={`mcq-correct-${kind}`}
              checked={isCorrect(v)}
              disabled={!v.trim()}
              onChange={() => toggleCorrect(v)}
              title="Mark as correct answer"
              style={{ flexShrink: 0, cursor: v.trim() ? "pointer" : "not-allowed" }}
            />
          ) : (
            <input type={kind === "mcqSingle" ? "radio" : "checkbox"} disabled aria-hidden="true" tabIndex={-1} style={{ flexShrink: 0 }} />
          )}
          <input className="tb-input" placeholder={`Option ${i + 1}`} value={v} onChange={(e) => set(i, e.target.value)} />
          {options.length > 2 && <button type="button" className="tb-icon-btn danger" onClick={() => remove(i)}><FiX size={13} /></button>}
        </div>
      ))}
      <button type="button" className="tb-add-item-btn" onClick={add}>+ Add</button>
      <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "#9CA3AF" }}>
        {!scored
          ? (kind === "mcqSingle" ? "The learner picks one. There's no right answer in a survey." : "The learner ticks all that apply. There's no right answer in a survey.")
          : kind === "mcqSingle" ? "Select the radio next to the correct option." : "Check every correct option."}
      </p>
    </div>
  );
}

function ItemConfigForm({ type, entry, onChange, indicatorOptions }) {
  const set = (key, val) => onChange({ ...entry, [key]: val });
  const isObservation = OBSERVATION_ITEM_KINDS.includes(entry.kind);
  // Every kind — every observation kind, a "note" included — shares the exact same
  // IndicatorPicker + Marks UI every item/rubric criterion already uses.
  const supportsTasks = BUILDER_REGISTRY[type]?.supportsTasks && !isObservation;
  const indicatorMarks = entry.indicatorMarks || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div>
        <Label>{isObservation ? "Observation Text" : "Question / Prompt"}</Label>
        <RichTextEditor value={entryLabel(entry)} onChange={(html) => set(isObservation ? "text" : "question", html)} minHeight={90} maxHeight={220} />
      </div>

      <IndicatorPicker
        options={indicatorOptions}
        selectedIds={indicatorMarks.map((m) => m.indicatorId)}
        onChange={(ids) => onChange({ ...entry, ...syncIndicatorMarksForEntry(entry, ids) })}
      />

      {/* A survey question is never scored (see grading.utils.js) — it can still be tagged to a
          competency indicator above, just with no marks value attached to that tag, so the
          Marks/rubric UI (which only makes sense for a graded entry) is skipped entirely. */}
      {type !== "survey" && (
        indicatorMarks.length === 0 ? (
          <div>
            <Label>Marks</Label>
            <input type="number" min="0" step="0.1" className="tb-input" value={entry.points} onChange={(e) => set("points", marksInput(e.target.value))} />
          </div>
        ) : (
          <IndicatorMarksEditor entry={entry} onChange={onChange} indicatorOptions={indicatorOptions} allowRubric={!!BUILDER_REGISTRY[type]?.supportsQuestionRubric} />
        )
      )}

      {(entry.kind === "mcqSingle" || entry.kind === "mcqMultiple") && (
        <div>
          <Label>Options</Label>
          <McqOptionsEditor
            kind={entry.kind}
            options={entry.options}
            correctAnswer={entry.correctAnswer}
            onChange={(patch) => onChange({ ...entry, ...patch })}
            scored={type !== "survey"}
          />
        </div>
      )}

      {entry.kind === "trueFalse" && (
        <div>
          <Label>Correct Answer</Label>
          <div style={{ display: "flex", gap: "14px" }}>
            {["True", "False"].map((v) => (
              <label key={v} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "#374151" }}>
                <input type="radio" name={`tf-${entry.id}`} checked={entry.correctAnswer === v} onChange={() => set("correctAnswer", v)} /> {v}
              </label>
            ))}
          </div>
        </div>
      )}

      {entry.kind === "matching" && (
        <div>
          <Label>Pairs</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {entry.pairs.map((p, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input className="tb-input" placeholder="Left" value={p.left} onChange={(e) => { const next = [...entry.pairs]; next[i] = { ...p, left: e.target.value }; set("pairs", next); }} />
                <span style={{ color: "#9CA3AF" }}>↔</span>
                <input className="tb-input" placeholder="Right" value={p.right} onChange={(e) => { const next = [...entry.pairs]; next[i] = { ...p, right: e.target.value }; set("pairs", next); }} />
                {entry.pairs.length > 2 && <button type="button" className="tb-icon-btn danger" onClick={() => set("pairs", entry.pairs.filter((_, idx) => idx !== i))}><FiX size={13} /></button>}
              </div>
            ))}
            <button type="button" className="tb-add-item-btn" onClick={() => set("pairs", [...entry.pairs, { left: "", right: "" }])}>+ Add Pair</button>
          </div>
        </div>
      )}

      {entry.kind === "fillBlank" && (
        <div>
          <Label>Blank Answers</Label>
          <ListEditor values={entry.blanks} onChange={(v) => set("blanks", v)} placeholder="Blank" minItems={1} />
        </div>
      )}

      {entry.kind === "ordering" && (
        <div>
          <Label>Steps (in correct order)</Label>
          <ListEditor values={entry.sequence} onChange={(v) => set("sequence", v)} placeholder="Step" minItems={2} />
        </div>
      )}

      {entry.kind === "shortAnswer" && type !== "survey" && (
        <div>
          <Label>Model Answer (optional)</Label>
          <input className="tb-input" value={entry.correctAnswer} onChange={(e) => set("correctAnswer", e.target.value)} />
        </div>
      )}

      {entry.kind === "survey" && (
        <div>
          <Label>Scale</Label>
          <ListEditor values={entry.ratingScale} onChange={(v) => set("ratingScale", v)} placeholder="Point" minItems={2} />
          <p style={{ margin: "8px 0 0", fontSize: "11.5px", color: "#9CA3AF" }}>
            {type === "survey"
              ? "Word the points however you like — e.g. Never … Always, or 1 to 5. The learner picks one."
              : "The learner picks one point on this scale — there's no right or wrong answer, so it's reviewed manually rather than auto-graded."}
          </p>
        </div>
      )}

      {entry.kind === "canDo" && (
        <div>
          <Label>Levels</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {CAN_DO_LEVELS.map((level, i) => (
              <div key={level.key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: level.color, flexShrink: 0 }} />
                <input
                  className="tb-input"
                  value={entry.levelLabels?.[i] ?? level.label}
                  maxLength={150}
                  onChange={(e) => {
                    const next = CAN_DO_LEVELS.map((l, j) => entry.levelLabels?.[j] ?? l.label);
                    next[i] = e.target.value;
                    set("levelLabels", next);
                  }}
                  aria-label={`Wording for "${level.label}"`}
                />
                <span style={{ flexShrink: 0, minWidth: "88px", fontSize: "11.5px", fontWeight: 700, color: level.color, textAlign: "right" }}>
                  {Math.round(level.credit * 100)}% of the marks
                </span>
              </div>
            ))}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: "11.5px", color: "#9CA3AF" }}>
            {type === "survey"
              ? "The learner picks the level that fits. In a survey it isn't marked."
              : "The learner picks the level that fits, and it's marked straight away: the full marks, half, or none. Change the wording if you like — the marks each level earns stay the same."}
          </p>
        </div>
      )}

      {["documentUpload", "imageUpload", "videoUpload", "audioUpload", "codeUpload"].includes(entry.kind) && (
        <div>
          <Label>Accepted Formats (optional)</Label>
          <ListEditor values={entry.acceptedFileTypes.length ? entry.acceptedFileTypes : [""]} onChange={(v) => set("acceptedFileTypes", v.filter((x) => x.trim()))} placeholder="e.g. .pdf" minItems={0} numbered={false} />
        </div>
      )}

      {isObservation && entry.kind === "checklist" && (
        <p style={{ margin: 0, fontSize: "11.5px", color: "#9CA3AF", fontStyle: "italic" }}>A single checkbox item — no rating scale needed.</p>
      )}
      {isObservation && entry.kind === "note" && (
        <p style={{ margin: 0, fontSize: "11.5px", color: "#9CA3AF", fontStyle: "italic" }}>A freeform prompt — the teacher writes notes against it, and can mark it like any other item.</p>
      )}
      {isObservation && ["rating", "practicalSkill", "behaviour"].includes(entry.kind) && (
        <div>
          <Label>Rating Scale</Label>
          <ListEditor values={entry.ratingScale} onChange={(v) => set("ratingScale", v)} placeholder="Level" minItems={2} />
        </div>
      )}

      {supportsTasks && (
        <>
          <div>
            <Label>Task Type</Label>
            <select className="tb-select" value={entry.taskType || ""} onChange={(e) => set("taskType", e.target.value || null)}>
              <option value="">— None —</option>
              {TASK_TYPES.map((t) => <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <Label>Submission Type(s)</Label>
            <ChipList
              values={entry.submissionKinds} options={SUBMISSION_ITEM_KINDS} labels={ITEM_KIND_LABELS}
              onToggle={(kind) => set("submissionKinds", entry.submissionKinds.includes(kind) ? entry.submissionKinds.filter((k) => k !== kind) : [...entry.submissionKinds, kind])}
            />
          </div>
        </>
      )}
    </div>
  );
}

/* ── Right panel ────────────────────────────────────────────────────────── */

function PlaceholderPanel({ text }) {
  return (
    <div className="tb-placeholder" style={{ padding: "20px 10px" }}>
      <div className="tb-placeholder-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 12h6M9 16h6M9 8h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" /></svg>
      </div>
      <p style={{ margin: 0, fontSize: "12px" }}>{text}</p>
    </div>
  );
}

function SummaryCard({ form }) {
  return (
    <div className="tb-card">
      <p className="tb-card-title">Assessment Information</p>
      <p style={{ margin: "0 0 3px", fontSize: "13px", fontWeight: 700, color: "#111827", wordBreak: "break-word" }}>{form.name || <em style={{ color: "#D1D5DB", fontWeight: 400 }}>Untitled assessment</em>}</p>
      <p style={{ margin: 0, fontSize: "11.5px", color: "#9CA3AF" }}>{TYPE_LABELS[form.type]} · {STRUCTURE_MODE_LABELS[form.structureType]}</p>
    </div>
  );
}

function RightPanel({ form, selectedEntry, onUpdateEntry, indicatorOptions }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <SummaryCard form={form} />

      <div className="tb-card">
        <p className="tb-card-title">Item Configuration</p>
        {selectedEntry ? (
          <ItemConfigForm type={form.type} entry={selectedEntry} onChange={onUpdateEntry} indicatorOptions={indicatorOptions} />
        ) : (
          <PlaceholderPanel text="Select an item from the builder to configure its properties." />
        )}
      </div>
    </div>
  );
}

/* ── Indicator statistics (marks contributed per competency indicator) ─── */

function IndicatorStatsPanel({ stats }) {
  if (stats.length === 0) {
    return (
      <div className="tb-card" style={{ marginTop: "16px" }}>
        <p className="tb-card-title">Indicator Statistics</p>
        <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF" }}>
          Attach a competency to this assessment (Info tab) to see how its indicators' marks add up here.
        </p>
      </div>
    );
  }

  const totalIndicatorMarks = roundMarks(stats.reduce((sum, s) => sum + s.marks, 0));
  const byCompetency = new Map();
  stats.forEach((s) => {
    if (!byCompetency.has(s.competencyName)) byCompetency.set(s.competencyName, []);
    byCompetency.get(s.competencyName).push(s);
  });
  // A competency can be linked (Info tab) without any of ITS OWN indicators ever being tagged
  // on a question — e.g. an author links two competencies but only tags indicators from one of
  // them. That's not a display bug downstream (Performance Bands correctly shows nothing to
  // attach), but it's easy to miss here, so call it out by name instead of just going quiet.
  const untaggedCompetencies = [...byCompetency.entries()].filter(([, inds]) => inds.every((s) => s.questionCount === 0));

  return (
    <div className="tb-card" style={{ marginTop: "16px" }}>
      <p className="tb-card-title" style={{ marginBottom: "2px" }}>Indicator Statistics</p>
      <p style={{ margin: "0 0 14px", fontSize: "11.5px", color: "#9CA3AF" }}>
        How many marks each linked indicator is worth, based on the per-indicator marks assigned on tagged questions.
      </p>

      {untaggedCompetencies.length > 0 && (
        <div style={{ marginBottom: "14px", padding: "10px 12px", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px" }}>
          <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#92400E" }}>
            {untaggedCompetencies.length === 1 ? "1 linked competency has" : `${untaggedCompetencies.length} linked competencies have`} no tagged indicators
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: "#92400E" }}>
            {untaggedCompetencies.map(([name]) => name).join(", ")} — none of {untaggedCompetencies.length === 1 ? "its" : "their"} indicators appear on any question yet, so it won't show up when attaching this curriculum's Performance Bands. Tag at least one question with an indicator from {untaggedCompetencies.length === 1 ? "it" : "each"} below.
          </p>
        </div>
      )}

      {stats.every((s) => s.questionCount === 0) ? null : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {[...byCompetency.entries()].filter(([, inds]) => inds.some((s) => s.questionCount > 0)).map(([competencyName, indicators]) => (
            <div key={competencyName}>
              <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: "700", color: indicators[0].color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {competencyName}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {indicators.filter((ind) => ind.questionCount > 0).map((ind) => (
                  <div key={ind.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", backgroundColor: "#FAFBFF", border: "1px solid #F3F4F6", borderRadius: "10px" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: "12.5px", fontWeight: "600", color: "#111827" }}>
                      {ind.name}
                    </span>
                    <span style={{ fontSize: "11px", color: "#9CA3AF", flexShrink: 0 }}>
                      {ind.questionCount} question{ind.questionCount !== 1 ? "s" : ""}
                    </span>
                    <span style={{ fontSize: "12.5px", fontWeight: "700", color: ind.color, flexShrink: 0, minWidth: "50px", textAlign: "right" }}>
                      {ind.marks} pt{ind.marks !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {stats.some((s) => s.questionCount > 0) && (
        <p style={{ margin: "14px 0 0", paddingTop: "12px", borderTop: "1px solid #F3F4F6", fontSize: "12.5px", fontWeight: "700", color: "#111827" }}>
          Sum across indicators: {totalIndicatorMarks} pt{totalIndicatorMarks !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

/* ── Grading Rubric tab (Assignment/Project) ────────────────────────────── */

function GradingRubricTab({ type, rubric, onChange, indicatorOptions }) {
  const supportsQuestionRubric = BUILDER_REGISTRY[type]?.supportsQuestionRubric;
  const add = () => onChange([...rubric, { id: genId(), criterion: "", description: "", points: 10, indicatorMarks: [], scoringCriteria: [] }]);
  const update = (id, patch) => onChange(rubric.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id) => onChange(rubric.filter((c) => c.id !== id));
  const totalPoints = roundMarks(rubric.reduce((sum, c) => sum + entryMarks(c), 0));

  return (
    <div className="tb-card">
      <p className="tb-card-title">Grading Rubric{rubric.length ? ` · ${totalPoints} pts` : ""}</p>
      <p style={{ margin: "-4px 0 12px", fontSize: "11.5px", color: "#9CA3AF" }}>Optional holistic grading criteria, separate from the item-level marks above.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {rubric.map((c) => {
          const indicatorMarks = c.indicatorMarks || [];
          return (
            <div key={c.id} style={{ padding: "10px 12px", border: "1px solid #EEF0F2", borderRadius: "10px", background: "#FAFBFF" }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                <input className="tb-input" placeholder="Criterion" value={c.criterion} onChange={(e) => update(c.id, { criterion: e.target.value })} />
                {indicatorMarks.length === 0 && (
                  <input type="number" min="0" step="0.1" className="tb-input" style={{ width: "90px", flexShrink: 0 }} placeholder="Points" value={c.points} onChange={(e) => update(c.id, { points: marksInput(e.target.value) })} />
                )}
                <button type="button" className="tb-icon-btn danger" onClick={() => remove(c.id)}><FiX size={13} /></button>
              </div>
              <textarea className="tb-textarea" rows={2} placeholder="Description (optional)" value={c.description} onChange={(e) => update(c.id, { description: e.target.value })} />
              <div style={{ marginTop: "8px" }}>
                <IndicatorPicker
                  options={indicatorOptions}
                  selectedIds={indicatorMarks.map((m) => m.indicatorId)}
                  onChange={(ids) => update(c.id, syncIndicatorMarksForEntry(c, ids))}
                />
              </div>
              {indicatorMarks.length > 0 && (
                <div style={{ marginTop: "10px" }}>
                  <IndicatorMarksEditor entry={c} onChange={(next) => update(c.id, next)} indicatorOptions={indicatorOptions} allowRubric={!!supportsQuestionRubric} />
                </div>
              )}
            </div>
          );
        })}
        <button type="button" className="tb-add-item-btn" onClick={add}>+ Add Criterion</button>
      </div>
    </div>
  );
}

/* ── Deliverables & Milestones tab (Project only) ──────────────────────── */

function DeliverablesMilestonesTab({ deliverables, milestones, onChangeDeliverables, onChangeMilestones }) {
  const addDeliverable = () => onChangeDeliverables([...deliverables, { id: genId(), name: "", description: "", submissionKinds: [] }]);
  const updateDeliverable = (id, patch) => onChangeDeliverables(deliverables.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const removeDeliverable = (id) => onChangeDeliverables(deliverables.filter((d) => d.id !== id));

  const addMilestone = () => onChangeMilestones([...milestones, { id: genId(), name: "", description: "", order: milestones.length, points: 0 }]);
  const updateMilestone = (id, patch) => onChangeMilestones(milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const removeMilestone = (id) => onChangeMilestones(milestones.filter((m) => m.id !== id));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
      <div className="tb-card">
        <p className="tb-card-title">Deliverables</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {deliverables.map((d) => (
            <div key={d.id} style={{ padding: "10px 12px", border: "1px solid #EEF0F2", borderRadius: "10px", background: "#FAFBFF" }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                <input className="tb-input" placeholder="Deliverable name" value={d.name} onChange={(e) => updateDeliverable(d.id, { name: e.target.value })} />
                <button type="button" className="tb-icon-btn danger" onClick={() => removeDeliverable(d.id)}><FiX size={13} /></button>
              </div>
              <textarea className="tb-textarea" rows={2} placeholder="Description (optional)" value={d.description} onChange={(e) => updateDeliverable(d.id, { description: e.target.value })} style={{ marginBottom: "6px" }} />
              <ChipList values={d.submissionKinds} options={SUBMISSION_ITEM_KINDS} labels={ITEM_KIND_LABELS} onToggle={(kind) => updateDeliverable(d.id, { submissionKinds: d.submissionKinds.includes(kind) ? d.submissionKinds.filter((k) => k !== kind) : [...d.submissionKinds, kind] })} />
            </div>
          ))}
          <button type="button" className="tb-add-item-btn" onClick={addDeliverable}>+ Add Deliverable</button>
        </div>
      </div>

      <div className="tb-card">
        <p className="tb-card-title">Milestones <span style={{ fontWeight: 400, color: "#9CA3AF", textTransform: "none" }}>(optional)</span></p>
        <p style={{ margin: "-4px 0 8px", fontSize: "11.5px", color: "#9CA3AF" }}>
          Checkpoints the teacher grades directly as the project progresses — each one releases to the learner the moment it's graded, independently of the deliverables above.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {milestones.map((m) => (
            <div key={m.id} style={{ padding: "10px 12px", border: "1px solid #EEF0F2", borderRadius: "10px", background: "#FAFBFF" }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                <input className="tb-input" placeholder="Milestone name" value={m.name} onChange={(e) => updateMilestone(m.id, { name: e.target.value })} />
                <input type="number" min="0" step="0.1" className="tb-input" style={{ width: "90px", flexShrink: 0 }} placeholder="Points" value={m.points ?? 0} onChange={(e) => updateMilestone(m.id, { points: marksInput(e.target.value) })} />
                <button type="button" className="tb-icon-btn danger" onClick={() => removeMilestone(m.id)}><FiX size={13} /></button>
              </div>
              <textarea className="tb-textarea" rows={2} placeholder="Description (optional)" value={m.description} onChange={(e) => updateMilestone(m.id, { description: e.target.value })} />
            </div>
          ))}
          <button type="button" className="tb-add-item-btn" onClick={addMilestone}>+ Add Milestone</button>
        </div>
      </div>
    </div>
  );
}

/* ── Inventory tab (Project only) ───────────────────────────────────────── */

function InventoryTab({ inventory, catalog, onChange, onCreateNew }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) { setOpen(false); setQuery(""); } };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const linkedIds = inventory.map((l) => l.itemId);
  const available = catalog.filter((i) => !linkedIds.includes(i.id));
  const q = query.trim().toLowerCase();
  const filtered = q ? available.filter((i) => i.name.toLowerCase().includes(q)) : available;

  const add = (itemId) => { onChange([...inventory, { itemId, quantity: 1 }]); setOpen(false); setQuery(""); };
  const setQuantity = (itemId, quantity) => onChange(inventory.map((l) => (l.itemId === itemId ? { ...l, quantity: Math.max(1, quantity) } : l)));
  const step = (itemId, delta) => {
    const link = inventory.find((l) => l.itemId === itemId);
    if (link) setQuantity(itemId, link.quantity + delta);
  };
  const remove = (itemId) => onChange(inventory.filter((l) => l.itemId !== itemId));

  return (
    <div className="tb-card">
      <p className="tb-card-title" style={{ marginBottom: "2px" }}>Materials{inventory.length ? ` · ${inventory.length}` : ""}</p>
      <p style={{ margin: "0 0 14px", fontSize: "11.5px", color: "#9CA3AF" }}>
        Robots, boards, sensors, and other materials this project needs — pulled from Settings → Items → Goods.
      </p>

      {inventory.length === 0 && (
        <div className="tb-material-empty">
          <span className="tb-material-empty-icon"><FiPackage size={18} /></span>
          <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF" }}>No materials added yet.</p>
        </div>
      )}

      <div className="tb-material-grid">
        {inventory.map((link) => {
          const item = catalog.find((i) => i.id === link.itemId);
          if (!item) return null;
          const color = INVENTORY_CATEGORY_COLORS[item.category] || INVENTORY_CATEGORY_COLORS.Other;
          const Icon = INVENTORY_CATEGORY_ICONS[item.category] || INVENTORY_CATEGORY_ICONS.Other;
          return (
            <div key={link.itemId} className="tb-material-card">
              <div className="tb-material-card-img">
                {item.image ? (
                  <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", backgroundColor: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
                    <Icon size={26} />
                  </div>
                )}
                <button type="button" className="tb-material-card-remove" onClick={() => remove(link.itemId)} title="Remove"><FiX size={13} /></button>
              </div>
              <div className="tb-material-card-body">
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </p>
                <span style={{ alignSelf: "flex-start", display: "inline-flex", padding: "3px 9px", borderRadius: "20px", background: `${color}12`, border: `1.5px solid ${color}30`, color, fontSize: "11px", fontWeight: 700 }}>{item.category}</span>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <div className="tb-qty-stepper">
                    <button type="button" className="tb-qty-btn" onClick={() => step(link.itemId, -1)} disabled={link.quantity <= 1}>−</button>
                    <input
                      type="number" min="1" className="tb-qty-input"
                      value={link.quantity} onChange={(e) => setQuantity(link.itemId, Number(e.target.value) || 1)}
                    />
                    <button type="button" className="tb-qty-btn" onClick={() => step(link.itemId, 1)}>+</button>
                  </div>
                  <span style={{ fontSize: "11px", color: "#9CA3AF", flexShrink: 0 }}>{item.unit}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
        <button type="button" className="tb-btn-secondary" onClick={() => setOpen((v) => !v)}>
          <FiPlus size={13} style={{ marginRight: "5px", verticalAlign: "-2px" }} />Add Material
        </button>
        {open && (
          <div className="tb-tag-dropdown" style={{ width: "270px" }}>
            <div style={{ padding: "4px 4px 8px" }}>
              <input
                autoFocus className="tb-input" style={{ padding: "7px 10px", fontSize: "12.5px" }}
                placeholder="Search catalog…" value={query} onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {filtered.length === 0 && (
              <div style={{ padding: "14px", textAlign: "center", fontSize: "12px", color: "#9CA3AF" }}>
                {available.length === 0 ? "All catalog items already added." : "No matches."}
              </div>
            )}
            {filtered.map((item) => {
              const color = INVENTORY_CATEGORY_COLORS[item.category] || INVENTORY_CATEGORY_COLORS.Other;
              const Icon = INVENTORY_CATEGORY_ICONS[item.category] || INVENTORY_CATEGORY_ICONS.Other;
              return (
                <button key={item.id} type="button" className="tb-tag-dropdown-item tb-tag-dropdown-item--material" onClick={() => add(item.id)}>
                  {item.image ? (
                    <img src={item.image} alt={item.name} style={{ width: "24px", height: "24px", borderRadius: "7px", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <span className="tb-material-icon" style={{ width: "24px", height: "24px", backgroundColor: `${color}15`, color }}>
                      <Icon size={12} />
                    </span>
                  )}
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                  <span style={{ color: "#9CA3AF", fontSize: "11px", flexShrink: 0 }}>{item.category}</span>
                </button>
              );
            })}
            {onCreateNew && (
              <button
                type="button" className="tb-tag-dropdown-item"
                style={{ background: "#F0F7FF", color: "#25476a", fontWeight: 700, marginTop: "4px" }}
                onClick={() => { onCreateNew(); setOpen(false); setQuery(""); }}
              >
                + Create new item…
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Preview modal ──────────────────────────────────────────────────────── */

function PreviewModal({ form, entries, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,38,69,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: "18px", width: "100%", maxWidth: "620px", boxShadow: "0 24px 64px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", background: "linear-gradient(135deg,#1a3550 0%,#25476a 60%,#2e7db5 100%)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#fff" }}>{form.name || "Untitled assessment"}</h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>{TYPE_LABELS[form.type]} · {STRUCTURE_MODE_LABELS[form.structureType]}</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", cursor: "pointer", fontSize: "16px", width: "26px", height: "26px", borderRadius: "8px" }}>×</button>
        </div>
        <div style={{ padding: "20px 22px", maxHeight: "60vh", overflowY: "auto" }}>
          {!isEmptyHtml(form.description) && <div style={{ margin: "0 0 14px" }}><RichContent html={form.description} /></div>}
          {form.sections.map((section) => (
            <div key={section.id} style={{ marginBottom: "14px" }}>
              <p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: 700, color: "#25476a" }}>{section.name}</p>
              {entries.filter((e) => e.sectionId === section.id).map((entry) => (
                <div key={entry.id} style={{ padding: "8px 10px", fontSize: "12.5px", color: "#374151", background: "#F9FAFB", borderRadius: "8px", marginBottom: "5px" }}>
                  {stripHtml(entryLabel(entry)) || <em style={{ color: "#D1D5DB" }}>Untitled item</em>} <span style={{ color: "#9CA3AF" }}>· {kindLabel(form.type, entry.kind)}</span>
                </div>
              ))}
            </div>
          ))}
          {entries.filter((e) => !e.sectionId).length > 0 && (
            <div>
              <p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: 700, color: "#9CA3AF" }}>Unsectioned</p>
              {entries.filter((e) => !e.sectionId).map((entry) => (
                <div key={entry.id} style={{ padding: "8px 10px", fontSize: "12.5px", color: "#374151", background: "#F9FAFB", borderRadius: "8px", marginBottom: "5px" }}>
                  {stripHtml(entryLabel(entry)) || <em style={{ color: "#D1D5DB" }}>Untitled item</em>} <span style={{ color: "#9CA3AF" }}>· {kindLabel(form.type, entry.kind)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── form (de)serialization ─────────────────────────────────────────────── */

// The "Selling" fields — only ever authored for a Project, only sent to the API for a Project
// (see buildPayload). Blank/internal defaults so a non-project form carries them harmlessly.
const BLANK_SALE = {
  saleStatus: "internal",
  coverImage: "",
  gallery: [],
  kitPriceAmount: "",
  priceAmount: "",
  priceCurrency: "KES",
  priceNote: "",
  saleLevel: "",
  saleTagline: "",
  ageMin: "",
  ageMax: "",
};

function saleFromAssessment(a) {
  return {
    saleStatus: a.saleStatus || "internal",
    coverImage: a.coverImage || "",
    gallery: Array.isArray(a.gallery) ? a.gallery : [],
    kitPriceAmount: a.kitPriceAmount ?? "",
    priceAmount: a.priceAmount ?? "",
    priceCurrency: a.priceCurrency || "KES",
    priceNote: a.priceNote || "",
    saleLevel: a.saleLevel || "",
    saleTagline: a.saleTagline || "",
    ageMin: a.ageMin ?? "",
    ageMax: a.ageMax ?? "",
  };
}

function buildBlankForm(type) {
  return {
    type, name: "", description: "", instructions: "", structureType: "mixed", overview: "",
    sections: [], items: [], indicators: [], deliverables: [], milestones: [], rubric: [],
    competencyIds: [], pathwayIds: [], inventory: [],
    ...BLANK_SALE,
  };
}

function buildFormFromAssessment(a, competencyIds, pathwayIds, inventory) {
  return {
    type: a.type, name: a.name || "", description: a.description || "", instructions: a.instructions || "",
    structureType: a.structureType || "mixed", overview: a.overview || "",
    sections: a.sections || [],
    items: (a.items || []).map((item) => ({ ...normalizeLegacyItem(item), id: item.id || genId(), indicatorMarks: item.indicatorMarks || [], scoringCriteria: item.scoringCriteria || [] })),
    indicators: (a.indicators || []).map((ind) => ({ id: ind.id || genId(), kind: ind.kind || "rating", sectionId: ind.sectionId || null, competencyIndicatorIds: ind.competencyIndicatorIds || [], scoringCriteria: ind.scoringCriteria || [], ...ind })),
    deliverables: (a.deliverables || []).map((d) => ({ ...d, id: d.id || genId() })),
    milestones: (a.milestones || []).map((m) => ({ ...m, id: m.id || genId() })),
    rubric: (a.rubric || []).map((c) => ({ ...c, id: c.id || genId(), indicatorMarks: c.indicatorMarks || [], scoringCriteria: c.scoringCriteria || [] })),
    competencyIds, pathwayIds, inventory,
    ...saleFromAssessment(a),
  };
}

// A draft's form as the builder uses it now — a draft written before a field was added to the
// builder still opens with that field at its blank value.
function formFromDraft(draft, fallbackType) {
  const content = draft.content || {};
  return { ...buildBlankForm(content.type || draft.type || fallbackType), ...content };
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function AssessmentBuilderPage() {
  const { type: routeType, id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  // ?draft=<id> — carrying on a draft of unsaved work (from the Assessments page, or this page's
  // own once it has started one, so a reload picks it back up).
  const [searchParams, setSearchParams] = useSearchParams();
  const draftParam = searchParams.get("draft");

  const { data: assessment, isLoading: loadingAssessment } = useAssessmentQuery(id);
  const { data: linkedCompetencies, isLoading: loadingCompetencies } = useAssessmentCompetencies(id);
  const { data: linkedPathways, isLoading: loadingPathways } = useAssessmentPathways(id);
  const { data: linkedInventory, isLoading: loadingInventory } = useAssessmentInventory(id);
  const { mutate: createAssessment, isPending: creating } = useCreateAssessment();
  const { mutate: updateAssessment, isPending: updating } = useUpdateAssessment();
  const { data: allCompetencies = [] } = useCompetencies();
  const { data: allPathways = [] } = usePathwayTemplates();
  const { data: allInventory = [] } = useGoods();
  // Competencies, pathways and goods are picked from the Settings catalogs; adding a new one to
  // a catalog from here needs Settings → Add (staff without it just pick from what exists).
  const { can } = usePermissions();
  const canAddToCatalog = can("settings", "create");

  const [form, setForm] = useState(null);
  const [originalTags, setOriginalTags] = useState({ competencyIds: [], pathwayIds: [], inventory: [] });
  const [activeTab, setActiveTab] = useState("info");
  const [focusedSectionId, setFocusedSectionId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [createCompetencyOpen, setCreateCompetencyOpen] = useState(false);
  const [createPathwayOpen, setCreatePathwayOpen] = useState(false);
  const [createInventoryOpen, setCreateInventoryOpen] = useState(false);
  // The form as it was loaded (or blank), to tell whether there's unsaved work to keep as a draft.
  const loadedForm = useRef(null);
  const [draftOfferDone, setDraftOfferDone] = useState(false);

  // Unsaved work is written to the workspace as it's typed (useWorkspaceDraft) — several people
  // share one account, so it's kept per assessment being built, not per browser or per login.
  const autosave = useWorkspaceDraft({
    endpoint: DRAFT_ENDPOINTS.assessments,
    kind: "assessment",
    value: form,
    dirty: Boolean(form) && !isSameContent(form, loadedForm.current),
    recordId: isEdit ? id : null,
    type: form?.type ?? routeType,
    onCreated: (draftId) => setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.set("draft", draftId);
      return next;
    }, { replace: true }),
  });
  // The draft named in the address, read once to open the form from it.
  const { data: openedDraft, isError: openedDraftMissing } = useDraftQuery(DRAFT_ENDPOINTS.assessments, draftParam, { enabled: form === null });
  // Editing without one: drafts other visits left of this assessment, offered back below.
  const { data: assessmentDrafts = [] } = useDraftsQuery(DRAFT_ENDPOINTS.assessments, { recordId: id }, { enabled: isEdit && !draftParam });
  const { mutate: deleteDraft } = useDeleteDraft(DRAFT_ENDPOINTS.assessments);
  // Earlier visits' drafts of this assessment go once it's saved.
  const dropSeenDrafts = useDraftsSeenAtOpen(DRAFT_ENDPOINTS.assessments, {
    drafts: assessmentDrafts,
    recordId: isEdit && form ? id : null,
    untouched: Boolean(form) && isSameContent(form, loadedForm.current),
    ownDraftId: autosave.currentDraftId(),
  });

  // `name` (competency — indicator) disambiguates in the picker dropdown when more than one
  // linked competency is in play; `chipName` (just the indicator) keeps the selected chip and
  // the Marks-per-Indicator rows compact once it's already been picked.
  const indicatorOptions = useMemo(() => {
    if (!form) return [];
    return allCompetencies
      .filter((comp) => form.competencyIds.includes(comp.id))
      .flatMap((comp) => (comp.indicators || []).map((ind) => ({ id: ind.id, name: `${comp.name} — ${ind.name}`, chipName: ind.name })));
  }, [allCompetencies, form]);

  // Per-indicator mark totals across this assessment's questions — each indicator's marks
  // come directly from its own row in the question's indicatorMarks split.
  const indicatorStats = useMemo(() => {
    if (!form) return [];
    const linked = allCompetencies.filter((comp) => form.competencyIds.includes(comp.id));
    const byIndicator = new Map();
    [...(form.items || []), ...(form.indicators || [])].forEach((item) => {
      (item.indicatorMarks || []).forEach(({ indicatorId, marks }) => {
        const cur = byIndicator.get(indicatorId) || { marks: 0, questionCount: 0 };
        cur.marks += Number(marks) || 0;
        cur.questionCount += 1;
        byIndicator.set(indicatorId, cur);
      });
    });
    return linked.flatMap((comp, ci) =>
      (comp.indicators || []).map((ind) => ({
        id: ind.id,
        name: ind.name,
        competencyName: comp.name,
        color: TAG_PALETTE[ci % TAG_PALETTE.length],
        marks: roundMarks(byIndicator.get(ind.id)?.marks || 0),
        questionCount: byIndicator.get(ind.id)?.questionCount || 0,
      }))
    );
  }, [allCompetencies, form]);

  useEffect(() => {
    if (form) return;
    if (draftParam && !openedDraft && !openedDraftMissing) return;
    // Only a draft of this same assessment (or, for a new one, of no assessment) is opened.
    const fromDraft = draftParam && openedDraft && (openedDraft.recordId || null) === (isEdit ? id : null) ? openedDraft : null;
    let start;
    if (isEdit) {
      if (loadingAssessment || loadingCompetencies || loadingPathways || loadingInventory || !assessment) return;
      const competencyIds = linkedCompetencies.map((c) => c.id);
      const pathwayIds = linkedPathways.map((a) => a.id);
      const inventory = linkedInventory.map((i) => ({ itemId: i.id, quantity: i.quantity }));
      start = buildFormFromAssessment(assessment, competencyIds, pathwayIds, inventory);
      setOriginalTags({ competencyIds, pathwayIds, inventory });
    } else {
      start = buildBlankForm(routeType);
    }
    loadedForm.current = start;
    if (fromDraft) {
      const restored = formFromDraft(fromDraft, start.type);
      autosave.adopt({ id: fromDraft.id, revision: fromDraft.revision, content: restored });
      setForm(restored);
    } else {
      setForm(start);
      if (draftParam) {
        toast("That draft is no longer there — it may have been saved or deleted by someone else.", { duration: 6000 });
        setSearchParams({}, { replace: true });
      }
    }
  }, [form, isEdit, id, loadingAssessment, loadingCompetencies, loadingPathways, loadingInventory, assessment, linkedCompetencies, linkedPathways, linkedInventory, routeType, draftParam, openedDraft, openedDraftMissing, autosave, setSearchParams]);

  // Editing, with drafts of this assessment left from before: offer the newest back — only while
  // the form is still as it opened, so it never lands on top of new typing.
  const offeredDraft = isEdit && !draftParam && !draftOfferDone && form && isSameContent(form, loadedForm.current) ? assessmentDrafts.find((d) => d.id !== autosave.currentDraftId()) || null : null;

  async function restoreOfferedDraft() {
    const offered = offeredDraft;
    setDraftOfferDone(true);
    try {
      const full = await draftsApi.get(DRAFT_ENDPOINTS.assessments, offered.id);
      const restored = formFromDraft(full, form.type);
      autosave.adopt({ id: full.id, revision: full.revision, content: restored });
      setForm(restored);
      setSearchParams({ draft: full.id }, { replace: true });
    } catch (err) {
      toast.error(err.statusCode === 404 ? "That draft is no longer there — it may have been saved or deleted by someone else." : err.message || "Couldn't open the draft");
    }
  }

  useEffect(() => { document.title = "Assessment Builder"; }, []);

  useEffect(() => {
    const el = document.createElement("style");
    el.id = "ab-styles";
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => { document.getElementById("ab-styles")?.remove(); };
  }, []);

  if (!form) {
    return <div style={{ padding: "60px", textAlign: "center", color: "#9CA3AF" }}>Loading…</div>;
  }

  const type = form.type;
  // Teacher Observation authors real items (structured/unstructured) alongside indicators
  // (checklist/rating/etc, kept in `form.indicators`, scored by the teacher during grading) —
  // both backing arrays are presented to the Structure canvas as one merged, kind-agnostic list
  // and split back out by kind on every write. For every other assessment type `form.indicators`
  // stays permanently empty (defaultEntry never produces an observation-kind entry unless the
  // registry offers that group), so this is a total no-op there.
  const entries = [...form.items, ...form.indicators];
  const setEntries = (updater) => {
    setForm((f) => {
      const merged = [...f.items, ...f.indicators];
      const next = typeof updater === "function" ? updater(merged) : updater;
      return {
        ...f,
        items: next.filter((e) => !OBSERVATION_ITEM_KINDS.includes(e.kind)),
        indicators: next.filter((e) => OBSERVATION_ITEM_KINDS.includes(e.kind)),
      };
    });
  };
  const selectedEntry = entries.find((e) => e.id === selectedId) || null;

  function addSection() {
    const section = { id: genId(), name: `Section ${form.sections.length + 1}`, order: form.sections.length };
    setForm((f) => ({ ...f, sections: [...f.sections, section] }));
    setFocusedSectionId(section.id);
  }
  function renameSection(sectionId, name) {
    setForm((f) => ({ ...f, sections: f.sections.map((s) => (s.id === sectionId ? { ...s, name } : s)) }));
  }
  function deleteSection(sectionId) {
    setForm((f) => ({ ...f, sections: f.sections.filter((s) => s.id !== sectionId) }));
    setEntries((prev) => prev.map((e) => (e.sectionId === sectionId ? { ...e, sectionId: null } : e)));
    if (focusedSectionId === sectionId) setFocusedSectionId(null);
  }
  function moveSection(sectionId, dir) {
    setForm((f) => {
      const idx = f.sections.findIndex((s) => s.id === sectionId);
      const to = idx + dir;
      if (to < 0 || to >= f.sections.length) return f;
      const next = [...f.sections];
      [next[idx], next[to]] = [next[to], next[idx]];
      return { ...f, sections: next.map((s, i) => ({ ...s, order: i })) };
    });
  }

  function addEntry(kind) {
    let sectionId = focusedSectionId;
    if (!sectionId) {
      if (form.sections.length === 0) {
        const section = { id: genId(), name: "Section 1", order: 0 };
        setForm((f) => ({ ...f, sections: [section] }));
        sectionId = section.id;
      } else {
        sectionId = form.sections[0].id;
      }
      setFocusedSectionId(sectionId);
    }
    const entry = defaultEntry(kind, sectionId, form.type);
    setEntries((prev) => [...prev, entry]);
    setSelectedId(entry.id);
    setActiveTab("structure");
  }
  function updateEntry(updated) {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }
  function deleteEntry(entryId) {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    if (selectedId === entryId) setSelectedId(null);
  }
  function moveEntry(entryId, dir) {
    setEntries((prev) => {
      const entry = prev.find((e) => e.id === entryId);
      const siblings = prev.filter((e) => e.sectionId === entry.sectionId);
      const idx = siblings.findIndex((e) => e.id === entryId);
      const to = idx + dir;
      if (to < 0 || to >= siblings.length) return prev;
      const other = siblings[to];
      const posA = prev.findIndex((e) => e.id === entry.id);
      const posB = prev.findIndex((e) => e.id === other.id);
      const next = [...prev];
      [next[posA], next[posB]] = [next[posB], next[posA]];
      return next;
    });
  }

  function buildPayload() {
    const registry = BUILDER_REGISTRY[type];
    const payload = {
      name: form.name.trim(), type, description: form.description.trim(), instructions: form.instructions.trim(),
      structureType: form.structureType,
      sections: form.sections.map((s, i) => ({ ...s, order: i })),
    };
    if (registry?.supportsDeliverables) payload.overview = form.overview.trim();
    payload.items = registry?.supportsItems === false ? [] : form.items;
    // Editable via the Structure canvas for Teacher Observation (see entries/setEntries above);
    // stays permanently [] for every other type.
    payload.indicators = form.indicators;
    payload.rubric = registry?.supportsRubric ? form.rubric : [];
    if (registry?.supportsDeliverables) payload.deliverables = form.deliverables;
    if (registry?.supportsMilestones) payload.milestones = form.milestones;

    // Selling fields — only for a Project (the only sellable type; the backend guards this too).
    // Empty strings from the form's number/text inputs become null so the DB stores a clean
    // "not set" rather than 0 / "".
    if (type === "project") {
      const numOrNull = (v) => (v === "" || v == null ? null : Number(v));
      payload.saleStatus = form.saleStatus === "for_sale" ? "for_sale" : "internal";
      payload.coverImage = form.coverImage || null;
      payload.gallery = Array.isArray(form.gallery) ? form.gallery : [];
      payload.kitPriceAmount = numOrNull(form.kitPriceAmount);
      payload.priceAmount = numOrNull(form.priceAmount);
      payload.priceCurrency = (form.priceCurrency || "KES").trim();
      payload.priceNote = form.priceNote.trim();
      payload.saleLevel = form.saleLevel || null;
      payload.saleTagline = form.saleTagline.trim();
      payload.ageMin = numOrNull(form.ageMin);
      payload.ageMax = numOrNull(form.ageMax);
    }
    return payload;
  }

  async function reconcileTags(assessmentId) {
    const { competencyIds, pathwayIds, inventory } = form;
    if (isEdit) {
      const compToAdd = competencyIds.filter((cid) => !originalTags.competencyIds.includes(cid));
      const compToRemove = originalTags.competencyIds.filter((cid) => !competencyIds.includes(cid));
      const areaToAdd = pathwayIds.filter((aid) => !originalTags.pathwayIds.includes(aid));
      const areaToRemove = originalTags.pathwayIds.filter((aid) => !pathwayIds.includes(aid));
      const invIds = inventory.map((l) => l.itemId);
      const origInvIds = originalTags.inventory.map((l) => l.itemId);
      const invToRemove = origInvIds.filter((iid) => !invIds.includes(iid));
      const invToUpsert = inventory.filter((l) => {
        const original = originalTags.inventory.find((o) => o.itemId === l.itemId);
        return !original || original.quantity !== l.quantity;
      });
      await Promise.all([
        ...compToAdd.map((cid) => assessmentApi.linkCompetency(assessmentId, cid)),
        ...compToRemove.map((cid) => assessmentApi.unlinkCompetency(assessmentId, cid)),
        ...areaToAdd.map((aid) => assessmentApi.linkPathway(assessmentId, aid)),
        ...areaToRemove.map((aid) => assessmentApi.unlinkPathway(assessmentId, aid)),
        ...invToUpsert.map((l) => assessmentApi.linkInventoryItem(assessmentId, l.itemId, l.quantity)),
        ...invToRemove.map((iid) => assessmentApi.unlinkInventoryItem(assessmentId, iid)),
      ]);
    } else {
      await Promise.all([
        ...competencyIds.map((cid) => assessmentApi.linkCompetency(assessmentId, cid)),
        ...pathwayIds.map((aid) => assessmentApi.linkPathway(assessmentId, aid)),
        ...inventory.map((l) => assessmentApi.linkInventoryItem(assessmentId, l.itemId, l.quantity)),
      ]);
    }
  }

  function handleSave() {
    if (!form.name.trim()) { setActiveTab("info"); return; }
    const data = buildPayload();
    if (isEdit) {
      updateAssessment({ id, data }, { onSuccess: async () => { autosave.clear(); dropSeenDrafts(id); await reconcileTags(id); navigate(`/assessments/${id}/view`); } });
    } else {
      createAssessment(data, { onSuccess: async (created) => { autosave.clear(); await reconcileTags(created.id); navigate(`/assessments/${created.id}/view`); } });
    }
  }

  const isPending = creating || updating;
  const color = TYPE_COLORS[type];
  const tabs = [
    { key: "info", label: "Assessment Information" },
    ...(BUILDER_REGISTRY[type]?.supportsItems !== false ? [{ key: "structure", label: BUILDER_REGISTRY[type]?.canDoOnly ? "Can-do Checks" : "Structure & Items" }] : []),
    ...(BUILDER_REGISTRY[type]?.supportsRubric ? [{ key: "rubric", label: "Grading Rubric" }] : []),
    ...(BUILDER_REGISTRY[type]?.supportsDeliverables ? [{ key: "deliverables", label: "Deliverables & Milestones" }] : []),
    ...(BUILDER_REGISTRY[type]?.supportsInventory ? [{ key: "inventory", label: "Materials" }] : []),
  ];

  return (
    <div className="tb-page">
      <div className="tb-header">
        <div>
          <p className="tb-crumb"><a onClick={() => navigate("/assessments")}>Assessments</a> / {isEdit ? "Edit Assessment" : "Create New Assessment"}</p>
          <div className="tb-title-row">
            <div className="tb-title-icon" style={{ backgroundColor: `${color}15`, color }}>{TYPE_ICONS[type]}</div>
            <div className="tb-title-text">
              <h1 className="tb-title">{TYPE_LABELS[type]} Assessment</h1>
              <p className="tb-subtitle">Build a {TYPE_LABELS[type].toLowerCase()} assessment. Add sections and items of any type.</p>
            </div>
          </div>
        </div>
        <div className="tb-actions">
          <WorkspaceDraftNote status={autosave.status} style={{ alignSelf: "center" }} />
          <button type="button" className="tb-btn-secondary" onClick={() => setPreviewOpen(true)}>Preview Assessment</button>
          <button type="button" className="tb-btn-primary" onClick={handleSave} disabled={isPending}>{isPending ? "Saving…" : "Save Assessment"}</button>
        </div>
      </div>

      <div className="tb-body">
        <div className="tb-body-content">
          <div className="tb-tabs">
            {tabs.map((tab) => (
              <button key={tab.key} type="button" className={`tb-tab-btn${activeTab === tab.key ? " active" : ""}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>
            ))}
          </div>

          {activeTab === "info" && (
            <div className="tb-two-col">
              <div className="tb-card">
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <Label>Assessment Name *</Label>
                    <input className="tb-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Mid-term Mathematics Exam" />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <RichTextEditor value={form.description} onChange={(html) => setForm((f) => ({ ...f, description: html }))} />
                  </div>
                  <div>
                    <Label>Default Instructions</Label>
                    <RichTextEditor value={form.instructions} onChange={(html) => setForm((f) => ({ ...f, instructions: html }))} />
                  </div>
                  {BUILDER_REGISTRY[type]?.supportsDeliverables && (
                    <div>
                      <Label>Project Overview</Label>
                      <RichTextEditor value={form.overview} onChange={(html) => setForm((f) => ({ ...f, overview: html }))} />
                    </div>
                  )}
                  <div>
                    <Label>Structure Type</Label>
                    <SegmentedControl options={STRUCTURE_MODES} value={form.structureType} onChange={(v) => setForm((f) => ({ ...f, structureType: v }))} />
                  </div>
                  <div>
                    <Label>Competencies</Label>
                    <TagPicker
                      label="Competency" items={allCompetencies} selectedIds={form.competencyIds}
                      onChange={(ids) => setForm((f) => ({ ...f, competencyIds: ids }))}
                      onCreateNew={canAddToCatalog ? () => setCreateCompetencyOpen(true) : undefined}
                    />
                  </div>
                  {isEdit && (
                    <div>
                      <Label>Pathways</Label>
                      <TagPicker
                        label="Pathway" items={allPathways} selectedIds={form.pathwayIds}
                        onChange={(ids) => setForm((f) => ({ ...f, pathwayIds: ids }))}
                        onCreateNew={canAddToCatalog ? () => setCreatePathwayOpen(true) : undefined}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
                {type === "project" && <SellingPanel form={form} setForm={setForm} />}
                <SummaryCard form={form} />
              </div>
            </div>
          )}

          {activeTab === "structure" && (
            <>
              <div className="tb-workspace">
                <ItemPalette type={type} structureType={form.structureType} onAdd={addEntry} />
                <StructureCanvas
                  type={type} sections={form.sections} entries={entries}
                  focusedSectionId={focusedSectionId} selectedId={selectedId}
                  onFocusSection={setFocusedSectionId} onSelect={setSelectedId}
                  onAddSection={addSection} onRenameSection={renameSection} onDeleteSection={deleteSection}
                  onDeleteEntry={deleteEntry} onMoveEntry={moveEntry} onMoveSection={moveSection}
                />
                <RightPanel form={form} selectedEntry={selectedEntry} onUpdateEntry={updateEntry} indicatorOptions={indicatorOptions} />
              </div>
              <IndicatorStatsPanel stats={indicatorStats} />
            </>
          )}

          {activeTab === "rubric" && (
            <div className="tb-two-col">
              <GradingRubricTab type={type} rubric={form.rubric} onChange={(v) => setForm((f) => ({ ...f, rubric: v }))} indicatorOptions={indicatorOptions} />
              <SummaryCard form={form} />
            </div>
          )}

          {activeTab === "deliverables" && (
            <DeliverablesMilestonesTab
              deliverables={form.deliverables} milestones={form.milestones}
              onChangeDeliverables={(v) => setForm((f) => ({ ...f, deliverables: v }))}
              onChangeMilestones={(v) => setForm((f) => ({ ...f, milestones: v }))}
            />
          )}

          {activeTab === "inventory" && (
            <InventoryTab
              inventory={form.inventory} catalog={allInventory}
              onChange={(v) => setForm((f) => ({ ...f, inventory: v }))}
              onCreateNew={canAddToCatalog ? () => setCreateInventoryOpen(true) : undefined}
            />
          )}
        </div>
      </div>

      {previewOpen && <PreviewModal form={form} entries={entries} onClose={() => setPreviewOpen(false)} />}
      {createCompetencyOpen && (
        <CreateCompetencyModal
          onClose={() => setCreateCompetencyOpen(false)}
          onCreated={(id) => setForm((f) => ({ ...f, competencyIds: [...f.competencyIds, id] }))}
        />
      )}
      {isEdit && createPathwayOpen && (
        <CreatePathwayModal
          onClose={() => setCreatePathwayOpen(false)}
          onCreated={(id) => setForm((f) => ({ ...f, pathwayIds: [...f.pathwayIds, id] }))}
        />
      )}
      {createInventoryOpen && (
        <CreateInventoryItemModal
          onClose={() => setCreateInventoryOpen(false)}
          onCreated={(itemId) => setForm((f) => ({ ...f, inventory: [...f.inventory, { itemId, quantity: 1 }] }))}
        />
      )}
      <DraftRestoreDialog
        draft={offeredDraft}
        recordUpdatedAt={assessment?.updatedAt ?? null}
        otherCount={Math.max(0, assessmentDrafts.length - 1)}
        listedOn="the Assessments page"
        what="assessment"
        onRestore={restoreOfferedDraft}
        onDiscard={() => { setDraftOfferDone(true); deleteDraft(offeredDraft.id); }}
        onDismiss={() => setDraftOfferDone(true)}
      />
    </div>
  );
}
