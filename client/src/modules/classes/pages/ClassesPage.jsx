import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAllSchoolsQuery } from "../../schools/hooks/useSchool";
import { classApi } from "../services/classApi";

const ACCENT    = "#EA580C";
const GRAD_FROM = "#7C2D12";
const GRAD_TO   = "#EA580C";

function SchoolCard({ school, classCount, activeCount }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const initial = school.name?.[0]?.toUpperCase() || "S";

  return (
    <div
      onClick={() => navigate(`/classes/school/${school.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ backgroundColor: "#ffffff", borderRadius: 16, boxShadow: hovered ? "0 8px 24px rgba(234,88,12,0.10), 0 2px 6px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "box-shadow 0.2s, transform 0.2s", transform: hovered ? "translateY(-2px)" : "translateY(0)", cursor: "pointer" }}
    >
      <div style={{ height: hovered ? 4 : 3, background: `linear-gradient(90deg, ${GRAD_FROM}, ${GRAD_TO}, #FB923C)`, transition: "height 0.2s" }} />

      <div style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: `linear-gradient(135deg, ${GRAD_FROM}, ${GRAD_TO})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#ffffff", flexShrink: 0 }}>
              {initial}
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: hovered ? ACCENT : "#111827", transition: "color 0.15s", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {school.name}
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>
                {school.address?.county ? `${school.address.county} County` : "No location set"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: classCount > 0 ? ACCENT : "#D1D5DB", lineHeight: 1 }}>{classCount}</span>
            <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>{classCount === 1 ? "class" : "classes"}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "1px solid #F3F4F6" }}>
          {classCount > 0 ? (
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, backgroundColor: "#F0FDF4", color: "#065F46", border: "1px solid #BBF7D0" }}>
                {activeCount} active
              </span>
              {classCount - activeCount > 0 && (
                <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, backgroundColor: "#F9FAFB", color: "#6B7280", border: "1px solid #E5E7EB" }}>
                  {classCount - activeCount} inactive
                </span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 12, color: "#D1D5DB", fontStyle: "italic" }}>No classes yet</span>
          )}
          <span style={{ fontSize: 13, color: hovered ? ACCENT : "#9CA3AF", fontWeight: 600, transition: "color 0.15s", flexShrink: 0 }}>
            {classCount > 0 ? "View →" : "Add →"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ClassesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: schoolsData, isLoading: schoolsLoading } = useAllSchoolsQuery();
  const { data: allClassesData } = useQuery({
    queryKey: ["classes", "all"],
    queryFn: () => classApi.getAll({}),
  });

  const schools    = schoolsData?.data || [];
  const allClasses = allClassesData?.data || [];

  const classCounts = allClasses.reduce((acc, cls) => {
    if (!acc[cls.schoolId]) acc[cls.schoolId] = { total: 0, active: 0 };
    acc[cls.schoolId].total++;
    if (cls.status === "active") acc[cls.schoolId].active++;
    return acc;
  }, {});

  const filteredSchools = schools.filter(
    (s) => !search || s.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalClasses       = allClasses.length;
  const totalActive        = allClasses.filter((c) => c.status === "active").length;
  const schoolsWithClasses = schools.filter((s) => (classCounts[s.id]?.total || 0) > 0).length;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${GRAD_FROM} 0%, #9A3412 40%, #C2410C 75%, ${GRAD_TO} 100%)`, borderRadius: 20, padding: "28px 32px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, position: "relative" }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>Classes</h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
              Select a school to view and manage its classes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/classes/create")}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 22px", backgroundColor: "#ffffff", color: ACCENT, border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", whiteSpace: "nowrap" }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Create Class
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Schools with Classes", value: schoolsLoading ? "—" : schoolsWithClasses, icon: "🏫", bg: "#FFF7ED", color: "#9A3412", border: "#FED7AA" },
          { label: "Total Classes",        value: totalClasses,                               icon: "📚", bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
          { label: "Active Classes",       value: totalActive,                                icon: "✅", bg: "#F0FDF4", color: "#065F46", border: "#BBF7D0" },
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

      {/* Search */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: "#9CA3AF", flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
          <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search schools…"
          style={{ flex: 1, border: "none", outline: "none", fontSize: 14, fontFamily: "Inter, sans-serif", color: "#111827", backgroundColor: "transparent" }}
        />
        {search && (
          <button type="button" onClick={() => setSearch("")}
            style={{ padding: "4px 10px", backgroundColor: "transparent", color: "#9CA3AF", border: "none", cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
            ✕ Clear
          </button>
        )}
        <span style={{ fontSize: 13, color: "#9CA3AF", whiteSpace: "nowrap" }}>
          {schoolsLoading ? "Loading…" : `${filteredSchools.length} school${filteredSchools.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* School cards */}
      {schoolsLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ backgroundColor: "#ffffff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "18px 20px" }}>
              <div style={{ height: 3, background: "linear-gradient(90deg, #FFEDD5, #FFF7ED)", marginBottom: 18 }} />
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: "#FFEDD5", flexShrink: 0 }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ height: 14, width: "60%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
                  <div style={{ height: 11, width: "40%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredSchools.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", backgroundColor: "#ffffff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg, #FFF7ED, #FFEDD5)", border: "2px solid #FED7AA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 20px" }}>🏫</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#111827" }}>
            {search ? "No schools match your search" : "No schools yet"}
          </h3>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6B7280" }}>
            {search ? "Try a different search term." : "Add schools first, then create classes for them."}
          </p>
          {search
            ? <button type="button" onClick={() => setSearch("")} style={{ padding: "10px 24px", backgroundColor: "transparent", color: ACCENT, border: `1.5px solid ${ACCENT}`, borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Clear Search</button>
            : <button type="button" onClick={() => navigate("/schools")} style={{ padding: "10px 24px", backgroundColor: ACCENT, color: "#ffffff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Go to Schools →</button>
          }
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {filteredSchools.map((school) => (
            <SchoolCard
              key={school.id}
              school={school}
              classCount={classCounts[school.id]?.total || 0}
              activeCount={classCounts[school.id]?.active || 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
