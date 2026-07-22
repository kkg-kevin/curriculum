import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { useLearningHubQuery as useSchoolQuery } from "../../learning-hubs/hooks/useLearningHub";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { classApi } from "../services/classApi";
import { teacherApi } from "../../teachers/services/teacherApi";
import { ClassCard } from "../components/ClassCard";
import SetUpYearPanel from "../components/SetUpYearPanel";
import { classCreatePath } from "../../../routes/portalPaths";

const ACCENT    = "#25476a";
const GRAD_FROM = "#1a3550";
const GRAD_TO   = "#38aae1";

const selectStyle = { padding: "8px 32px 8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", backgroundColor: "#F9FAFB", color: "#374151", outline: "none", cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" };

export default function SchoolClassesPage() {
  const { schoolId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const backPath  = user?.role === "school" ? "/school-portal" : "/classes";
  const backLabel = user?.role === "school" ? "Dashboard" : "Classes";
  const [statusFilter, setStatusFilter] = useState("");
  const [searchParams] = useSearchParams();

  const [setupOpen, setSetupOpen] = useState(() => searchParams.get("setup") === "1");

  const { data: school, isLoading: schoolLoading } = useSchoolQuery(schoolId);

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", "bySchool", schoolId, statusFilter],
    queryFn: () => classApi.getAll({ schoolId, ...(statusFilter ? { status: statusFilter } : {}) }),
    enabled: !!schoolId,
  });

  const { data: teachersData } = useQuery({
    queryKey: ["teachers", "bySchool", schoolId],
    queryFn: () => teacherApi.getAll({ schoolId }),
    enabled: !!schoolId,
  });

  const classes     = classesData?.data || [];
  const teachersMap = (teachersData?.data || []).reduce((m, t) => { m[t.id] = t; return m; }, {});
  const activeCount = classes.filter((c) => c.status === "active").length;

  // Fetched directly by id (not the full curricula list — a school/teacher account can only
  // ever read its own curriculum, not enumerate every curriculum in the system).
  const { data: curriculum } = useCurriculumQuery(school?.curriculumId);

  if (schoolLoading) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B7280" }}>Loading…</div>;
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={() => navigate(backPath)}
          style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          ← {backLabel}
        </button>
        <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>{school?.name || "School"}</span>
      </div>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${GRAD_FROM} 0%, #25476a 40%, #2e7db5 75%, ${GRAD_TO} 100%)`, borderRadius: 20, padding: "28px 32px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#ffffff", flexShrink: 0 }}>
              {school?.name?.[0]?.toUpperCase() || "S"}
            </div>
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.4px" }}>{school?.name}</h1>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
                {school?.address?.county ? `${school.address.county} County · ` : ""}Classes
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => navigate(classCreatePath(user?.role, schoolId))}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 20px", backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff", border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              + Add Class
            </button>
            <button
              type="button"
              onClick={() => setSetupOpen((v) => !v)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 22px", backgroundColor: setupOpen ? "rgba(255,255,255,0.15)" : "#feb139", color: setupOpen ? "#ffffff" : "#25476a", border: setupOpen ? "1.5px solid rgba(255,255,255,0.4)" : "none", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}
            >
              {setupOpen ? "✕ Close" : "Set Up Year"}
            </button>
          </div>
        </div>
      </div>

      {/* Set Up Year panel */}
      {setupOpen && school && (
        <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #a8d5ee", marginBottom: 16, overflow: "hidden" }}>
          <SetUpYearPanel
            school={school}
            curriculum={curriculum}
            existingClasses={classes}
            onClose={() => setSetupOpen(false)}
          />
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total Classes", value: classesLoading ? "—" : classes.length,              icon: "📚", bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
          { label: "Active",        value: classesLoading ? "—" : activeCount,                 icon: "✅", bg: "#e8f5fb", color: "#38aae1", border: "#a8d5ee" },
          { label: "Inactive",      value: classesLoading ? "—" : classes.length - activeCount, icon: "⏸️", bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
        ].map((stat) => (
          <div key={stat.label} style={{ backgroundColor: "#ffffff", borderRadius: 14, border: `1.5px solid ${stat.border}`, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, backgroundColor: stat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{stat.icon}</div>
            <div>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</p>
              <p style={{ margin: "3px 0 0", fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {statusFilter && (
          <button type="button" onClick={() => setStatusFilter("")}
            style={{ padding: "7px 14px", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            ✕ Clear
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#9CA3AF" }}>
          {classesLoading ? "Loading…" : `${classes.length} class${classes.length !== 1 ? "es" : ""}`}
        </span>
      </div>

      {/* Class cards */}
      {classesLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ backgroundColor: "#ffffff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ height: 3, background: "linear-gradient(90deg, #d6edf8, #e8f5fb)" }} />
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#FFEDD5" }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ height: 15, width: "50%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
                    <div style={{ height: 11, width: "30%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", backgroundColor: "#ffffff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg, #FFF7ED, #FFEDD5)", border: "2px solid #FED7AA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 20px" }}>📚</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#111827" }}>
            {statusFilter ? "No classes match the filter" : `No classes for ${school?.name || "this school"} yet`}
          </h3>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>
            {statusFilter ? "Try clearing the filter to see all classes." : "Use Set Up Year to generate all grade classes from the curriculum."}
          </p>
          {statusFilter
            ? <button type="button" onClick={() => setStatusFilter("")} style={{ padding: "10px 24px", backgroundColor: "transparent", color: ACCENT, border: `1.5px solid ${ACCENT}`, borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Clear Filter</button>
            : <button type="button" onClick={() => setSetupOpen(true)} style={{ padding: "10px 24px", backgroundColor: ACCENT, color: "#ffffff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Set Up Year</button>
          }
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {classes.map((c) => <ClassCard key={c.id} cls={c} teachersMap={teachersMap} />)}
        </div>
      )}
    </div>
  );
}
