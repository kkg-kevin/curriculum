import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCourseQuery,
  useSessions,
  useCreateSession,
  useCreateSessionsBulk,
  useUpdateSession,
  useDeleteSession,
  useCourseCompetencies,
  useCourseLearningAreas,
  useModules,
  useCreateModule,
  useUpdateModule,
  useDeleteModule,
} from "../hooks/useCourse";
import { useAssessmentsQuery } from "../../assessments/hooks/useAssessment";
import { sessionSchema } from "../schemas/session.schema";
import SessionForm from "../components/SessionForm";
import AddModuleModal from "../components/AddModuleModal";
import RichContent from "../components/RichContent";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { SECTIONS, sessionLabel, sectionLinkPath } from "../sectionConfig";

const ASM_TYPE_LABELS = { quiz: "Quiz", exam: "Exam", assignment: "Assignment", project: "Project", observation: "Teacher Observation" };
const ASM_TYPE_COLORS = { quiz: "#25476a", exam: "#38aae1", assignment: "#059669", project: "#7C3AED", observation: "#D97706" };

function formatAgeRange(min, max) {
  if (min == null && max == null) return null;
  if (min != null && max != null) return min === max ? `${min}` : `${min}–${max}`;
  return min != null ? `${min}+` : `Up to ${max}`;
}

const SESSION_DEFAULT_VALUES = {
  title: "",
  moduleId: null,
  outcomes: [],
  introduction: "",
  mainConcepts: [],
  activities: [],
  assessmentIds: [],
  notes: [],
  resources: [],
};

// A blank session always has at least one editable block per repeatable section, even if none was saved yet.
const defaultMainConcepts = () => [{ id: crypto.randomUUID(), title: "Introduction", content: "" }];
const defaultActivities = () => [{ id: crypto.randomUUID(), title: "", content: "" }];
const defaultNotes = () => [{ id: crypto.randomUUID(), title: "", content: "" }];

function SectionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 6h13M3 12h13M3 18h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="20" cy="6" r="1.2" fill="currentColor"/>
      <circle cx="20" cy="12" r="1.2" fill="currentColor"/>
      <circle cx="20" cy="18" r="1.2" fill="currentColor"/>
    </svg>
  );
}

