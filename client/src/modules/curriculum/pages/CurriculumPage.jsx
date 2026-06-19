import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCurriculaQuery } from "../hooks/useCurriculum";
import { useDispatch, useSelector } from "react-redux";
import { setFilter, clearFilters } from "../../../store/curriculumSlice";
import { FRAMEWORKS } from "../schemas/curriculum.schema";

const FRAMEWORK_BADGE_COLORS = {
  CBC:       { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  IGCSE:     { bg: "#DBEAFE", color: "#1565C0", border: "#93C5FD" },
  IB:        { bg: "#EFF6FF", color: "#1E40AF", border: "#BFDBFE" },
  National:  { bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
  Cambridge: { bg: "#DBEAFE", color: "#1E3A8A", border: "#93C5FD" },
  Custom:    { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
};

const CYCLE_LABELS = { terms: "Terms", semesters: "Semesters", custom: "Custom" };

function FrameworkBadge({ framework }) {
  const colors = FRAMEWORK_BADGE_COLORS[framework] || FRAMEWORK_BADGE_COLORS.Custom;
  return (
    <span
      style={{
        padding: "2px 9px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: "600",
        backgroundColor: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      }}
    >
      {framework}
    </span>
  );
}

function CurriculumCard({ curriculum }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  const periodCount = curriculum.periods?.length || 0;
  const classCount = (curriculum.structure || []).reduce(
    (s, t) => s + (t.grades?.length || 0),
    0
  );
  const courseCount = (curriculum.structure || []).reduce(
    (s, t) => s + (t.grades?.reduce((gs, g) => gs + (g.courses?.length || 0), 0) || 0),
    0
  );
  const hasStructure = classCount > 0;

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "14px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "box-shadow 0.15s",
      }}
    >
      {/* Blue top accent */}
      <div
        style={{
          height: "3px",
          background: "linear-gradient(90deg, #0D47A1, #42A5F5)",
        }}
      />

      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
        {/* Top row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              onClick={() => navigate(`/curriculum/${curriculum.id}/edit`)}
              style={{
                margin: "0 0 4px 0",
                fontSize: "15px",
                fontWeight: "700",
                color: "#111827",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                cursor: "pointer",
              }}
            >
              {curriculum.name}
            </h3>
            <div
              style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}
            >
              <span style={{ fontSize: "12px", color: "#6B7280", fontWeight: "500" }}>
                {curriculum.code}
              </span>
              <span style={{ color: "#D1D5DB" }}>·</span>
              <span style={{ fontSize: "12px", color: "#6B7280" }}>
                {curriculum.academicYear}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <FrameworkBadge framework={curriculum.framework} />
            {/* Kebab menu */}
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                style={{
                  width: "30px",
                  height: "30px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: menuOpen ? "#EFF6FF" : "transparent",
                  border: `1px solid ${menuOpen ? "#BFDBFE" : "transparent"}`,
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "18px",
                  color: "#6B7280",
                  lineHeight: 1,
                  fontFamily: "Inter, sans-serif",
                  transition: "all 0.15s",
                }}
              >
                ⋮
              </button>
              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    backgroundColor: "#ffffff",
                    border: "1px solid #E5E7EB",
                    borderRadius: "10px",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                    zIndex: 100,
                    minWidth: "140px",
                    overflow: "hidden",
                  }}
                >
                  {[
                    { label: "✏ Edit", path: `/curriculum/${curriculum.id}/edit` },
                    { label: "🏗 Structure", path: `/curriculum/${curriculum.id}/structure` },
                    { label: "👁 View", path: `/curriculum/${curriculum.id}/view` },
                  ].map(({ label, path }, idx, arr) => (
                    <button
                      key={path}
                      type="button"
                      onClick={() => { setMenuOpen(false); navigate(path); }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "10px 14px",
                        textAlign: "left",
                        backgroundColor: "transparent",
                        border: "none",
                        fontSize: "13px",
                        fontWeight: "500",
                        fontFamily: "Inter, sans-serif",
                        color: "#374151",
                        cursor: "pointer",
                        borderBottom: idx < arr.length - 1 ? "1px solid #F3F4F6" : "none",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#EFF6FF"; e.currentTarget.style.color = "#0D47A1"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#374151"; }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {curriculum.description && (
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "#6B7280",
              lineHeight: "1.5",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {curriculum.description}
          </p>
        )}

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            paddingTop: "10px",
            borderTop: "1px solid #F3F4F6",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: "#9CA3AF",
                textTransform: "uppercase",
              }}
            >
              Cycle
            </span>
            <p
              style={{
                margin: "2px 0 0 0",
                fontSize: "13px",
                fontWeight: "500",
                color: "#374151",
              }}
            >
              {CYCLE_LABELS[curriculum.academicCycleModel] || curriculum.academicCycleModel}
            </p>
          </div>
          <div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: "#9CA3AF",
                textTransform: "uppercase",
              }}
            >
              Periods
            </span>
            <p
              style={{
                margin: "2px 0 0 0",
                fontSize: "13px",
                fontWeight: "500",
                color: "#374151",
              }}
            >
              {periodCount}
            </p>
          </div>
          {hasStructure && (
            <>
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#9CA3AF",
                    textTransform: "uppercase",
                  }}
                >
                  Classes
                </span>
                <p
                  style={{
                    margin: "2px 0 0 0",
                    fontSize: "13px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  {classCount}
                </p>
              </div>
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#9CA3AF",
                    textTransform: "uppercase",
                  }}
                >
                  Courses
                </span>
                <p
                  style={{
                    margin: "2px 0 0 0",
                    fontSize: "13px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  {courseCount}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
}

function EmptyState({ hasFilters, onClearFilters, onCreateNew }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 24px",
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontSize: "48px", marginBottom: "16px" }}>📚</div>
      <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#111827" }}>
        {hasFilters ? "No results found" : "No curricula yet"}
      </h3>
      <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6B7280" }}>
        {hasFilters
          ? "Try adjusting your filters to see more results."
          : "Create your first curriculum to get started."}
      </p>
      {hasFilters ? (
        <button
          type="button"
          onClick={onClearFilters}
          style={{
            padding: "10px 24px",
            backgroundColor: "transparent",
            color: "#0D47A1",
            border: "1.5px solid #0D47A1",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            fontFamily: "Inter, sans-serif",
            cursor: "pointer",
          }}
        >
          Clear Filters
        </button>
      ) : (
        <button
          type="button"
          onClick={onCreateNew}
          style={{
            padding: "10px 24px",
            backgroundColor: "#0D47A1",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            fontFamily: "Inter, sans-serif",
            cursor: "pointer",
          }}
        >
          + Create Curriculum
        </button>
      )}
    </div>
  );
}

