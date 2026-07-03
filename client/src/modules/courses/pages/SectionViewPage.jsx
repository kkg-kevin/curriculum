import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useCourseQuery, useSessions } from "../hooks/useCourse";
import RichContent from "../components/RichContent";
import { SECTIONS, SECTION_LABELS, sessionLabel } from "../sectionConfig";

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ChevronDown({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SectionIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 6h13M3 12h13M3 18h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="20" cy="6" r="1.2" fill="currentColor"/>
      <circle cx="20" cy="12" r="1.2" fill="currentColor"/>
      <circle cx="20" cy="18" r="1.2" fill="currentColor"/>
    </svg>
  );
}

/* ── Left sidebar: course-wide session/section navigator ─────────────── */

function SessionSidebar({ courseId, sessions, activeSessionId, activeSectionKey }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set([activeSessionId]));

  // Auto-expand whichever session becomes active (e.g. via Prev/Next crossing a session boundary),
  // without collapsing sessions the user expanded manually.
  useEffect(() => {
    setExpandedIds((prev) => (prev.has(activeSessionId) ? prev : new Set(prev).add(activeSessionId)));
  }, [activeSessionId]);

  const toggleSession = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {sessions.map((session, idx) => {
        const isCurrentSession = session.id === activeSessionId;
        const expanded = expandedIds.has(session.id);
        return (
          <div key={session.id} style={{ backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <div
              onClick={() => toggleSession(session.id)}
              style={{
                display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", cursor: "pointer",
                backgroundColor: isCurrentSession ? "#F0F6FB" : "#fff",
              }}
            >
              <ChevronDown open={expanded} />
              <span
                style={{
                  flex: 1, fontSize: "12.5px", fontWeight: isCurrentSession ? "700" : "600",
                  color: isCurrentSession ? "#25476a" : "#374151",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
                title={sessionLabel(session, idx)}
              >
                {sessionLabel(session, idx)}
              </span>
              <span style={{ fontSize: "10.5px", color: "#9CA3AF", flexShrink: 0 }}>{SECTIONS.length} Sections</span>
            </div>

            {expanded && (
              <div>
                {SECTIONS.map((section) => {
                  const isActive = isCurrentSession && section.key === activeSectionKey;
                  return (
                    <Link
                      key={section.key}
                      to={`/courses/${courseId}/sessions/${session.id}/sections/${section.key}`}
                      style={{
                        display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px 8px 32px",
                        borderTop: "1px solid #F3F4F6", textDecoration: "none",
                        backgroundColor: isActive ? "#e8f5fb" : "transparent",
                        color: isActive ? "#25476a" : "#6B7280",
                      }}
                    >
                      <SectionIcon />
                      <span style={{ fontSize: "12px", fontWeight: isActive ? "700" : "500" }}>{section.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Section content by type ──────────────────────────────────────────── */

function SubBlock({ title, html, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : "28px" }}>
      <h3 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {title}
      </h3>
      <RichContent html={html} emptyText="Nothing added yet" />
    </div>
  );
}

function SectionBody({ sectionKey, session }) {
  if (sectionKey === "outcomes") {
    const outcomes = session.outcomes || [];
    return outcomes.length > 0 ? (
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
        {outcomes.map((outcome, idx) => (
          <li key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <span style={{ color: "#feb139", fontSize: "14px", fontWeight: "700", lineHeight: "1.6", flexShrink: 0 }}>{idx + 1}.</span>
            <span style={{ fontSize: "15px", color: "#374151", lineHeight: "1.6" }}>{outcome}</span>
          </li>
        ))}
      </ol>
    ) : (
      <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>No outcomes added</p>
    );
  }

  if (sectionKey === "introduction") {
    return (
      <>
        <SubBlock title="Introduction" html={session.introduction} />
        <SubBlock title="Ice Breaker" html={session.iceBreaker} last />
      </>
    );
  }

  if (sectionKey === "mainConcepts") {
    return (
      <>
        <SubBlock title="Introduction" html={session.mainConceptsIntro} />
        <SubBlock title={session.mainConceptsBodyTitle || "Body"} html={session.mainConceptsBody} last />
      </>
    );
  }

  if (sectionKey === "activities") {
    return (
      <>
        <SubBlock title="Class Activity" html={session.classActivity} />
        <SubBlock title="Wrap Activity" html={session.wrapActivity} last />
      </>
    );
  }

  if (sectionKey === "resources") {
    const resources = session.resources || [];
    return resources.length > 0 ? (
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
        {resources.map((r) => (
          <li key={r.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "10px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: "#38aae1", flexShrink: 0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
            <a href={r.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: "14px", color: "#25476a", fontWeight: "600", textDecoration: "none" }}>
              {r.filename}
            </a>
            <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{formatSize(r.size)}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>No resources attached</p>
    );
  }

  return <RichContent html={session[sectionKey]} emptyText="Nothing added yet" />;
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function SectionViewPage() {
  const { id, sessionId, sectionKey } = useParams();
  const navigate = useNavigate();
  const { data: course } = useCourseQuery(id);
  const { data: sessions = [], isLoading } = useSessions(id);

  const session = sessions.find((s) => s.id === sessionId);

  // Flatten (session, section) pairs across the whole course, in order, for Prev/Next.
  const flat = sessions.flatMap((s) => SECTIONS.map((sec) => ({ sessionId: s.id, sectionKey: sec.key })));
  const currentIndex = flat.findIndex((f) => f.sessionId === sessionId && f.sectionKey === sectionKey);
  const prev = currentIndex > 0 ? flat[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < flat.length - 1 ? flat[currentIndex + 1] : null;

  const goTo = (target) => {
    if (target) navigate(`/courses/${id}/sessions/${target.sessionId}/sections/${target.sectionKey}`);
  };

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading…
      </div>
    );
  }

  if (!session || !course) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ Section not found.
      </div>
    );
  }

  const sessionIndex = sessions.findIndex((s) => s.id === sessionId);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <button
        type="button"
        onClick={() => navigate(`/courses/${id}/view`)}
        style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", marginBottom: "16px", backgroundColor: "#fff", border: "1.5px solid #E5E7EB", borderRadius: "20px", color: "#374151", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
      >
        ← Back to Course
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px", alignItems: "start" }}>
        <SessionSidebar
          courseId={id}
          sessions={sessions}
          activeSessionId={sessionId}
          activeSectionKey={sectionKey}
        />

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", flexWrap: "wrap" }}>
              <Link to={`/courses/${id}/view`} style={{ color: "#38aae1", textDecoration: "none", fontWeight: "600" }}>{course.name}</Link>
              <span style={{ color: "#D1D5DB" }}>&gt;</span>
              <span style={{ color: "#6B7280" }}>{sessionLabel(session, sessionIndex)}</span>
              <span style={{ color: "#D1D5DB" }}>&gt;</span>
              <span style={{ color: "#111827", fontWeight: "600" }}>{SECTION_LABELS[sectionKey]}</span>
            </div>

            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => goTo(prev)}
                disabled={!prev}
                style={{ width: "34px", height: "34px", borderRadius: "8px", border: "none", backgroundColor: prev ? "#111827" : "#E5E7EB", color: "#fff", cursor: prev ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center" }}
                title="Previous"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button
                type="button"
                onClick={() => goTo(next)}
                disabled={!next}
                style={{ width: "34px", height: "34px", borderRadius: "8px", border: "none", backgroundColor: next ? "#111827" : "#E5E7EB", color: "#fff", cursor: next ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center" }}
                title="Next"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>

          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "32px" }}>
            <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Session {sessionIndex + 1}, {SECTION_LABELS[sectionKey]}
            </p>
            <h1 style={{ margin: "0 0 12px", fontSize: "30px", fontWeight: "900", color: "#111827" }}>
              {SECTION_LABELS[sectionKey]}
            </h1>
            <div style={{ height: "3px", width: "80px", backgroundColor: "#EF4444", borderRadius: "2px", marginBottom: "28px" }} />

            <SectionBody sectionKey={sectionKey} session={session} />
          </div>
        </div>
      </div>
    </div>
  );
}
