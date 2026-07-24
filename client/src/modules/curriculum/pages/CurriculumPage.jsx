import { CalendarMonth as CalendarMonthIcon, Clear as ClearIcon, MenuBook as MenuBookIcon, School as SchoolIcon, WarningAmber as WarningAmberIcon } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useCurriculaQuery } from "../hooks/useCurriculum";
import { useDispatch, useSelector } from "react-redux";
import { setFilter, clearFilters } from "../../../store/curriculumSlice";
import { FRAMEWORKS } from "../schemas/curriculum.schema";
import CurriculumCard from "../components/CurriculumCard";

/* ── Empty state ──────────────────────────────────────────────────────── */

function EmptyState({ hasFilters, onClearFilters, onCreateNew }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "64px 24px",
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "18px",
          background: "linear-gradient(135deg, #e8f5fb, #d6edf8)",
          border: "2px solid #a8d5ee",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "32px",
          margin: "0 auto 20px",
        }}
      >
        <MenuBookIcon fontSize="large" />
      </div>
      <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#111827" }}>
        {hasFilters ? "No results found" : "No curricula yet"}
      </h3>
      <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6B7280", lineHeight: "1.6" }}>
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
            color: "#25476a",
            border: "1.5px solid #25476a",
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
            backgroundColor: "#feb139",
            color: "#25476a",
            border: "none",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            fontFamily: "Inter, sans-serif",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(254,177,57,0.35)",
          }}
        >
          + Create Curriculum
        </button>
      )}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function CurriculumPage() {
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const filters   = useSelector((state) => state.curriculum.filters);
  const { data, isLoading, isError, error } = useCurriculaQuery();

  // Program-flagged curricula live under /programs instead — see CurriculumStructurePage's
  // "This is a Program" toggle.
  const curricula  = (data?.data || []).filter((c) => !c.isProgram);
  const hasFilters = !!filters.framework || !!filters.academicYear;

  /* Aggregate stats */
  const totalClasses = curricula.reduce((s, c) => s + (c.classes?.length || 0), 0);
  const totalPeriods = curricula.reduce((s, c) => s + (c.periods?.length || 0), 0);
  const typesUsed    = new Set(curricula.map((c) => c.curriculumType).filter(Boolean)).size;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>

      {/* ── Hero strip ──────────────────────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A3880 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)",
          borderRadius: "20px",
          padding: "28px 32px",
          marginBottom: "16px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: "-40px", right: "-40px",  width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20px", right: "120px", width: "100px", height: "100px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "16px", right: "240px",   width: "50px",  height: "50px",  borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", position: "relative" }}>
          <div>
            <h1
              style={{
                margin: "0 0 6px 0",
                fontSize: "24px",
                fontWeight: "900",
                color: "#ffffff",
                letterSpacing: "-0.4px",
                lineHeight: 1.2,
              }}
            >
              Curriculum
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "480px" }}>
              Manage your school's academic frameworks, terms, classes, and course assignments all in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/curriculum/create")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "11px 22px",
              backgroundColor: "#feb139",
              color: "#25476a",
              border: "none",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: "700",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(254,177,57,0.35)",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
            Create Curriculum
          </button>
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        {[
          { label: "Total Curricula",  value: isLoading ? "—" : curricula.length, icon: <MenuBookIcon />, bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
          { label: "Total Classes",   value: isLoading ? "—" : totalClasses,     icon: <SchoolIcon />, bg: "#d6edf8", color: "#2e7db5", border: "#b8d9ee" },
          { label: "Total Periods",   value: isLoading ? "—" : totalPeriods,     icon: <CalendarMonthIcon />, bg: "#E0F2FE", color: "#38aae1", border: "#a8d5ee" },
          { label: "Types in Use",      value: isLoading ? "—" : typesUsed,       icon: <MenuBookIcon />, bg: "#F0F7FF", color: "#25476a", border: "#C7D9F8" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "14px",
              border: `1.5px solid ${stat.border}`,
              padding: "16px 18px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "11px",
                backgroundColor: stat.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                flexShrink: 0,
              }}
            >
              {stat.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "800", color: stat.color, lineHeight: 1 }}>
                {stat.value}
              </p>
              <p style={{ margin: "3px 0 0 0", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          padding: "12px 16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
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
            <><ClearIcon fontSize="small" /> Clear</>
          </button>
        )}

        <span style={{ marginLeft: "auto", fontSize: "13px", color: "#9CA3AF" }}>
          {isLoading ? "Loading..." : `${curricula.length} result${curricula.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      {isLoading ? (
        /* Loading skeleton */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "16px",
          }}
        >
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                overflow: "hidden",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ height: "3px", background: "linear-gradient(90deg, #E8EFF8, #EEF4FC)" }} />
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: "16px", width: "60%", backgroundColor: "#EEF2F7", borderRadius: "6px", marginBottom: "8px" }} />
                    <div style={{ height: "12px", width: "40%", backgroundColor: "#F3F4F6", borderRadius: "5px" }} />
                  </div>
                  <div style={{ height: "22px", width: "56px", backgroundColor: "#EEF2F7", borderRadius: "20px" }} />
                </div>
                <div style={{ height: "12px", width: "80%", backgroundColor: "#F3F4F6", borderRadius: "5px" }} />
                <div style={{ height: "12px", width: "65%", backgroundColor: "#F3F4F6", borderRadius: "5px" }} />
                <div style={{ paddingTop: "10px", borderTop: "1px solid #F3F4F6" }}>
                  <div style={{ height: "5px", backgroundColor: "#EEF2F7", borderRadius: "10px" }} />
                </div>
              </div>
            </div>
          ))}
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <WarningAmberIcon fontSize="small" />
            Failed to load curricula: {error?.message}
          </div>
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
            <CurriculumCard key={curriculum.id} curriculum={curriculum} />
          ))}
        </div>
      )}
    </div>
  );
}
