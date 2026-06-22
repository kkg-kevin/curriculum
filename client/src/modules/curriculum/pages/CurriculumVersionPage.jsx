import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCurriculumQuery } from "../hooks/useCurriculum";
import { useCurriculumVersionQuery, useRevertVersion } from "../hooks/useCurriculumVersions";
import ConfirmDialog from "../components/ConfirmDialog";

/* ── Helpers ──────────────────────────────────────────────────────────── */

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric", month: "long", year: "numeric",
  });

const cycleLabel = (model) =>
  model === "semesters" ? "Semesters" : model === "terms" ? "Terms" : "Periods";

const termLabel = (period, i, model) => {
  if (period?.name) return period.name;
  if (model === "semesters") return `Semester ${i + 1}`;
  if (model === "terms") return `Term ${i + 1}`;
  return `Period ${i + 1}`;
};

const STATUS = {
  active:   { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0", label: "Active" },
  draft:    { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A", label: "Draft" },
  archived: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: "Archived" },
};

/* ── Course chip ──────────────────────────────────────────────────────── */

function CourseChip({ name, index }) {
  const shades = [
    { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
    { bg: "#DBEAFE", color: "#1565C0", border: "#93C5FD" },
    { bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
    { bg: "#F0F7FF", color: "#1E40AF", border: "#C7D9F8" },
  ];
  const s = shades[index % shades.length];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 11px", backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: "20px", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap" }}>
      {name}
    </span>
  );
}

/* ── Grade row (collapsible) ──────────────────────────────────────────── */