export default function CurriculumPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const filters = useSelector((state) => state.curriculum.filters);
  const { data, isLoading, isError, error } = useCurriculaQuery();

  const curricula = data?.data || [];
  const hasFilters = !!filters.framework || !!filters.academicYear;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 2px 0", fontSize: "22px", fontWeight: "700", color: "#111827" }}>
            Curriculum
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
            {isLoading ? "Loading..." : `${curricula.length} curriculum${curricula.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/curriculum/create")}
          style={{
            padding: "10px 20px",
            backgroundColor: "#0D47A1",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            fontFamily: "Inter, sans-serif",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span style={{ fontSize: "16px" }}>+</span>
          Create Curriculum
        </button>
      </div>

      {/* Filter bar */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          padding: "14px 18px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <select
          value={filters.framework}
          onChange={(e) => dispatch(setFilter({ framework: e.target.value }))}
          style={{
            padding: "8px 32px 8px 12px",
            borderRadius: "8px",
            border: "1px solid #E5E7EB",
            fontSize: "13px",
            fontFamily: "Inter, sans-serif",
            backgroundColor: "#F9FAFB",
            color: "#374151",
            outline: "none",
            cursor: "pointer",
            appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
          }}
        >
          <option value="">All Frameworks</option>
          {FRAMEWORKS.map((fw) => (
            <option key={fw} value={fw}>{fw}</option>
          ))}
        </select>

        <input
          type="text"
          value={filters.academicYear}
          onChange={(e) => dispatch(setFilter({ academicYear: e.target.value }))}
          placeholder="Filter by year..."
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid #E5E7EB",
            fontSize: "13px",
            fontFamily: "Inter, sans-serif",
            backgroundColor: "#F9FAFB",
            color: "#374151",
            outline: "none",
            width: "160px",
          }}
        />

        {hasFilters && (
          <button
            type="button"
            onClick={() => dispatch(clearFilters())}
            style={{
              padding: "7px 14px",
              backgroundColor: "transparent",
              color: "#6B7280",
              border: "1px solid #E5E7EB",
              borderRadius: "8px",
              fontSize: "13px",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
            }}
          >
            ✕ Clear
          </button>
        )}

        <span style={{ marginLeft: "auto", fontSize: "13px", color: "#9CA3AF" }}>
          {curricula.length} result{curricula.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#9CA3AF", fontSize: "14px" }}>
          Loading curricula...
        </div>
      ) : isError ? (
        <div
          style={{
            padding: "20px 24px",
            backgroundColor: "#FFF5F5",
            border: "1px solid #FECACA",
            borderRadius: "12px",
            color: "#EF4444",
            fontSize: "14px",
          }}
        >
          ⚠ Failed to load curricula: {error?.message}
        </div>
      ) : curricula.length === 0 ? (
        <EmptyState
          hasFilters={hasFilters}
          onClearFilters={() => dispatch(clearFilters())}
          onCreateNew={() => navigate("/curriculum/create")}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "16px",
          }}
        >
          {curricula.map((curriculum) => (
            <CurriculumCard
              key={curriculum.id}
              curriculum={curriculum}
            />
          ))}
        </div>
      )}
    </div>
  );
}