function ChevronDown({ open }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ── Session content editor modal — cycles through every session in the course, auto-saving on Prev/Next/Close ── */

function NavArrow({ direction }) {
  const points = direction === "prev" ? "15 18 9 12 15 6" : "9 18 15 12 9 6";
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <polyline points={points} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SessionModal({ courseId, sessions, modules, startSessionId, onClose }) {
  const { mutate: updateSession, isPending: saving } = useUpdateSession(courseId);
  const [currentId, setCurrentId] = useState(startSessionId);

  const index = sessions.findIndex((s) => s.id === currentId);
  const current = index !== -1 ? sessions[index] : null;

  const methods = useForm({
    resolver: zodResolver(sessionSchema),
    defaultValues: SESSION_DEFAULT_VALUES,
    mode: "onTouched",
  });

  const { reset, getValues } = methods;

  useEffect(() => {
    if (current) {
      reset({
        title: current.title || "",
        moduleId: current.moduleId || null,
        outcomes: current.outcomes || [],
        introduction: current.introduction || "",
        mainConcepts: current.mainConcepts?.length ? current.mainConcepts : defaultMainConcepts(),
        activities: current.activities?.length ? current.activities : defaultActivities(),
        assessmentIds: current.assessmentIds || [],
        notes: current.notes?.length ? current.notes : defaultNotes(),
        resources: current.resources || [],
      });
    }
    // `current` is looked up from the `sessions` prop, which can still be the pre-creation
    // list on first render right after "+ Add Session" (query invalidation hasn't resolved
    // yet) — `current` is then undefined and this effect's guard skips the reset entirely.
    // Re-running once `current` flips from falsy to truthy for the same currentId (not on
    // every later re-render) catches that late arrival without re-resetting on unrelated
    // background refetches, which would otherwise wipe in-progress unsaved edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, Boolean(current)]);

  const saveCurrent = () => {
    if (!current) return;
    updateSession({ id: current.id, data: getValues() });
  };

  const goTo = (targetId) => {
    saveCurrent();
    setCurrentId(targetId);
  };

  const handleClose = () => {
    saveCurrent();
    onClose();
  };

  const canPrev = index > 0;
  const canNext = index !== -1 && index < sessions.length - 1;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,38,69,0.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}>
      <div style={{ background: "#F3F4F6", borderRadius: "16px", width: "100%", maxWidth: "1080px", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: "16px 16px 0 0", borderBottom: "1px solid #E5E7EB" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              onClick={() => canPrev && goTo(sessions[index - 1].id)}
              disabled={!canPrev}
              title="Previous session"
              style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: "8px", color: canPrev ? "#25476a" : "#D1D5DB", cursor: canPrev ? "pointer" : "not-allowed" }}
            >
              <NavArrow direction="prev" />
            </button>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0F2645" }}>
                {current ? `Session ${index + 1} of ${sessions.length}` : "Loading…"}
              </h2>
              {saving && <p style={{ margin: "1px 0 0", fontSize: "11px", color: "#9CA3AF" }}>Saving…</p>}
            </div>
            <button
              type="button"
              onClick={() => canNext && goTo(sessions[index + 1].id)}
              disabled={!canNext}
              title="Next session"
              style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: "8px", color: canNext ? "#25476a" : "#D1D5DB", cursor: canNext ? "pointer" : "not-allowed" }}
            >
              <NavArrow direction="next" />
            </button>
          </div>
          <button type="button" onClick={handleClose} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: 0 }}>
            ×
          </button>
        </div>

        <div style={{ padding: "24px", maxHeight: "82vh", overflowY: "auto" }}>
          {current ? (
            <FormProvider {...methods}>
              <SessionForm modules={modules} />
            </FormProvider>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: "13px" }}>Loading session…</div>
          )}
        </div>

        <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: "0 0 16px 16px", borderTop: "1px solid #E5E7EB" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>Changes save automatically as you move between sessions.</p>
          <button
            type="button"
            onClick={handleClose}
            style={{ padding: "10px 24px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Session row ──────────────────────────────────────────────────────── */

function SessionRow({ courseId, session, index, expanded, onToggle, onEdit }) {
  const { mutate: deleteSession, isPending: deleting } = useDeleteSession(courseId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #E5E7EB", overflow: "hidden" }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", cursor: "pointer", backgroundColor: expanded ? "#F0F6FB" : "#fff" }}
        onClick={onToggle}
      >
        <ChevronDown open={expanded} />
        <span style={{ flex: 1, fontSize: "14px", fontWeight: "700", color: "#111827" }}>
          {sessionLabel(session, index)}
        </span>
        <span style={{ fontSize: "12px", color: "#38aae1", fontWeight: "600" }}>{SECTIONS.length} Sections</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(session); }}
          title="Edit session"
          style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", padding: "4px" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
          disabled={deleting}
          title="Delete session"
          style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", padding: "4px" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {expanded && (
        <div>
          {SECTIONS.map((section) => (
            <Link
              key={section.key}
              to={sectionLinkPath(courseId, session, section)}
              style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px 10px 40px", borderTop: "1px solid #F3F4F6", textDecoration: "none", color: "#25476a" }}
            >
              <SectionIcon />
              <span style={{ fontSize: "13px", fontWeight: "600" }}>{section.label}</span>
            </Link>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Session"
        message={`"${session.title}" and its content will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); deleteSession(session.id); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

/* ── Module group (header + its sessions) ───────────────────────────────── */

function AddSessionControl({ onAdd, adding }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState("1");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const submit = () => {
    const n = Math.max(1, Math.min(30, Number(count) || 1));
    onAdd(n);
    setOpen(false);
    setCount("1");
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={adding}
        style={{ padding: "5px 12px", backgroundColor: "#fff", border: "1.5px solid #a8d5ee", borderRadius: "8px", color: "#25476a", fontSize: "12px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: adding ? "not-allowed" : "pointer" }}
      >
        + Add Session
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 20, background: "#fff", border: "1px solid #E5E7EB", borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: "12px", width: "180px" }}>
          <label style={{ display: "block", fontSize: "11.5px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>Number of sessions</label>
          <input
            autoFocus
            type="number" min="1" max="30"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            style={{ width: "100%", boxSizing: "border-box", padding: "7px 9px", borderRadius: "8px", border: "1.5px solid #E5E7EB", fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none", marginBottom: "8px" }}
          />
          <button
            type="button"
            onClick={submit}
            style={{ width: "100%", padding: "7px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "8px", fontSize: "12.5px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function ModuleGroup({
  courseId, courseModule, sessions, sessionIndex, expandedIds, onToggleSession, onEditSession,
  onAddSession, addingSession, expanded, onToggleExpand,
}) {
  const { mutate: updateModule } = useUpdateModule(courseId);
  const { mutate: deleteModule, isPending: deleting } = useDeleteModule(courseId);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(courseModule.name);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const saveRename = () => {
    setRenaming(false);
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== courseModule.name) updateModule({ id: courseModule.id, data: { name: trimmed } });
    else setNameDraft(courseModule.name);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", backgroundColor: "#EAF2FA", border: "1px solid #D6E7F5", borderRadius: "12px" }}>
        <button type="button" onClick={onToggleExpand} style={{ background: "none", border: "none", cursor: "pointer", color: "#25476a", display: "flex" }}>
          <ChevronDown open={expanded} />
        </button>
        {renaming ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") { setNameDraft(courseModule.name); setRenaming(false); } }}
            style={{ flex: 1, fontSize: "14px", fontWeight: "700", color: "#0F2645", border: "1.5px solid #a8d5ee", borderRadius: "6px", padding: "3px 8px", fontFamily: "Inter, sans-serif" }}
          />
        ) : (
          <span
            onClick={() => setRenaming(true)}
            title="Rename module"
            style={{ flex: 1, fontSize: "14px", fontWeight: "700", color: "#0F2645", cursor: "text" }}
          >
            {courseModule.name}
          </span>
        )}
        <span style={{ fontSize: "12px", color: "#25476a", fontWeight: "600" }}>{sessions.length} Session{sessions.length !== 1 ? "s" : ""}</span>
        <AddSessionControl onAdd={(count) => onAddSession(courseModule.id, count)} adding={addingSession} />
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={deleting || sessions.length > 0}
          title={sessions.length > 0 ? "Move or delete this module's sessions before deleting it" : "Delete module"}
          style={{ background: "none", border: "none", color: sessions.length > 0 ? "#D1D5DB" : "#9CA3AF", cursor: sessions.length > 0 ? "not-allowed" : "pointer", padding: "4px" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {expanded && (
        sessions.length === 0 ? (
          <p style={{ margin: "0 0 0 24px", fontSize: "12.5px", color: "#9CA3AF", fontStyle: "italic" }}>No sessions in this module yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingLeft: "24px" }}>
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                courseId={courseId}
                session={session}
                index={sessionIndex.get(session.id)}
                expanded={expandedIds.has(session.id)}
                onToggle={() => onToggleSession(session.id)}
                onEdit={onEditSession}
              />
            ))}
          </div>
        )
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Module"
        message={`"${courseModule.name}" will be permanently deleted.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); deleteModule(courseModule.id); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function CourseViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: course, isLoading: courseLoading, isError: courseError } = useCourseQuery(id);
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions(id);
  const { data: modules = [] } = useModules(id);
  const { data: competencies = [] } = useCourseCompetencies(id);
  const { data: learningAreas = [] } = useCourseLearningAreas(id);
  const { data: assessmentsData } = useAssessmentsQuery();
  const allAssessments = assessmentsData?.data || [];
  const attachedAssessmentIds = [...new Set(sessions.flatMap((s) => s.assessmentIds || []))];
  const attachedAssessments = attachedAssessmentIds
    .map((aid) => {
      const assessment = allAssessments.find((a) => a.id === aid);
      if (!assessment) return null;
      // An assessment can be attached to more than one session — link to wherever it first appears.
      const owningSession = sessions.find((s) => (s.assessmentIds || []).includes(aid));
      return { ...assessment, sessionId: owningSession?.id };
    })
    .filter(Boolean);

  const [expandedIds, setExpandedIds] = useState(new Set());
  const [collapsedModuleIds, setCollapsedModuleIds] = useState(new Set());
  const [modalSessionId, setModalSessionId] = useState(null);
  const [addingSession, setAddingSession] = useState(false);
  const { mutateAsync: createSessionAsync } = useCreateSession(id);
  const { mutateAsync: createSessionsBulkAsync } = useCreateSessionsBulk();
  const { mutateAsync: createModuleAsync } = useCreateModule(id);
  const [addModuleOpen, setAddModuleOpen] = useState(false);

  const allExpanded = sessions.length > 0 && expandedIds.size === sessions.length && collapsedModuleIds.size === 0;

  // Sessions keep one continuous "Session 1..N" numbering across the whole course
  // regardless of which module (if any) they're grouped under.
  const sessionIndex = new Map(sessions.map((s, i) => [s.id, i]));
  const ungroupedSessions = sessions.filter((s) => !s.moduleId || !modules.some((m) => m.id === s.moduleId));

  // Every session belongs to a module — no "ungrouped" sessions. A session added without an
  // explicit module (the page-level "+ Add Session" button) lands in the last module, or a
  // freshly-created "Module 1" if this course has none yet. count > 1 bulk-creates instead of
  // opening the editor for a single new session (there'd be no single "the" one to open).
  const handleAddSession = async (moduleId = null, count = 1) => {
    setAddingSession(true);
    try {
      let targetModuleId = moduleId;
      if (!targetModuleId) {
        targetModuleId = modules.length > 0
          ? modules[modules.length - 1].id
          : (await createModuleAsync({ name: "Module 1" })).id;
      }
      if (count > 1) {
        await createSessionsBulkAsync({ courseId: id, count, moduleId: targetModuleId });
        return;
      }
      const newSession = await createSessionAsync({ title: "", moduleId: targetModuleId });
      setModalSessionId(newSession.id);
    } finally {
      setAddingSession(false);
    }
  };

  const handleAddModule = () => {
    setAddModuleOpen(true);
  };

  const toggleSession = (sessionId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedIds(new Set());
      setCollapsedModuleIds(new Set(modules.map((m) => m.id)));
    } else {
      setExpandedIds(new Set(sessions.map((s) => s.id)));
      setCollapsedModuleIds(new Set());
    }
  };

  const toggleModule = (moduleId) => {
    setCollapsedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  if (courseLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading course…
      </div>
    );
  }

  if (courseError || !course) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ Course not found.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <button
        type="button"
        onClick={() => navigate("/courses")}
        style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", marginBottom: "16px", backgroundColor: "#fff", border: "1.5px solid #E5E7EB", borderRadius: "20px", color: "#374151", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
      >
        ← Back to Courses
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "20px", alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "12px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "900", color: "#111827" }}>{course.name}</h1>
                {formatAgeRange(course.ageMin, course.ageMax) && (
                  <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: "700", backgroundColor: "#e8f5fb", color: "#25476a", border: "1.5px solid #a8d5ee", whiteSpace: "nowrap" }}>
                    Ages {formatAgeRange(course.ageMin, course.ageMax)}
                  </span>
                )}
              </div>
              <div style={{ marginTop: "6px" }}>
                <RichContent html={course.description} emptyText="No description added" />
              </div>
            </div>
            {sessions.length > 0 && (
              <button
                type="button"
                onClick={toggleExpandAll}
                style={{ flexShrink: 0, padding: "8px 16px", backgroundColor: "#fff", border: "1.5px solid #E5E7EB", borderRadius: "10px", color: "#374151", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
              >
                {allExpanded ? "Collapse All" : "Expand All"}
              </button>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginBottom: "12px" }}>
            <button
              type="button"
              onClick={handleAddModule}
              style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "10px 18px", backgroundColor: "#fff", border: "1.5px solid #E5E7EB", borderRadius: "10px", color: "#374151", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              + Add Module
            </button>
            <button
              type="button"
              onClick={() => handleAddSession()}
              disabled={addingSession}
              style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "10px 18px", backgroundColor: addingSession ? "#fef3d0" : "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: addingSession ? "not-allowed" : "pointer" }}
            >
              + Add Session
            </button>
          </div>

          {sessionsLoading ? (
            <div style={{ color: "#9CA3AF", fontSize: "13px" }}>Loading sessions…</div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", backgroundColor: "#fff", borderRadius: "16px", border: "1.5px solid #E5E7EB" }}>
              <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#374151" }}>No sessions yet</p>
              <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>Add your first session to start building this course.</p>
            </div>
          ) : modules.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {sessions.map((session, idx) => (
                <SessionRow
                  key={session.id}
                  courseId={id}
                  session={session}
                  index={idx}
                  expanded={expandedIds.has(session.id)}
                  onToggle={() => toggleSession(session.id)}
                  onEdit={(s) => setModalSessionId(s.id)}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {modules.map((courseModule) => (
                <ModuleGroup
                  key={courseModule.id}
                  courseId={id}
                  courseModule={courseModule}
                  sessions={sessions.filter((s) => s.moduleId === courseModule.id)}
                  sessionIndex={sessionIndex}
                  expandedIds={expandedIds}
                  onToggleSession={toggleSession}
                  onEditSession={(s) => setModalSessionId(s.id)}
                  onAddSession={handleAddSession}
                  addingSession={addingSession}
                  expanded={!collapsedModuleIds.has(courseModule.id)}
                  onToggleExpand={() => toggleModule(courseModule.id)}
                />
              ))}
              {ungroupedSessions.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <p style={{ margin: "0 0 0 4px", fontSize: "12px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.04em" }}>Ungrouped</p>
                  {ungroupedSessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      courseId={id}
                      session={session}
                      index={sessionIndex.get(session.id)}
                      expanded={expandedIds.has(session.id)}
                      onToggle={() => toggleSession(session.id)}
                      onEdit={(s) => setModalSessionId(s.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
            {course.coverImage ? (
              <img src={course.coverImage} alt={course.name} style={{ width: "100%", height: "160px", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: "160px", backgroundColor: "#F0F6FB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px" }}>
                📚
              </div>
            )}
          </div>

          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "18px 20px" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: "700", color: "#111827" }}>Course Includes</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "#374151" }}>
                <span>📄</span> {sessions.length} Session{sessions.length !== 1 ? "s" : ""}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "#374151" }}>
                <span>☰</span> {sessions.length * SECTIONS.length} Sections
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "18px 20px" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: "700", color: "#111827" }}>Assessments</h3>
            {attachedAssessments.length === 0 ? (
              <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF" }}>No assessments attached yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {attachedAssessments.map((a) => {
                  const color = ASM_TYPE_COLORS[a.type] || "#9CA3AF";
                  return (
                    <Link
                      key={a.id}
                      to={a.sessionId ? `/courses/${id}/sessions/${a.sessionId}/sections/assessments/${a.id}` : `/assessments/${a.id}/view`}
                      style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "10px", textDecoration: "none" }}
                    >
                      <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: "12.5px", fontWeight: "600", color: "#25476a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                      <span style={{ fontSize: "10px", fontWeight: "700", color, backgroundColor: `${color}15`, border: `1px solid ${color}35`, padding: "2px 8px", borderRadius: "20px", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {ASM_TYPE_LABELS[a.type] || a.type}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "18px 20px" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: "700", color: "#111827" }}>Competencies</h3>
            {competencies.length === 0 ? (
              <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF" }}>
                No competencies tagged.{" "}
                <Link to={`/courses/${id}/edit`} style={{ color: "#38aae1", fontWeight: "600", textDecoration: "none" }}>Add some →</Link>
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {competencies.map((comp, idx) => {
                  const color = ["#25476a", "#38aae1", "#059669", "#7C3AED", "#DC2626", "#D97706"][idx % 6];
                  return (
                    <span
                      key={comp.id}
                      style={{
                        padding: "4px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: "700",
                        backgroundColor: `${color}12`, border: `1.5px solid ${color}30`, color,
                      }}
                    >
                      {comp.name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "18px 20px" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: "700", color: "#111827" }}>Learning Areas</h3>
            {learningAreas.length === 0 ? (
              <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF" }}>
                No learning areas tagged.{" "}
                <Link to={`/courses/${id}/edit`} style={{ color: "#38aae1", fontWeight: "600", textDecoration: "none" }}>Add some →</Link>
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {learningAreas.map((area, idx) => {
                  const color = area.color || ["#25476a", "#38aae1", "#059669", "#7C3AED", "#DC2626", "#D97706"][idx % 6];
                  return (
                    <span
                      key={area.id}
                      style={{
                        padding: "4px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: "700",
                        backgroundColor: `${color}12`, border: `1.5px solid ${color}30`, color,
                      }}
                    >
                      {area.name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {modalSessionId && (
        <SessionModal
          courseId={id}
          sessions={sessions}
          modules={modules}
          startSessionId={modalSessionId}
          onClose={() => setModalSessionId(null)}
        />
      )}

      {addModuleOpen && (
        <AddModuleModal
          courseId={id}
          defaultName={`Module ${modules.length + 1}`}
          onClose={() => setAddModuleOpen(false)}
        />
      )}
    </div>
  );
}
