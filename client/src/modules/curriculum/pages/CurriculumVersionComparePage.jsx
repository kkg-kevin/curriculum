import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCurriculumQuery } from "../hooks/useCurriculum";
import { useCurriculumVersionQuery } from "../hooks/useCurriculumVersions";

/* ── Diff computation ─────────────────────────────────────────────────── */

const FIELD_DEFS = [
  { key: "name",               label: "Curriculum Name", multiline: false },
  { key: "code",               label: "Code",            multiline: false },
  { key: "academicYear",       label: "Academic Year",   multiline: false },
  { key: "framework",          label: "Framework",       multiline: false },
  { key: "academicCycleModel", label: "Academic Cycle",  multiline: false },
  { key: "educationLevel",     label: "Education Level", multiline: false },
  { key: "gradeFrom",          label: "Grade From",      multiline: false },
  { key: "gradeTo",            label: "Grade To",        multiline: false },
  { key: "description",        label: "Description",     multiline: true  },
];

function diffType(a, b) {
  if (!a && !b) return "unchanged";
  if (!a && b)  return "added";
  if (a && !b)  return "removed";
  if (a !== b)  return "changed";
  return "unchanged";
}

function computeFieldDiffs(snapA, snapB) {
  return FIELD_DEFS.map(({ key, label, multiline }) => {
    const valA = String(snapA?.[key] ?? "");
    const valB = String(snapB?.[key] ?? "");
    return { key, label, multiline, valA, valB, type: diffType(valA, valB) };
  });
}

function structureStats(snap) {
  const periods   = snap?.periods   || [];
  const structure = snap?.structure || [];
  const classes   = structure.reduce((s, t) => s + (t.grades?.length || 0), 0);
  const courses   = structure.reduce(
    (s, t) => s + (t.grades?.reduce((gs, g) => gs + (g.courses?.length || 0), 0) || 0),
    0
  );
  return { periods: periods.length, classes, courses };
}

function computeStructureDiff(snapA, snapB) {
  const a = structureStats(snapA);
  const b = structureStats(snapB);
  return [
    { label: "Periods / Terms", a: a.periods, b: b.periods },
    { label: "Classes",         a: a.classes, b: b.classes },
    { label: "Courses",         a: a.courses, b: b.courses },
  ];
}

/* ── Style helpers ─────────────────────────────────────────────────────── */

const DIFF_STYLE = {
  unchanged: { row: "transparent",   badge: null },
  changed:   { row: "#FFFBEB",       badge: { bg: "#FEF3C7", color: "#92400E", label: "Changed" } },
  added:     { row: "#F0FDF4",       badge: { bg: "#DCFCE7", color: "#15803D", label: "Added"   } },
  removed:   { row: "#FEF2F2",       badge: { bg: "#FEE2E2", color: "#B91C1C", label: "Removed" } },
};

/* ── Field diff row ─────────────────────────────────────────────────────── */

