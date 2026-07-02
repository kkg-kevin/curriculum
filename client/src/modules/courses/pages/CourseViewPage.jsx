import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCourseQuery,
  useSessions,
  useCreateSession,
  useUpdateSession,
  useDeleteSession,
} from "../hooks/useCourse";
import { sessionSchema } from "../schemas/session.schema";
import SessionForm from "../components/SessionForm";
import RichContent from "../components/RichContent";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { SECTIONS } from "../sectionConfig";

const SESSION_DEFAULT_VALUES = {
  title: "",
  outcomes: [],
  introduction: "",
  mainConcepts: "",
  activities: "",
  notes: "",
  resources: [],
};

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

/* ── Add / Edit Session modal ─────────────────────────────────────────── */

function SessionModal({ courseId, editTarget, onClose }) {
  const { mutate: createSession, isPending: creating } = useCreateSession(courseId);
  const { mutate: updateSession, isPending: updating } = useUpdateSession(courseId);

  const methods = useForm({
    resolver: zodResolver(sessionSchema),
    defaultValues: editTarget
      ? {
          title: editTarget.title || "",
          outcomes: editTarget.outcomes || [],
          introduction: editTarget.introduction || "",
          mainConcepts: editTarget.mainConcepts || "",
          activities: editTarget.activities || "",
          notes: editTarget.notes || "",
          resources: editTarget.resources || [],
        }
      : SESSION_DEFAULT_VALUES,
    mode: "onTouched",
  });

  const { handleSubmit } = methods;
  const isPending = creating || updating;

  const onSubmit = (data) => {
    if (editTarget) {
      updateSession({ id: editTarget.id, data }, { onSuccess: onClose });
    } else {
      createSession(data, { onSuccess: onClose });
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,38,69,0.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}>
      <div style={{ background: "#F3F4F6", borderRadius: "16px", width: "100%", maxWidth: "640px", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: "16px 16px 0 0", borderBottom: "1px solid #E5E7EB" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0F2645" }}>
            {editTarget ? "Edit Session" : "New Session"}
          </h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: 0 }}>
            ×
          </button>
        </div>

        <div style={{ padding: "20px" }}>
          <FormProvider {...methods}>
            <form id="session-form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <SessionForm />
            </form>
          </FormProvider>
        </div>

        <div style={{ padding: "16px 24px", display: "flex", gap: "10px", justifyContent: "flex-end", backgroundColor: "#fff", borderRadius: "0 0 16px 16px", borderTop: "1px solid #E5E7EB" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="session-form"
            disabled={isPending}
            style={{ padding: "10px 24px", backgroundColor: isPending ? "#fef3d0" : "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer" }}
          >
            {isPending ? "Saving…" : editTarget ? "Save Changes" : "Add Session"}
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
          Session {index + 1}: {session.title}
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
              to={`/courses/${courseId}/sessions/${session.id}/sections/${section.key}`}
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

/* ── Main page ────────────────────────────────────────────────────────── */

export default function CourseViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: course, isLoading: courseLoading, isError: courseError } = useCourseQuery(id);
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions(id);

  const [expandedIds, setExpandedIds] = useState(new Set());
  const [modalMode, setModalMode] = useState(null); // null | "add" | session object being edited

  const allExpanded = sessions.length > 0 && expandedIds.size === sessions.length;

  const toggleSession = (sessionId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const toggleExpandAll = () => {
    setExpandedIds(allExpanded ? new Set() : new Set(sessions.map((s) => s.id)));
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
              <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "900", color: "#111827" }}>{course.name}</h1>
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

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
            <button
              type="button"
              onClick={() => setModalMode("add")}
              style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "10px 18px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
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
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {sessions.map((session, idx) => (
                <SessionRow
                  key={session.id}
                  courseId={id}
                  session={session}
                  index={idx}
                  expanded={expandedIds.has(session.id)}
                  onToggle={() => toggleSession(session.id)}
                  onEdit={(s) => setModalMode(s)}
                />
              ))}
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
        </div>
      </div>

      {modalMode && (
        <SessionModal
          courseId={id}
          editTarget={modalMode === "add" ? null : modalMode}
          onClose={() => setModalMode(null)}
        />
      )}
    </div>
  );
}
