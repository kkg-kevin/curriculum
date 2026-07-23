import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle as CheckCircleIcon, PauseCircle as PauseCircleIcon, School as SchoolIcon } from "@mui/icons-material";
import { useAllLearningHubsQuery } from "../../learning-hubs/hooks/useLearningHub";
import { learningHubApi } from "../../learning-hubs/services/learningHubApi";
import { useAllTeachersQuery } from "../hooks/useTeacher";
import { TeacherCard } from "../components/TeacherCard";

const selectStyle = { padding: "8px 32px 8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", backgroundColor: "#F9FAFB", color: "#374151", outline: "none", cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" };
const inputStyle  = { padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", backgroundColor: "#F9FAFB", color: "#374151", outline: "none", minWidth: 200 };

function SkeletonCard() {
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: "#F3F4F6" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ height: 15, width: "55%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
          <div style={{ height: 11, width: "35%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
        </div>
      </div>
      <div style={{ height: 62, backgroundColor: "#F9FAFB", borderRadius: 12 }} />
    </div>
  );
}

export default function TeachersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [hubFilter, setHubFilter] = useState(searchParams.get("schoolId") || "");
  const [statusFilter, setStatusFilter] = useState("");

  // Teachers can be assigned to any hub type, not just schools — so every active hub is a
  // valid filter option here.
  const { data: hubsData,     isLoading: hubsLoading }     = useAllLearningHubsQuery({ status: "active" });
  const { data: teachersData, isLoading: teachersLoading } = useAllTeachersQuery();

  const { data: hubTeacherIds, isLoading: hubTeachersLoading } = useQuery({
    queryKey: ["learningHubs", "detail", hubFilter, "teacherIds"],
    queryFn:  async () => new Set((await learningHubApi.getTeachers(hubFilter)).map((t) => t.id)),
    enabled:  !!hubFilter,
  });

  const hubs     = hubsData?.data     || [];
  const teachers = teachersData?.data || [];

  const activeCount = useMemo(() => teachers.filter((t) => t.status === "active").length, [teachers]);

  const filteredTeachers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return teachers.filter((t) => {
      if (term && !`${t.firstName} ${t.lastName}`.toLowerCase().includes(term) && !t.email?.toLowerCase().includes(term)) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (hubFilter && !(hubTeacherIds?.has(t.id))) return false;
      return true;
    });
  }, [teachers, search, statusFilter, hubFilter, hubTeacherIds]);

  const isLoading = hubsLoading || teachersLoading || (!!hubFilter && hubTeachersLoading);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Hero strip */}
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20px", right: "120px", width: "100px", height: "100px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
          <div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
              Tech Educators
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "560px" }}>
              Every tech educator across every hub, in one place. Add a tech educator independently, then assign them to a learning hub whenever you're ready.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/teachers/create")}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 22px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(254,177,57,0.35)", whiteSpace: "nowrap" }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
            Add Tech Educator
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total Tech Educators", value: teachersLoading ? "—" : teachers.length,          icon: <SchoolIcon fontSize="small" />, bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
          { label: "Active",         value: teachersLoading ? "—" : activeCount,                    icon: <CheckCircleIcon fontSize="small" />, bg: "#e8f5fb", color: "#38aae1", border: "#a8d5ee" },
          { label: "Inactive",       value: teachersLoading ? "—" : teachers.length - activeCount,   icon: <PauseCircleIcon fontSize="small" />, bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
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
      <div style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          style={inputStyle}
        />
        <select value={hubFilter} onChange={(e) => setHubFilter(e.target.value)} style={selectStyle}>
          <option value="">All Hubs</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="inactive">Inactive</option>
        </select>
        {(search || hubFilter || statusFilter) && (
          <button type="button" onClick={() => { setSearch(""); setHubFilter(""); setStatusFilter(""); }}
            style={{ padding: "7px 14px", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            ✕ Clear
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#9CA3AF" }}>
          {teachersLoading ? "Loading…" : `${filteredTeachers.length} tech educator${filteredTeachers.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[1, 2, 3, 4].map((n) => <SkeletonCard key={n} />)}
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
            {teachers.length === 0 ? "No tech educators yet" : "No tech educators match these filters"}
          </p>
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>
            {teachers.length === 0 ? "Add your first tech educator to get started." : "Try adjusting the search or filters."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {filteredTeachers.map((teacher) => (
            <TeacherCard key={teacher.id} teacher={teacher} />
          ))}
        </div>
      )}
    </div>
  );
}