function FieldRow({ label, valA, valB, type, multiline }) {
  const style = DIFF_STYLE[type] || DIFF_STYLE.unchanged;
  const isChanged = type !== "unchanged";

  const cellStyle = (val, side) => ({
    flex: 1,
    padding: "10px 14px",
    fontSize: "13px",
    lineHeight: "1.5",
    color:
      type === "removed" && side === "a" ? "#B91C1C"
      : type === "added" && side === "b" ? "#15803D"
      : type === "changed" ? (side === "a" ? "#92400E" : "#15803D")
      : val ? "#111827" : "#9CA3AF",
    fontStyle: val ? "normal" : "italic",
    wordBreak: "break-word",
    whiteSpace: multiline ? "pre-wrap" : "normal",
    backgroundColor: "transparent",
    textDecoration: type === "removed" && side === "a" ? "line-through" : "none",
    fontWeight: isChanged ? "600" : "400",
  });

  return (
    <div style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid #F3F4F6", backgroundColor: style.row, transition: "background-color 0.1s" }}>
      {/* Label */}
      <div style={{ width: "140px", flexShrink: 0, padding: "10px 14px", backgroundColor: "#FAFAFA", borderRight: "1px solid #F3F4F6", display: "flex", alignItems: "flex-start", gap: "6px" }}>
        <span style={{ fontSize: "12px", fontWeight: "600", color: isChanged ? "#374151" : "#9CA3AF" }}>{label}</span>
        {style.badge && (
          <span style={{ padding: "1px 6px", borderRadius: "5px", fontSize: "9px", fontWeight: "800", backgroundColor: style.badge.bg, color: style.badge.color, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap", flexShrink: 0 }}>
            {style.badge.label}
          </span>
        )}
      </div>
      {/* From value */}
      <div style={cellStyle(valA, "a")}>{valA || "—"}</div>
      {/* Divider */}
      <div style={{ width: "1px", backgroundColor: "#F3F4F6", flexShrink: 0 }} />
      {/* To value */}
      <div style={cellStyle(valB, "b")}>{valB || "—"}</div>
    </div>
  );
}

/* ── Structure diff row ─────────────────────────────────────────────────── */

function StructureRow({ label, a, b, isLast }) {
  const changed = a !== b;
  const delta   = b - a;
  const sign    = delta > 0 ? "+" : "";

  return (
    <div style={{ display: "flex", alignItems: "center", borderBottom: isLast ? "none" : "1px solid #F3F4F6", backgroundColor: changed ? "#FFFBEB" : "transparent" }}>
      <div style={{ width: "140px", flexShrink: 0, padding: "10px 14px", backgroundColor: "#FAFAFA", borderRight: "1px solid #F3F4F6" }}>
        <span style={{ fontSize: "12px", fontWeight: "600", color: changed ? "#374151" : "#9CA3AF" }}>{label}</span>
      </div>
      <div style={{ flex: 1, padding: "10px 14px", fontSize: "13px", fontWeight: changed ? "700" : "400", color: changed ? "#92400E" : "#111827" }}>{a}</div>
      <div style={{ width: "1px", backgroundColor: "#F3F4F6", flexShrink: 0 }} />
      <div style={{ flex: 1, padding: "10px 14px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "13px", fontWeight: changed ? "700" : "400", color: changed ? "#15803D" : "#111827" }}>{b}</span>
        {changed && (
          <span style={{ padding: "1px 6px", borderRadius: "5px", fontSize: "11px", fontWeight: "700", backgroundColor: delta > 0 ? "#DCFCE7" : "#FEE2E2", color: delta > 0 ? "#15803D" : "#B91C1C" }}>
            {sign}{delta}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Loading skeleton ─────────────────────────────────────────────────── */

function Sk({ w, h, r = "8px", mb = "0" }) {
  return <div style={{ width: w, height: h, borderRadius: r, backgroundColor: "#EEF2F7", marginBottom: mb, flexShrink: 0 }} />;
}

/* ── Main page ─────────────────────────────────────────────────────────── */

export default function CurriculumVersionComparePage() {
  const { id, vIdA, vIdB } = useParams();
  const navigate = useNavigate();

  const [showUnchanged, setShowUnchanged] = useState(false);

  const { data: curriculumData }              = useCurriculumQuery(id);
  const { data: dataA, isLoading: loadingA }  = useCurriculumVersionQuery(id, vIdA);
  const { data: dataB, isLoading: loadingB }  = useCurriculumVersionQuery(id, vIdB);

  const curriculum = curriculumData;

  if (loadingA || loadingB) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: "12px" }}>
        <Sk w="200px" h="32px" r="8px" />
        <Sk w="100%" h="140px" r="16px" />
        <Sk w="100%" h="320px" r="14px" />
      </div>
    );
  }

  const versionA = dataA?.data;
  const versionB = dataB?.data;

  if (!versionA || !versionB) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "14px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ One or both versions could not be found.
      </div>
    );
  }

  const snapA = versionA.snapshot || {};
  const snapB = versionB.snapshot || {};

  const fieldDiffs   = computeFieldDiffs(snapA, snapB);
  const structureDiff = computeStructureDiff(snapA, snapB);

  const changedCount   = fieldDiffs.filter((f) => f.type !== "unchanged").length;
  const unchangedCount = fieldDiffs.filter((f) => f.type === "unchanged").length;
  const addedCount     = fieldDiffs.filter((f) => f.type === "added").length;
  const removedCount   = fieldDiffs.filter((f) => f.type === "removed").length;
  const modifiedCount  = fieldDiffs.filter((f) => f.type === "changed").length;
  const structureChanged = structureDiff.some((r) => r.a !== r.b);

  const visibleFields = showUnchanged
    ? fieldDiffs
    : fieldDiffs.filter((f) => f.type !== "unchanged");

  const STATUS = {
    active:   { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0" },
    draft:    { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" },
    archived: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
  };

  const sA = STATUS[versionA.status] || STATUS.archived;
  const sB = STATUS[versionB.status] || STATUS.archived;

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

  const totalChanges = changedCount + (structureChanged ? 1 : 0);

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
        <span style={{ fontSize: "13px", color: "#111827", fontWeight: "600" }}>Compare</span>
      </div>

      {/* ── Header card ─────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: "#fff", borderRadius: "18px", border: "1.5px solid #E5E7EB", overflow: "hidden", marginBottom: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        {/* Blue gradient bar */}
        <div style={{ background: "linear-gradient(135deg, #0A3880 0%, #1565C0 60%, #1976D2 100%)", padding: "20px 24px" }}>
          <p style={{ margin: "0 0 14px", fontSize: "11px", fontWeight: "800", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Version Diff
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            {/* Version A */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "32px", height: "32px", borderRadius: "10px", backgroundColor: "rgba(255,255,255,0.2)", color: "#fff", fontSize: "12px", fontWeight: "800", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                v{versionA.versionNumber}
              </span>
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#fff" }}>{versionA.versionLabel}</p>
                <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>{formatDate(versionA.createdAt)}</p>
              </div>
              <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "10px", fontWeight: "700", backgroundColor: sA.bg, color: sA.color, border: `1px solid ${sA.border}`, textTransform: "uppercase" }}>
                {versionA.status}
              </span>
            </div>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "20px", height: "1px", backgroundColor: "rgba(255,255,255,0.3)" }} />
              <span style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", color: "#fff", fontSize: "13px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>→</span>
              <div style={{ width: "20px", height: "1px", backgroundColor: "rgba(255,255,255,0.3)" }} />
            </div>

            {/* Version B */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "32px", height: "32px", borderRadius: "10px", backgroundColor: "rgba(255,255,255,0.2)", color: "#fff", fontSize: "12px", fontWeight: "800", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                v{versionB.versionNumber}
              </span>
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#fff" }}>{versionB.versionLabel}</p>
                <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>{formatDate(versionB.createdAt)}</p>
              </div>
              <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "10px", fontWeight: "700", backgroundColor: sB.bg, color: sB.color, border: `1px solid ${sB.border}`, textTransform: "uppercase" }}>
                {versionB.status}
              </span>
            </div>
          </div>
        </div>

        {/* Change summary bar */}
        <div style={{ padding: "14px 24px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {totalChanges === 0 ? (
            <span style={{ fontSize: "13px", color: "#6B7280", fontStyle: "italic" }}>No differences detected between these two versions.</span>
          ) : (
            <>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>
                {totalChanges} {totalChanges === 1 ? "difference" : "differences"} detected
              </span>
              {modifiedCount > 0 && (
                <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}>
                  {modifiedCount} changed
                </span>
              )}
              {addedCount > 0 && (
                <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: "#DCFCE7", color: "#15803D", border: "1px solid #BBF7D0" }}>
                  {addedCount} added
                </span>
              )}
              {removedCount > 0 && (
                <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: "#FEE2E2", color: "#B91C1C", border: "1px solid #FECACA" }}>
                  {removedCount} removed
                </span>
              )}
              {structureChanged && (
                <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: "#F5F3FF", color: "#6D28D9", border: "1px solid #DDD6FE" }}>
                  structure changed
                </span>
              )}
            </>
          )}
          <div style={{ flex: 1 }} />
          {/* Toggle unchanged */}
          <button type="button" onClick={() => setShowUnchanged((p) => !p)}
            style={{ padding: "5px 11px", borderRadius: "7px", border: "1.5px solid #E5E7EB", backgroundColor: showUnchanged ? "#EFF6FF" : "#fff", color: showUnchanged ? "#1D4ED8" : "#6B7280", fontSize: "11px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}>
            {showUnchanged ? "Hide unchanged" : `Show all (${unchangedCount} unchanged)`}
          </button>
        </div>

        {/* Column header */}
        <div style={{ display: "flex", backgroundColor: "#F9FAFB", borderBottom: "2px solid #E5E7EB" }}>
          <div style={{ width: "140px", flexShrink: 0, padding: "8px 14px", fontSize: "10px", fontWeight: "800", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em" }}>Field</div>
          <div style={{ flex: 1, padding: "8px 14px", fontSize: "10px", fontWeight: "800", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ padding: "1px 7px", backgroundColor: "#E5E7EB", color: "#6B7280", borderRadius: "5px", fontSize: "10px", fontWeight: "700" }}>v{versionA.versionNumber}</span>
            {versionA.versionLabel}
          </div>
          <div style={{ width: "1px", backgroundColor: "#E5E7EB", flexShrink: 0 }} />
          <div style={{ flex: 1, padding: "8px 14px", fontSize: "10px", fontWeight: "800", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ padding: "1px 7px", backgroundColor: "#DBEAFE", color: "#1D4ED8", borderRadius: "5px", fontSize: "10px", fontWeight: "700" }}>v{versionB.versionNumber}</span>
            {versionB.versionLabel}
          </div>
        </div>

        {/* Field diff rows */}
        {visibleFields.length === 0 ? (
          <div style={{ padding: "28px 24px", textAlign: "center", color: "#9CA3AF", fontSize: "13px" }}>
            {totalChanges === 0 ? "All fields are identical between these versions." : "No changed fields to show — click ‘Show all’ to reveal unchanged fields."}
          </div>
        ) : (
          visibleFields.map((field) => (
            <FieldRow key={field.key} {...field} />
          ))
        )}
      </div>

      {/* ── Structure diff ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
        <h2 style={{ margin: 0, fontSize: "12px", fontWeight: "800", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
          Structure
        </h2>
        <div style={{ flex: 1, height: "1px", backgroundColor: "#E5E7EB" }} />
        {structureChanged && (
          <span style={{ padding: "2px 8px", backgroundColor: "#F5F3FF", color: "#6D28D9", border: "1px solid #DDD6FE", borderRadius: "20px", fontSize: "10px", fontWeight: "700" }}>Changed</span>
        )}
      </div>

      <div style={{ backgroundColor: "#fff", borderRadius: "14px", border: "1.5px solid #E5E7EB", overflow: "hidden", marginBottom: "24px" }}>
        {/* Column header */}
        <div style={{ display: "flex", backgroundColor: "#F9FAFB", borderBottom: "2px solid #E5E7EB" }}>
          <div style={{ width: "140px", flexShrink: 0, padding: "8px 14px", fontSize: "10px", fontWeight: "800", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em" }}>Metric</div>
          <div style={{ flex: 1, padding: "8px 14px", fontSize: "10px", fontWeight: "800", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em" }}>v{versionA.versionNumber} · {versionA.versionLabel}</div>
          <div style={{ width: "1px", backgroundColor: "#E5E7EB", flexShrink: 0 }} />
          <div style={{ flex: 1, padding: "8px 14px", fontSize: "10px", fontWeight: "800", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em" }}>v{versionB.versionNumber} · {versionB.versionLabel}</div>
        </div>
        {structureDiff.map((row, i) => (
          <StructureRow key={row.label} {...row} isLast={i === structureDiff.length - 1} />
        ))}
      </div>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "32px" }}>
        <button type="button" onClick={() => navigate(`/curriculum/${id}/versions/${vIdA}`)}
          style={{ padding: "8px 16px", backgroundColor: "#F9FAFB", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "9px", fontSize: "12px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          View v{versionA.versionNumber} →
        </button>
        <button type="button" onClick={() => navigate(`/curriculum/${id}/versions/${vIdB}`)}
          style={{ padding: "8px 16px", backgroundColor: "#EFF6FF", color: "#1D4ED8", border: "1.5px solid #BFDBFE", borderRadius: "9px", fontSize: "12px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          View v{versionB.versionNumber} →
        </button>
      </div>
    </div>
  );
}
