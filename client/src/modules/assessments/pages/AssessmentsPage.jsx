import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiAlertTriangle, FiBarChart2, FiBookOpen, FiChevronRight, FiClipboard, FiEdit2, FiEye, FiFileText, FiFolder, FiFolderPlus, FiMoreVertical, FiPlus, FiSearch, FiTrash2, FiUsers } from "react-icons/fi";
import { useAssessmentsQuery, useDeleteAssessment, useAssessmentFoldersQuery, useAssessmentFolderMutation } from "../hooks/useAssessment";
import { assessmentApi } from "../services/assessmentApi";
import { AddItemsDialog, FolderDialog, FolderTile, MoveToFolderDialog, NewFolderTile } from "../../../components/folders/Folders";
import { useDraftsQuery, useDeleteDraft, DRAFT_ENDPOINTS } from "../../../hooks/useDrafts";
import DraftCard from "../../../components/ui/DraftCard";
import { ASSESSMENT_TYPES, entryMarks, roundMarks } from "../schemas/assessment.schema";
import { stripHtml } from "../components/RichContent";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const TYPE_LABELS = { quiz: "Quiz", exam: "Exam", project: "Project", assignment: "Assignment", observation: "Teacher Observation", survey: "Survey" };
const TYPE_ICONS = { quiz: FiFileText, exam: FiBookOpen, project: FiClipboard, assignment: FiFileText, observation: FiEye, survey: FiBarChart2 };
// What the shared folder pieces call the records filed on this page.
const FOLDER_NOUN = { one: "assessment", many: "assessments", example: "e.g. End-of-term quizzes for Grade 5" };
const TYPE_COLORS = { quiz: "#25476a", exam: "#38aae1", project: "#7C3AED", assignment: "#059669", observation: "#D97706", survey: "#0891B2" };

/* ── content summary (shared shape with the Builder) ─────────────────────── */

function assessmentContentSummary(assessment) {
  if (assessment.type === "quiz" || assessment.type === "exam" || assessment.type === "survey") {
    const n = assessment.items?.length || 0;
    return `${n} question${n !== 1 ? "s" : ""}`;
  }
  if (assessment.type === "assignment" || assessment.type === "project") {
    const parts = [];
    const taskCount = assessment.items?.length || 0;
    if (taskCount > 0) parts.push(`${taskCount} task${taskCount !== 1 ? "s" : ""}`);
    const criteriaCount = assessment.rubric?.length || 0;
    if (criteriaCount > 0) parts.push(`${criteriaCount} criteri${criteriaCount !== 1 ? "a" : "on"}`);
    const deliverableCount = assessment.deliverables?.length || 0;
    if (deliverableCount > 0) parts.push(`${deliverableCount} deliverable${deliverableCount !== 1 ? "s" : ""}`);
    return parts.length ? parts.join(" · ") : "0 tasks";
  }
  const n = assessment.indicators?.length || 0;
  const parts = [`${n} indicator${n !== 1 ? "s" : ""}`];
  const criteriaCount = assessment.rubric?.length || 0;
  if (criteriaCount > 0) parts.push(`${criteriaCount} criteri${criteriaCount !== 1 ? "a" : "on"}`);
  return parts.join(" · ");
}

function assessmentTotalPoints(assessment) {
  // A survey is never scored (see server's grading.utils.js) — no points total to show at all,
  // same "null" contract as any other type this function doesn't recognize.
  if (assessment.type === "survey") return null;
  if (assessment.type === "quiz" || assessment.type === "exam") {
    return roundMarks(assessment.items?.reduce((sum, i) => sum + entryMarks(i), 0) ?? 0);
  }
  if (assessment.type === "assignment" || assessment.type === "project" || assessment.type === "observation") {
    const itemsPoints = assessment.items?.reduce((sum, i) => sum + entryMarks(i), 0) || 0;
    const rubricPoints = assessment.rubric?.reduce((sum, c) => sum + entryMarks(c), 0) || 0;
    return roundMarks(itemsPoints + rubricPoints);
  }
  return null;
}

/* ── New Assessment type-picker menu ─────────────────────────────────────── */

