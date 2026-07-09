import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useCourseQuery, useSessions } from "../hooks/useCourse";
import { useAssessmentsQuery } from "../../assessments/hooks/useAssessment";
import AssessmentContent from "../../assessments/components/AssessmentContent";
import RichContent from "../components/RichContent";
import { SECTIONS, SECTION_LABELS, sessionLabel, sectionLinkPath, isRepeatableSection, repeatableItemLabel } from "../sectionConfig";

const ASM_TYPE_LABELS = { quiz: "Quiz", exam: "Exam", assignment: "Assignment", project: "Project", observation: "Teacher Observation" };
const ASM_TYPE_COLORS = { quiz: "#25476a", exam: "#38aae1", assignment: "#059669", project: "#7C3AED", observation: "#D97706" };

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const AUDIENCE_STYLES = {
  teacher: { label: "Teacher only", bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
  student: { label: "Student only", bg: "#fff8e6", color: "#b07800", border: "#fcd97a" },
  both:    { label: "Teacher & Student", bg: "#F3F4F6", color: "#6B7280", border: "#E5E7EB" },
};

function AudienceBadge({ audience }) {
  const s = AUDIENCE_STYLES[audience] || AUDIENCE_STYLES.both;
  return (
    <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "10.5px", fontWeight: "700", backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: "nowrap", flexShrink: 0 }}>
      {s.label}
    </span>
  );
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