function GradeRow({ grade, isOpen, onToggle }) {
  const count = grade.courses?.length || 0;
  return (
    <div style={{ border: `1px solid ${isOpen ? "#BFDBFE" : "#E5E7EB"}`, borderRadius: "10px", overflow: "hidden", backgroundColor: "#fff", transition: "border-color 0.15s" }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 14px", backgroundColor: isOpen ? "#EFF6FF" : "#fff", cursor: "pointer" }}>
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: count > 0 ? "#16A34A" : "#D1D5DB", flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: "13px", fontWeight: "600", color: isOpen ? "#0D47A1" : "#111827" }}>{grade.name}</span>
        <span style={{ padding: "2px 9px", backgroundColor: count > 0 ? "#DBEAFE" : "#F3F4F6", color: count > 0 ? "#1D4ED8" : "#9CA3AF", borderRadius: "20px", fontSize: "11px", fontWeight: "600", border: `1px solid ${count > 0 ? "#BFDBFE" : "#E5E7EB"}` }}>
          {count} {count === 1 ? "course" : "courses"}
        </span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", color: isOpen ? "#0D47A1" : "#9CA3AF" }}>
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {isOpen && (
        <div style={{ borderTop: "1px solid #DBEAFE", padding: "12px 14px", backgroundColor: "#F8FBFF" }}>
          {count > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {grade.courses.map((c, ci) => <CourseChip key={c.id} name={c.name} index={ci} />)}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>No courses in this snapshot.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Term accordion ───────────────────────────────────────────────────── */

function TermAccordion({ period, termIndex, termData, model, isOpen, onToggle, expandedGrades, onToggleGrade }) {
  const grades = termData.grades || [];
  const totalCourses = grades.reduce((s, g) => s + (g.courses?.length || 0), 0);
  const label = termLabel(period, termIndex, model);
  const startDate = period.startDate ? new Date(period.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
  const endDate   = period.endDate   ? new Date(period.endDate   + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <div style={{ borderRadius: "14px", border: `1.5px solid ${isOpen ? "#BFDBFE" : "#E5E7EB"}`, overflow: "hidden", backgroundColor: "#fff", boxShadow: isOpen ? "0 2px 12px rgba(13,71,161,0.07)" : "0 1px 3px rgba(0,0,0,0.04)", transition: "all 0.2s" }}>
      <button type="button" onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif", backgroundColor: isOpen ? "#EFF6FF" : "#fff", borderLeft: `4px solid ${isOpen ? "#0D47A1" : "transparent"}`, transition: "all 0.15s" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease", color: isOpen ? "#0D47A1" : "#9CA3AF", flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ width: "32px", height: "32px", borderRadius: "10px", backgroundColor: isOpen ? "#0D47A1" : (grades.length > 0 ? "#DBEAFE" : "#F3F4F6"), color: isOpen ? "#fff" : (grades.length > 0 ? "#1D4ED8" : "#9CA3AF"), fontSize: "13px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
          {termIndex + 1}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: "700", color: isOpen ? "#0D47A1" : "#111827" }}>{label}</p>
          <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>
            {startDate && endDate ? `${startDate} – ${endDate}` : "No dates in snapshot"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          {grades.length > 0 ? (
            <>
              <span style={{ padding: "3px 9px", backgroundColor: "#EFF6FF", color: "#1D4ED8", borderRadius: "20px", fontSize: "11px", fontWeight: "600", border: "1px solid #BFDBFE" }}>{grades.length} {grades.length === 1 ? "class" : "classes"}</span>
              <span style={{ padding: "3px 9px", backgroundColor: "#F0FDF4", color: "#15803D", borderRadius: "20px", fontSize: "11px", fontWeight: "600", border: "1px solid #BBF7D0" }}>{totalCourses} {totalCourses === 1 ? "course" : "courses"}</span>
            </>
          ) : (
            <span style={{ padding: "3px 9px", backgroundColor: "#F9FAFB", color: "#9CA3AF", borderRadius: "20px", fontSize: "11px", border: "1px solid #E5E7EB" }}>Not configured</span>
          )}
        </div>
      </button>

      {isOpen && (
        <div style={{ borderTop: "1px solid #E5E7EB", padding: "12px 18px 14px", backgroundColor: "#FAFBFF", display: "flex", flexDirection: "column", gap: "8px" }}>
          {grades.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "18px 20px", backgroundColor: "#fff", borderRadius: "10px", border: "1.5px dashed #E5E7EB" }}>
              <span style={{ fontSize: "22px" }}>🏫</span>
              <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>No classes were configured in this snapshot.</p>
            </div>
          ) : (
            grades.map((grade) => (
              <GradeRow
                key={grade.id}
                grade={grade}
                isOpen={expandedGrades.has(grade.id)}
                onToggle={() => onToggleGrade(grade.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Loading skeleton ─────────────────────────────────────────────────── */

function Sk({ w, h, r = "8px", mb = "0" }) {
  return <div style={{ width: w, height: h, borderRadius: r, backgroundColor: "#EEF2F7", marginBottom: mb, flexShrink: 0 }} />;
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function CurriculumVersionPage() {
  const { id, vId } = useParams();
  const navigate    = useNavigate();

  const { data: curriculum }                    = useCurriculumQuery(id);
  const { data: versionData, isLoading, isError } = useCurriculumVersionQuery(id, vId);
  const { mutate: revert, isPending: reverting } = useRevertVersion(id);

  const [confirmRevert, setConfirmRevert] = useState(false);

  const [expandedTerms,  setExpandedTerms]  = useState(() => new Set([0]));
  const [expandedGrades, setExpandedGrades] = useState(() => new Set());

  const toggleTerm  = (i) => setExpandedTerms((p)  => { const n = new Set(p); n.has(i)  ? n.delete(i)  : n.add(i);  return n; });
  const toggleGrade = (gId) => setExpandedGrades((p) => { const n = new Set(p); n.has(gId) ? n.delete(gId) : n.add(gId); return n; });

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif" }}>
        <Sk w="160px" h="32px" r="8px" mb="20px" />
        <Sk w="100%" h="160px" r="16px" mb="16px" />
        <Sk w="100%" h="80px"  r="14px" mb="12px" />
        <Sk w="100%" h="80px"  r="14px" />
      </div>
    );
  }

  if (isError || !versionData?.data) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "14px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ Version not found.
      </div>
    );
  }

  const version  = versionData.data;
  const snap     = version.snapshot || {};
  const periods  = snap.periods   || [];
  const structure = snap.structure || [];
  const model    = snap.academicCycleModel || "terms";
  const s        = STATUS[version.status] || STATUS.archived;
  const isActive = version.status === "active";

  const totalClasses = structure.reduce((sum, t) => sum + (t.grades?.length || 0), 0);
  const totalCourses = structure.reduce((sum, t) => sum + (t.grades?.reduce((gs, g) => gs + (g.courses?.length || 0), 0) || 0), 0);
  const configuredTerms = structure.filter((t) => (t.grades?.length || 0) > 0).length;

  const handleRevert = () => {
    revert(version.id, {
      onSuccess: () => {
        setConfirmRevert(false);
        navigate(`/curriculum/${id}/view`);
      },
    });
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>

      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button type="button" onClick={() => navigate(`/curriculum/${id}/view`)}
          style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 13px", backgroundColor: "#fff", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "9px", fontSize: "13px", fontWeight: "500", fontFamily: "Inter, sans-serif", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {curriculum?.name || "Curriculum"}
        </button>
        <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
        <button type="button" onClick={() => navigate(`/curriculum/${id}/versions`)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "13px", color: "#6B7280", fontFamily: "Inter, sans-serif" }}>Version Control</button>
        <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
        <span style={{ fontSize: "13px", color: "#111827", fontWeight: "600" }}>
          v{version.versionNumber} · {version.versionLabel}
        </span>
      </div>

      {/* ── Snapshot banner ────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          padding: "14px 20px",
          backgroundColor: isActive ? "#F0FDF4" : "#FFFBEB",
          border: `1.5px solid ${isActive ? "#BBF7D0" : "#FDE68A"}`,
          borderRadius: "14px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "20px" }}>{isActive ? "✅" : "🕓"}</span>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#111827" }}>
              {isActive
                ? "This is the currently active version"
                : "You are viewing a historical snapshot — the working copy is not affected"}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6B7280" }}>
              v{version.versionNumber} · Saved {formatDate(version.createdAt)}
              {version.changeNotes ? ` · "${version.changeNotes}"` : ""}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`, textTransform: "uppercase" }}>
            {s.label}
          </span>
          {!isActive && (
            <button type="button" onClick={() => setConfirmRevert(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", backgroundColor: "#0D47A1", color: "#fff", border: "none", borderRadius: "9px", fontSize: "12px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              ↩ Revert to this Version
            </button>
          )}
        </div>
      </div>

      {/* ── Hero card ──────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: "#fff", borderRadius: "20px", boxShadow: "0 4px 20px rgba(13,71,161,0.08), 0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden", marginBottom: "20px" }}>
        {/* Gradient bar */}
        <div style={{ background: "linear-gradient(135deg, #0A3880 0%, #0D47A1 40%, #1565C0 70%, #1976D2 100%)", padding: "24px 28px 28px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-30px", right: "-30px", width: "140px", height: "140px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
          <span style={{ display: "inline-block", padding: "4px 12px", backgroundColor: "rgba(255,255,255,0.18)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "20px", fontSize: "12px", fontWeight: "700", marginBottom: "12px" }}>
            {snap.framework || "—"}
          </span>
          <h1 style={{ margin: "0 0 5px", fontSize: "22px", fontWeight: "900", color: "#fff", letterSpacing: "-0.4px", position: "relative" }}>
            {snap.name || "—"}
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.7)", position: "relative" }}>
            {[snap.code, snap.academicYear, cycleLabel(model)].filter(Boolean).join("  ·  ")}
          </p>
          {snap.description && (
            <p style={{ margin: "8px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.65)", lineHeight: "1.6", maxWidth: "540px", position: "relative" }}>
              {snap.description}
            </p>
          )}
        </div>

        {/* Stats bar */}
        <div style={{ padding: "18px 28px", display: "flex", gap: "10px", flexWrap: "wrap", borderBottom: "1px solid #F0F4F8" }}>
          {[
            { label: cycleLabel(model), value: periods.length,    icon: "📆", bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
            { label: "Classes",         value: totalClasses,       icon: "🎓", bg: "#DBEAFE", color: "#1565C0", border: "#93C5FD" },
            { label: "Courses",         value: totalCourses,       icon: "📚", bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
            { label: "Configured",      value: `${configuredTerms}/${periods.length}`, icon: "✅", bg: "#F0F7FF", color: "#1E40AF", border: "#C7D9F8" },
          ].map((stat) => (
            <div key={stat.label} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", backgroundColor: stat.bg, border: `1px solid ${stat.border}`, borderRadius: "12px", flex: "1 0 110px" }}>
              <span style={{ fontSize: "18px" }}>{stat.icon}</span>
              <div>
                <p style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: stat.color, lineHeight: 1 }}>{stat.value}</p>
                <p style={{ margin: "2px 0 0", fontSize: "10px", fontWeight: "700", color: stat.color, opacity: 0.65, textTransform: "uppercase", letterSpacing: "0.06em" }}>{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {periods.length > 0 && (
          <div style={{ padding: "12px 28px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#6B7280" }}>Structure in snapshot</span>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#0D47A1" }}>{configuredTerms} of {periods.length} {cycleLabel(model).toLowerCase()} configured</span>
            </div>
            <div style={{ height: "5px", backgroundColor: "#EEF2F7", borderRadius: "10px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${periods.length > 0 ? (configuredTerms / periods.length) * 100 : 0}%`, background: "linear-gradient(90deg, #0D47A1, #42A5F5)", borderRadius: "10px", transition: "width 0.5s ease" }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Academic structure (read-only) ─────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
          Academic Structure — Snapshot
        </h2>
        <div style={{ flex: 1, height: "1px", backgroundColor: "#E5E7EB" }} />
        {periods.length > 0 && (
          <span style={{ padding: "3px 10px", backgroundColor: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: "20px", fontSize: "11px", fontWeight: "600", whiteSpace: "nowrap" }}>
            {periods.length} {cycleLabel(model).toLowerCase()}
          </span>
        )}
      </div>

      {periods.length === 0 ? (
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "40px 24px", textAlign: "center" }}>
          <span style={{ fontSize: "28px" }}>📭</span>
          <p style={{ margin: "10px 0 0", fontSize: "13px", color: "#9CA3AF" }}>No academic periods were configured when this snapshot was taken.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {periods.map((period, i) => (
            <TermAccordion
              key={i}
              period={period}
              termIndex={i}
              termData={structure[i] || { grades: [] }}
              model={model}
              isOpen={expandedTerms.has(i)}
              onToggle={() => toggleTerm(i)}
              expandedGrades={expandedGrades}
              onToggleGrade={toggleGrade}
            />
          ))}
        </div>
      )}

      {/* Bottom revert button (repeated for convenience) */}
      {!isActive && (
        <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => setConfirmRevert(true)} disabled={reverting}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "10px 20px", backgroundColor: reverting ? "#93C5FD" : "#0D47A1", color: "#fff", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: reverting ? "not-allowed" : "pointer", boxShadow: "0 2px 8px rgba(13,71,161,0.2)" }}>
            {reverting ? (
              <>
                <span style={{ width: "13px", height: "13px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                Reverting…
              </>
            ) : "↩ Revert to this Version"}
          </button>
        </div>
      )}

      <div style={{ height: "32px" }} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Revert confirmation ─────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={confirmRevert}
        title="Revert to this version?"
        message={`The current working copy will be overwritten with the data from v${version.versionNumber} "${version.versionLabel}". Unsaved edits in the working copy will be lost. This does not change any published version.`}
        confirmLabel="Yes, Revert"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleRevert}
        onCancel={() => setConfirmRevert(false)}
      />
    </div>
  );
}