function NewAssessmentMenu({ onPick }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const openMenu = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!triggerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 22px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(254,177,57,0.35)", whiteSpace: "nowrap" }}
      >
        <FiPlus size={16} strokeWidth={2.2} />
        Add Assessment
      </button>
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999, background: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px", boxShadow: "0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)", minWidth: "190px", padding: "6px" }}
        >
          {Object.entries(TYPE_LABELS).map(([t, label]) => (
            <button
              key={t} type="button" onClick={() => { setOpen(false); onPick(t); }}
              style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "9px 10px", border: "none", borderRadius: "8px", background: "transparent", fontSize: "12.5px", fontWeight: "600", fontFamily: "Inter, sans-serif", color: "#374151", textAlign: "left", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#F3F4F6"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: TYPE_COLORS[t], flexShrink: 0 }} />
              {label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

function TypeBadge({ type }) {
  return (
    <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: "#fff8e6", color: "#b07800", border: "1px solid #fcd97a" }}>
      {TYPE_LABELS[type] || type}
    </span>
  );
}

// Shown on a project assessment that's flipped "for sale" in the builder — mirrors the
// green "PUBLIC" pill on a public-diagnostic pathway.
function ForSaleBadge() {
  return (
    <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "10.5px", fontWeight: "800", letterSpacing: "0.03em", backgroundColor: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0" }}>
      FOR SALE
    </span>
  );
}

function MenuButton({ icon, label, onClick, danger = false }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "8px 10px",
        backgroundColor: hovered ? (danger ? "#FFF5F5" : "#F3F4F6") : "transparent",
        border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "500", fontFamily: "Inter, sans-serif",
        color: hovered ? (danger ? "#EF4444" : "#25476a") : (danger ? "#EF4444" : "#374151"),
        cursor: "pointer", textAlign: "left", transition: "background-color 0.12s, color 0.12s",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", flexShrink: 0, opacity: 0.8 }}>{icon}</span>
      {label}
    </button>
  );
}

// `onMove` opens "Move to folder"; `folderName` (search results only) names the folder it's in.
function AssessmentCard({ assessment, onMove, folderName }) {
  const navigate = useNavigate();
  const { mutate: deleteAssessment, isPending: isDeleting } = useDeleteAssessment();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [hovered, setHovered] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const summary = assessmentContentSummary(assessment);
  const totalPoints = assessmentTotalPoints(assessment);

  const openMenu = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (e) => {
      if (!triggerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [menuOpen]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "#ffffff", borderRadius: "16px",
        boxShadow: hovered ? "0 8px 24px rgba(37,71,106,0.12), 0 2px 6px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        transition: "box-shadow 0.2s, transform 0.2s, opacity 0.2s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        opacity: isDeleting ? 0.5 : 1, pointerEvents: isDeleting ? "none" : "auto",
      }}
    >
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg, #1a3550, #25476a)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff" }}>
            {(() => {
              const Icon = TYPE_ICONS[assessment.type] || FiClipboard;
              return <Icon size={20} strokeWidth={1.9} />;
            })()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
              <h3
                onClick={() => navigate(`/assessments/${assessment.id}/view`)}
                style={{ margin: "0 0 3px 0", fontSize: "15px", fontWeight: "700", color: hovered ? "#25476a" : "#111827", cursor: "pointer", transition: "color 0.15s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {assessment.name}
              </h3>
              <button
                ref={triggerRef}
                type="button"
                onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
                title="More options"
                style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: menuOpen ? "#e8f5fb" : "transparent", border: `1.5px solid ${menuOpen ? "#b8d9ee" : "transparent"}`, borderRadius: "8px", cursor: "pointer", color: menuOpen ? "#25476a" : "#9CA3AF", transition: "all 0.15s", flexShrink: 0 }}
              >
                <FiMoreVertical size={14} strokeWidth={2} />
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <TypeBadge type={assessment.type} />
              {assessment.saleStatus === "for_sale" && <ForSaleBadge />}
              <span style={{ fontSize: "11.5px", color: "#9CA3AF" }}>{summary}{totalPoints ? ` · ${totalPoints} pts` : ""}</span>
            </div>
            {folderName && (
              <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11.5px", color: "#6B7280", marginTop: "5px" }}>
                <FiFolder size={12} /> {folderName}
              </div>
            )}
          </div>
        </div>

        <p style={{
          margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: "1.6",
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {stripHtml(assessment.description) || <span style={{ fontStyle: "italic", color: "#D1D5DB" }}>No description added</span>}
        </p>
      </div>

      <div style={{ padding: "10px 20px", borderTop: "1px solid #F3F4F6", backgroundColor: "#FAFBFF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={() => navigate(`/assessments/${assessment.id}/view`)}
          style={{ background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#38aae1", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0, display: "flex", alignItems: "center", gap: "4px" }}
        >
          View
          <FiChevronRight size={12} strokeWidth={2.5} />
        </button>
      </div>

      {menuOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: menuPos.top, right: menuPos.right, backgroundColor: "#ffffff", border: "1px solid #E5E7EB", borderRadius: "14px", boxShadow: "0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)", zIndex: 9999, minWidth: "180px", overflow: "hidden", padding: "6px" }}
        >
          <MenuButton
            icon={<FiEye size={14} strokeWidth={2} />}
            label="View"
            onClick={() => { setMenuOpen(false); navigate(`/assessments/${assessment.id}/view`); }}
          />
          <MenuButton
            icon={<FiEdit2 size={14} strokeWidth={2} />}
            label="Edit"
            onClick={() => { setMenuOpen(false); navigate(`/assessments/${assessment.id}/edit`); }}
          />
          {onMove && (
            <MenuButton
              icon={<FiFolder size={14} strokeWidth={2} />}
              label={assessment.folderId ? "Move to folder" : "Add to folder"}
              onClick={() => { setMenuOpen(false); onMove(assessment); }}
            />
          )}
          <div style={{ height: "1px", backgroundColor: "#F3F4F6", margin: "4px 0" }} />
          <MenuButton
            icon={<FiTrash2 size={14} strokeWidth={2} />}
            label="Delete"
            onClick={() => { setMenuOpen(false); setConfirmOpen(true); }}
            danger
          />
        </div>,
        document.body
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Assessment"
        message={`"${assessment.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); deleteAssessment(assessment.id); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

/* ── Unsaved drafts (kept by the builder until Save — see hooks/useWorkspaceDraft.js) ── */

function AssessmentDraftCard({ draft, onDelete }) {
  const navigate = useNavigate();
  const title = draft.name || `Untitled ${(TYPE_LABELS[draft.type] || "assessment").toLowerCase()}`;
  return (
    <DraftCard
      draft={draft}
      title={title}
      untitled={!draft.name}
      subtitle={draft.recordId ? `Changes to “${draft.recordName || "an assessment"}”, not saved yet` : "New assessment, not saved yet"}
      Icon={TYPE_ICONS[draft.type] || FiClipboard}
      badges={<TypeBadge type={draft.type} />}
      onOpen={() => navigate(draft.recordId ? `/assessments/${draft.recordId}/edit?draft=${draft.id}` : `/assessments/new/${draft.type}?draft=${draft.id}`)}
      onDelete={() => onDelete(draft.id)}
    />
  );
}

function EmptyState({ onCreateNew }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px", backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ width: "72px", height: "72px", borderRadius: "18px", background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", color: "#25476a", margin: "0 auto 20px" }}>
        <FiClipboard size={32} strokeWidth={1.8} />
      </div>
      <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#111827" }}>No assessments yet</h3>
      <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6B7280", lineHeight: "1.6" }}>Create your first assessment to get started.</p>
      <NewAssessmentMenu onPick={onCreateNew} />
    </div>
  );
}

// Assessments can be filed into folders (?folder=<id> opens one), like courses on the Courses page.
// The top level shows the folders and the assessments that aren't in any; a search always looks
// through every assessment, wherever it's filed.
export default function AssessmentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, isError, error } = useAssessmentsQuery();
  const { data: folderRows } = useAssessmentFoldersQuery();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const assessments = useMemo(() => data?.data || [], [data]);
  const folders = useMemo(() => (Array.isArray(folderRows) ? folderRows : []), [folderRows]);
  // Unsaved work from the builder, shown as cards ahead of the assessments.
  const { data: drafts = [] } = useDraftsQuery(DRAFT_ENDPOINTS.assessments);
  const { mutate: deleteDraft } = useDeleteDraft(DRAFT_ENDPOINTS.assessments);
  const onlyDrafts = typeFilter === "unsaved";

  // Folder dialogs: { kind: "new" | "rename" | "add" | "move" | "delete", folder?, assessment? }.
  const [dialog, setDialog] = useState(null);
  const closeDialog = () => setDialog(null);
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const openFolderId = searchParams.get("folder");
  const openFolder = openFolderId ? folderById.get(openFolderId) || null : null;
  const openFolderAt = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("folder", id); else next.delete("folder");
    setSearchParams(next);
  };

  const createFolder = useAssessmentFolderMutation(assessmentApi.createFolder, (folder) => `Folder “${folder.name}” created`, "Could not create the folder");
  const updateFolder = useAssessmentFolderMutation(({ id, data: changes }) => assessmentApi.updateFolder(id, changes), "Folder saved", "Could not save the folder");
  const deleteFolder = useAssessmentFolderMutation(assessmentApi.deleteFolder, "Folder deleted — its assessments are still in Assessments", "Could not delete the folder");
  const addToFolder = useAssessmentFolderMutation(({ id, assessmentIds }) => assessmentApi.addAssessmentsToFolder(id, assessmentIds), ({ moved }) => `${moved} assessment${moved === 1 ? "" : "s"} added`, "Could not add the assessments");
  const moveAssessment = useAssessmentFolderMutation(
    ({ assessment, folderId }) => (folderId ? assessmentApi.addAssessmentsToFolder(folderId, [assessment.id]) : assessmentApi.removeAssessmentFromFolder(assessment.folderId, assessment.id)),
    (_, { folderId }) => (folderId ? `Moved to “${folderById.get(folderId)?.name || "the folder"}”` : "Taken out of the folder"),
    "Could not move the assessment",
  );

  const query = search.trim().toLowerCase();
  // Which assessments this view is about: everything while searching, else the open folder's, else
  // the ones not in a folder (one whose folder has gone counts as not in one).
  const scopeAssessments = useMemo(() => {
    if (query) return assessments;
    if (openFolder) return assessments.filter((a) => a.folderId === openFolder.id);
    return assessments.filter((a) => !a.folderId || !folderById.has(a.folderId));
  }, [assessments, query, openFolder, folderById]);
  const showFolders = !openFolder && !query && !onlyDrafts;

  // Drafts have no folder of their own: they show at the top level and in search results.
  const visibleDrafts = useMemo(() => {
    if (openFolder && !query) return [];
    return drafts.filter((d) => {
      const matchesSearch = !query || [d.name, d.recordName].some((text) => (text || "").toLowerCase().includes(query));
      const matchesType = !typeFilter || onlyDrafts || d.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [drafts, query, typeFilter, onlyDrafts, openFolder]);

  const visibleAssessments = useMemo(() => {
    if (onlyDrafts) return [];
    return scopeAssessments.filter((a) => {
      const matchesSearch = !query
        || a.name.toLowerCase().includes(query)
        || (a.description || "").toLowerCase().includes(query);
      const matchesType = !typeFilter || a.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [scopeAssessments, query, typeFilter, onlyDrafts]);

  const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" };
  const outlineBtn = { display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 14px", backgroundColor: "#fff", color: "#25476a", border: "1.5px solid #D6E4EF", borderRadius: "10px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", position: "relative", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
              Assessments
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "480px" }}>
              Create and manage assessments — quizzes, assignments, projects, and teacher observations — and group them into folders.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setDialog({ kind: "new" })}
              style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 18px", backgroundColor: "rgba(255,255,255,0.14)", color: "#fff", border: "1px solid rgba(255,255,255,0.35)", borderRadius: "12px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              <FiFolderPlus size={16} /> New Folder
            </button>
            <NewAssessmentMenu onPick={(t) => navigate(`/assessments/new/${t}`)} />
          </div>
        </div>
      </div>

      <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", backgroundColor: "#fff", border: "1.5px solid #E5E7EB", borderRadius: "14px", padding: "0 14px", marginBottom: "18px", maxWidth: "100%", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "220px", maxWidth: "100%" }}>
          <FiSearch size={14} style={{ color: "#9CA3AF", flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all assessments..."
            style={{ border: "none", outline: "none", background: "transparent", fontSize: "13px", fontFamily: "Inter, sans-serif", color: "#374151", padding: "10px 0", width: "100%", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ width: "1px", height: "20px", backgroundColor: "#E5E7EB", flexShrink: 0 }} />

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ border: "none", outline: "none", background: "transparent", fontSize: "13px", fontFamily: "Inter, sans-serif", color: "#374151", cursor: "pointer", padding: "10px 2px", width: "130px" }}
        >
          <option value="">All Types</option>
          {ASSESSMENT_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
          <option value="unsaved">Unsaved drafts</option>
        </select>

        {(search || typeFilter) && (
          <>
            <div style={{ width: "1px", height: "20px", backgroundColor: "#E5E7EB", flexShrink: 0 }} />
            <button
              type="button"
              onClick={() => { setSearch(""); setTypeFilter(""); }}
              style={{ background: "none", border: "none", color: "#38aae1", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: "6px 2px", whiteSpace: "nowrap" }}
            >
              Clear
            </button>
          </>
        )}

        {(assessments.length > 0 || drafts.length > 0) && (
          <>
            <div style={{ width: "1px", height: "20px", backgroundColor: "#E5E7EB", flexShrink: 0 }} />
            <div style={{ fontSize: "12px", color: "#9CA3AF", whiteSpace: "nowrap", padding: "10px 0" }}>
              {onlyDrafts
                ? `${visibleDrafts.length} unsaved draft${visibleDrafts.length !== 1 ? "s" : ""}`
                : `${visibleAssessments.length} of ${scopeAssessments.length}${openFolder && !query ? " in this folder" : showFolders && folders.length ? " not in a folder" : ""}`}
              {showFolders && folders.length > 0 && ` · ${folders.length} folder${folders.length !== 1 ? "s" : ""}`}
              {!onlyDrafts && drafts.length > 0 && <span style={{ color: "#9A6700" }}>{` · ${drafts.length} unsaved draft${drafts.length !== 1 ? "s" : ""}`}</span>}
            </div>
          </>
        )}
      </div>

      {/* Inside a folder: where you are, and what you can do with the folder. */}
      {openFolder && !query && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", minWidth: 0 }}>
            <button type="button" onClick={() => openFolderAt(null)} style={{ border: "none", background: "none", padding: 0, color: "#2e7db5", fontWeight: "600", fontSize: "14px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>All assessments</button>
            <FiChevronRight size={14} style={{ color: "#9CA3AF" }} />
            <FiFolder size={16} style={{ color: openFolder.color || "#25476a", flexShrink: 0 }} />
            <strong style={{ color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{openFolder.name}</strong>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" onClick={() => setDialog({ kind: "add", folder: openFolder })} style={{ ...outlineBtn, backgroundColor: "#25476a", color: "#fff", borderColor: "#25476a" }}><FiPlus size={14} /> Add assessments</button>
            <button type="button" onClick={() => setDialog({ kind: "rename", folder: openFolder })} style={outlineBtn}><FiEdit2 size={13} /> Edit folder</button>
            <button type="button" onClick={() => setDialog({ kind: "delete", folder: openFolder })} style={{ ...outlineBtn, color: "#EF4444", borderColor: "#FECACA" }}><FiTrash2 size={13} /> Delete folder</button>
          </div>
        </div>
      )}

      {openFolder && !query && openFolder.description && (
        <p style={{ margin: "-6px 0 16px", fontSize: "13.5px", color: "#4B5563", lineHeight: 1.6, maxWidth: "760px", whiteSpace: "pre-wrap" }}>{openFolder.description}</p>
      )}

      {showFolders && !isLoading && !isError && (folders.length > 0 || assessments.length > 0) && (
        <div style={{ ...gridStyle, marginBottom: "24px" }}>
          {folders.map((folder) => (
            <FolderTile
              key={folder.id}
              folder={folder}
              noun={FOLDER_NOUN}
              onOpen={() => openFolderAt(folder.id)}
              onMenu={(action) => setDialog({ kind: action === "rename" ? "rename" : "delete", folder })}
            />
          ))}
          <NewFolderTile onClick={() => setDialog({ kind: "new" })} />
        </div>
      )}

      {isLoading ? (
        <div style={gridStyle}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ backgroundColor: "#ffffff", borderRadius: "16px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: "#e8f5fb" }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ height: "15px", width: "55%", backgroundColor: "#EEF2F7", borderRadius: "5px" }} />
                    <div style={{ height: "11px", width: "35%", backgroundColor: "#F3F4F6", borderRadius: "5px" }} />
                  </div>
                </div>
                <div style={{ height: "40px", backgroundColor: "#F9FAFB", borderRadius: "10px" }} />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div style={{ padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px", display: "flex", alignItems: "center", gap: 8 }}>
          <FiAlertTriangle size={15} /> Failed to load assessments: {error?.message}
        </div>
      ) : assessments.length === 0 && drafts.length === 0 ? (
        <EmptyState onCreateNew={(t) => navigate(`/assessments/new/${t}`)} />
      ) : openFolder && !query && scopeAssessments.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", backgroundColor: "#fff", borderRadius: "16px", border: "1.5px dashed #D6E4EF" }}>
          <FiFolder size={30} style={{ color: openFolder.color || "#25476a", marginBottom: 10 }} />
          <p style={{ margin: "0 0 16px", color: "#6B7280", fontSize: "14px" }}>This folder is empty.</p>
          <button type="button" onClick={() => setDialog({ kind: "add", folder: openFolder })} style={{ ...outlineBtn, backgroundColor: "#25476a", color: "#fff", borderColor: "#25476a" }}><FiPlus size={14} /> Add assessments</button>
        </div>
      ) : visibleAssessments.length === 0 && visibleDrafts.length === 0 && showFolders && folders.length > 0 && !typeFilter ? (
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#9CA3AF", textAlign: "center" }}>Every assessment is in a folder — open one above.</p>
      ) : visibleAssessments.length === 0 && visibleDrafts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", backgroundColor: "#fff", borderRadius: "16px", border: "1.5px solid #E5E7EB", color: "#9CA3AF", fontSize: "14px" }}>
          {onlyDrafts && !search
            ? "No unsaved drafts."
            : <>No {onlyDrafts ? "unsaved drafts" : "assessments"} match your search{search ? ` "${search}"` : ""}{typeFilter && !onlyDrafts ? ` in ${TYPE_LABELS[typeFilter]}` : ""}.</>}
        </div>
      ) : (
        <>
          {showFolders && folders.length > 0 && visibleAssessments.length > 0 && (
            <h2 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: "700", color: "#374151" }}>Not in a folder</h2>
          )}
          <div style={gridStyle}>
            {visibleDrafts.map((draft) => (
              <AssessmentDraftCard key={draft.id} draft={draft} onDelete={deleteDraft} />
            ))}
            {visibleAssessments.map((assessment) => (
              <AssessmentCard
                key={assessment.id}
                assessment={assessment}
                onMove={(a) => setDialog({ kind: "move", assessment: a })}
                folderName={query && assessment.folderId ? folderById.get(assessment.folderId)?.name : undefined}
              />
            ))}
          </div>
        </>
      )}

      {(dialog?.kind === "new" || dialog?.kind === "rename") && (
        <FolderDialog
          folder={dialog.kind === "rename" ? dialog.folder : null}
          noun={FOLDER_NOUN}
          saving={createFolder.isPending || updateFolder.isPending}
          onClose={closeDialog}
          onSave={(values) => {
            if (dialog.kind === "rename") {
              updateFolder.mutate({ id: dialog.folder.id, data: values }, { onSuccess: closeDialog });
            } else {
              // Made from "Move to folder": the assessment goes straight into the new folder.
              const assessment = dialog.assessment;
              createFolder.mutate(values, {
                onSuccess: (folder) => {
                  closeDialog();
                  if (assessment) moveAssessment.mutate({ assessment, folderId: folder.id });
                },
              });
            }
          }}
        />
      )}
      {dialog?.kind === "add" && (
        <AddItemsDialog
          folder={dialog.folder}
          items={assessments}
          folders={folders}
          noun={FOLDER_NOUN}
          detail={(a) => TYPE_LABELS[a.type] || a.type}
          saving={addToFolder.isPending}
          onClose={closeDialog}
          onAdd={(assessmentIds) => addToFolder.mutate({ id: dialog.folder.id, assessmentIds }, { onSuccess: closeDialog })}
        />
      )}
      {dialog?.kind === "move" && (
        <MoveToFolderDialog
          item={dialog.assessment}
          folders={folders}
          saving={moveAssessment.isPending}
          onClose={closeDialog}
          onNewFolder={() => setDialog({ kind: "new", assessment: dialog.assessment })}
          onMove={(folderId) => moveAssessment.mutate({ assessment: dialog.assessment, folderId }, { onSuccess: closeDialog })}
        />
      )}
      <ConfirmDialog
        isOpen={dialog?.kind === "delete"}
        title="Delete folder"
        message={dialog?.kind === "delete" ? `Delete the folder “${dialog.folder.name}”? Its ${dialog.folder.itemCount} assessment${dialog.folder.itemCount === 1 ? "" : "s"} won't be deleted — they'll show in Assessments outside any folder.` : ""}
        confirmLabel="Delete folder"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          const folder = dialog.folder;
          closeDialog();
          deleteFolder.mutate(folder.id, { onSuccess: () => { if (openFolderId === folder.id) openFolderAt(null); } });
        }}
        onCancel={closeDialog}
      />
    </div>
  );
}