function SessionSidebar({ courseId, sessions, activeSessionId, activeSectionKey, activeItemId, allAssessments, onLeafSelect }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set([activeSessionId]));
  // Keyed by `${sectionKey}:${sessionId}` so each repeatable section expands independently per session.
  // Assessments isn't in REPEATABLE_SECTIONS (its items are shared assessment docs, not
  // session-owned content) but gets the same expand/collapse + per-item route treatment.
  const isExpandableSection = (key) => isRepeatableSection(key) || key === "assessments";
  const [expandedRepeatable, setExpandedRepeatable] = useState(
    () => new Set(isExpandableSection(activeSectionKey) ? [`${activeSectionKey}:${activeSessionId}`] : [])
  );

  // Auto-expand whichever session/sub-list becomes active (e.g. via Prev/Next crossing a
  // boundary), without collapsing anything the user expanded manually.
  useEffect(() => {
    setExpandedIds((prev) => (prev.has(activeSessionId) ? prev : new Set(prev).add(activeSessionId)));
  }, [activeSessionId]);

  useEffect(() => {
    if (isExpandableSection(activeSectionKey)) {
      const key = `${activeSectionKey}:${activeSessionId}`;
      setExpandedRepeatable((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, activeSectionKey]);

  const toggleSession = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Collapse the session accordion once its content is actually being viewed, so the sidebar
  // retracts to a compact header list instead of staying sprawled open next to the content.
  const collapseSession = (id) => {
    setExpandedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleRepeatable = (key) => {
    setExpandedRepeatable((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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

                  if (isRepeatableSection(section.key)) {
                    const repeatKey = `${section.key}:${session.id}`;
                    const repExpanded = expandedRepeatable.has(repeatKey);
                    const items = session[section.key] || [];
                    return (
                      <div key={section.key}>
                        <div
                          onClick={() => toggleRepeatable(repeatKey)}
                          style={{
                            display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px 8px 32px", cursor: "pointer",
                            borderTop: "1px solid #F3F4F6",
                            backgroundColor: isActive ? "#e8f5fb" : "transparent",
                            color: isActive ? "#25476a" : "#6B7280",
                          }}
                        >
                          <SectionIcon />
                          <span style={{ flex: 1, fontSize: "12px", fontWeight: isActive ? "700" : "500" }}>{section.label}</span>
                          <ChevronDown open={repExpanded} />
                        </div>
                        {repExpanded && (
                          items.length === 0 ? (
                            <p style={{ margin: 0, padding: "6px 12px 8px 54px", fontSize: "11px", color: "#D1D5DB", fontStyle: "italic" }}>
                              None added yet
                            </p>
                          ) : (
                            items.map((item, i) => {
                              const itemActive = isActive && item.id === activeItemId;
                              return (
                                <Link
                                  key={item.id}
                                  to={`/courses/${courseId}/sessions/${session.id}/sections/${section.key}/${item.id}`}
                                  onClick={() => { collapseSession(session.id); onLeafSelect?.(); }}
                                  style={{
                                    display: "flex", alignItems: "center", gap: "8px", padding: "7px 12px 7px 54px",
                                    borderTop: "1px solid #F9FAFB", textDecoration: "none", fontSize: "11.5px",
                                    backgroundColor: itemActive ? "#d6edf8" : "transparent",
                                    color: itemActive ? "#25476a" : "#9CA3AF",
                                    fontWeight: itemActive ? "700" : "500",
                                  }}
                                >
                                  {repeatableItemLabel(section.key, item, i)}
                                </Link>
                              );
                            })
                          )
                        )}
                      </div>
                    );
                  }

                  if (section.key === "assessments") {
                    const repeatKey = `assessments:${session.id}`;
                    const repExpanded = expandedRepeatable.has(repeatKey);
                    const attached = (session.assessmentIds || [])
                      .map((aid) => allAssessments.find((a) => a.id === aid))
                      .filter(Boolean);
                    return (
                      <div key={section.key}>
                        <div
                          onClick={() => toggleRepeatable(repeatKey)}
                          style={{
                            display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px 8px 32px", cursor: "pointer",
                            borderTop: "1px solid #F3F4F6",
                            backgroundColor: isActive ? "#e8f5fb" : "transparent",
                            color: isActive ? "#25476a" : "#6B7280",
                          }}
                        >
                          <SectionIcon />
                          <span style={{ flex: 1, fontSize: "12px", fontWeight: isActive ? "700" : "500" }}>{section.label}</span>
                          <ChevronDown open={repExpanded} />
                        </div>
                        {repExpanded && (
                          attached.length === 0 ? (
                            <p style={{ margin: 0, padding: "6px 12px 8px 54px", fontSize: "11px", color: "#D1D5DB", fontStyle: "italic" }}>
                              None attached yet
                            </p>
                          ) : (
                            attached.map((a) => {
                              const color = ASM_TYPE_COLORS[a.type] || "#9CA3AF";
                              const itemActive = isActive && a.id === activeItemId;
                              return (
                                <Link
                                  key={a.id}
                                  to={`/courses/${courseId}/sessions/${session.id}/sections/assessments/${a.id}`}
                                  title={a.name}
                                  onClick={() => { collapseSession(session.id); onLeafSelect?.(); }}
                                  style={{
                                    display: "flex", alignItems: "center", gap: "8px", padding: "7px 12px 7px 54px",
                                    borderTop: "1px solid #F9FAFB", textDecoration: "none", fontSize: "11.5px",
                                    backgroundColor: itemActive ? `${color}15` : "transparent",
                                    color, fontWeight: itemActive ? "700" : "600",
                                  }}
                                >
                                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
                                  <span>{ASM_TYPE_LABELS[a.type] || a.type}</span>
                                </Link>
                              );
                            })
                          )
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={section.key}
                      to={sectionLinkPath(courseId, session, section)}
                      onClick={() => { collapseSession(session.id); onLeafSelect?.(); }}
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

function SectionBody({ sectionKey, session, allAssessments, courseId }) {
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
    return <RichContent html={session.introduction} emptyText="Nothing added yet" />;
  }

  if (sectionKey === "assessments") {
    const assessmentIds = session.assessmentIds || [];
    const attached = assessmentIds.map((id) => allAssessments.find((a) => a.id === id)).filter(Boolean);
    return attached.length > 0 ? (
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
        {attached.map((a) => {
          const color = ASM_TYPE_COLORS[a.type] || "#9CA3AF";
          return (
            <li key={a.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "10px", flexWrap: "wrap" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
              <Link to={`/courses/${courseId}/sessions/${session.id}/sections/assessments/${a.id}`} style={{ flex: 1, minWidth: "140px", fontSize: "14px", color: "#25476a", fontWeight: "600", textDecoration: "none" }}>
                {a.name}
              </Link>
              <span style={{ fontSize: "10.5px", fontWeight: "700", color, backgroundColor: `${color}15`, border: `1px solid ${color}35`, padding: "2px 9px", borderRadius: "20px", whiteSpace: "nowrap" }}>
                {ASM_TYPE_LABELS[a.type] || a.type}
              </span>
            </li>
          );
        })}
      </ul>
    ) : (
      <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>No assessments attached</p>
    );
  }

  if (sectionKey === "resources") {
    const resources = session.resources || [];
    return resources.length > 0 ? (
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
        {resources.map((r) => (
          <li key={r.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "10px", flexWrap: "wrap" }}>
            {r.type === "link" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: "#7C3AED", flexShrink: 0 }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: "#38aae1", flexShrink: 0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
            )}
            <a href={r.url} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: "140px", fontSize: "14px", color: "#25476a", fontWeight: "600", textDecoration: "none" }}>
              {r.filename}
            </a>
            <AudienceBadge audience={r.audience} />
            {r.type !== "link" && <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{formatSize(r.size)}</span>}
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
  const { id, sessionId, sectionKey, itemId } = useParams();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data: course } = useCourseQuery(id);
  const { data: sessions = [], isLoading } = useSessions(id);
  const { data: assessmentsData } = useAssessmentsQuery();
  const allAssessments = assessmentsData?.data || [];

  const session = sessions.find((s) => s.id === sessionId);
  const isRepeatable = isRepeatableSection(sectionKey);
  const isAssessmentsSection = sectionKey === "assessments";
  const items = session?.[sectionKey] || [];
  const effectiveItemId = isRepeatable ? (itemId || items[0]?.id || null) : (isAssessmentsSection ? (itemId || null) : null);
  const itemIndex = isRepeatable ? items.findIndex((i) => i.id === effectiveItemId) : -1;
  const item = itemIndex !== -1 ? items[itemIndex] : null;
  const activeAssessment = isAssessmentsSection && effectiveItemId ? allAssessments.find((a) => a.id === effectiveItemId) : null;

  // Flatten (session, section[, item]) triples across the whole course, in order, for Prev/Next.
  // Repeatable sections contribute one entry per item (or a single item-less placeholder if
  // empty) instead of one entry for the whole section.
  const flat = sessions.flatMap((s) =>
    SECTIONS.flatMap((sec) => {
      if (isRepeatableSection(sec.key)) {
        const secItems = s[sec.key]?.length ? s[sec.key] : [{ id: null }];
        return secItems.map((it) => ({ sessionId: s.id, sectionKey: sec.key, itemId: it.id }));
      }
      return [{ sessionId: s.id, sectionKey: sec.key, itemId: null }];
    })
  );
  const currentIndex = flat.findIndex((f) =>
    f.sessionId === sessionId && f.sectionKey === sectionKey && f.itemId === (isRepeatable ? effectiveItemId : null)
  );
  const prev = currentIndex > 0 ? flat[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < flat.length - 1 ? flat[currentIndex + 1] : null;

  const goTo = (target) => {
    if (!target) return;
    const path = target.itemId
      ? `/courses/${id}/sessions/${target.sessionId}/sections/${target.sectionKey}/${target.itemId}`
      : `/courses/${id}/sessions/${target.sessionId}/sections/${target.sectionKey}`;
    navigate(path);
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
  const showsSubItem = isRepeatable || (isAssessmentsSection && !!effectiveItemId);
  const pageTitle = isRepeatable
    ? (item ? repeatableItemLabel(sectionKey, item, itemIndex) : SECTION_LABELS[sectionKey])
    : isAssessmentsSection && effectiveItemId
      ? (activeAssessment ? activeAssessment.name : "Assessment")
      : SECTION_LABELS[sectionKey];

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <button
          type="button"
          onClick={() => navigate(`/courses/${id}/view`)}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", backgroundColor: "#fff", border: "1.5px solid #E5E7EB", borderRadius: "20px", color: "#374151", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
        >
          ← Back to Course
        </button>
        <button
          type="button"
          onClick={() => setSidebarCollapsed((v) => !v)}
          title={sidebarCollapsed ? "Show sessions" : "Hide sessions"}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", backgroundColor: "#fff", border: "1.5px solid #E5E7EB", borderRadius: "20px", color: "#374151", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
            <path d="M9 4v16" stroke="currentColor" strokeWidth="2"/>
          </svg>
          {sidebarCollapsed ? "Show Sessions" : "Hide Sessions"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: sidebarCollapsed ? "1fr" : "300px 1fr", gap: sidebarCollapsed ? "0" : "20px", alignItems: "start" }}>
        {!sidebarCollapsed && (
          <SessionSidebar
            courseId={id}
            sessions={sessions}
            activeSessionId={sessionId}
            activeSectionKey={sectionKey}
            activeItemId={effectiveItemId}
            allAssessments={allAssessments}
            onLeafSelect={() => setSidebarCollapsed(true)}
          />
        )}

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", flexWrap: "wrap" }}>
              <Link to={`/courses/${id}/view`} style={{ color: "#38aae1", textDecoration: "none", fontWeight: "600" }}>{course.name}</Link>
              <span style={{ color: "#D1D5DB" }}>&gt;</span>
              <span style={{ color: "#6B7280" }}>{sessionLabel(session, sessionIndex)}</span>
              <span style={{ color: "#D1D5DB" }}>&gt;</span>
              {showsSubItem && (
                <>
                  <span style={{ color: "#6B7280" }}>{SECTION_LABELS[sectionKey]}</span>
                  <span style={{ color: "#D1D5DB" }}>&gt;</span>
                </>
              )}
              <span style={{ color: "#111827", fontWeight: "600" }}>{pageTitle}</span>
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
              Session {sessionIndex + 1}{showsSubItem ? `, ${SECTION_LABELS[sectionKey]}` : ""}
            </p>
            <h1 style={{ margin: "0 0 12px", fontSize: "30px", fontWeight: "900", color: "#111827" }}>
              {pageTitle}
            </h1>
            <div style={{ height: "3px", width: "80px", backgroundColor: "#EF4444", borderRadius: "2px", marginBottom: "28px" }} />

            {isRepeatable ? (
              item ? (
                <RichContent html={item.content} emptyText="Nothing added yet" />
              ) : (
                <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>
                  Nothing added to {SECTION_LABELS[sectionKey]} yet.
                </p>
              )
            ) : isAssessmentsSection && effectiveItemId ? (
              activeAssessment ? (
                <AssessmentContent id={activeAssessment.id} />
              ) : (
                <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>
                  This assessment is no longer attached to this session.
                </p>
              )
            ) : (
              <SectionBody sectionKey={sectionKey} session={session} allAssessments={allAssessments} courseId={id} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
