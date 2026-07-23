import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { School as SchoolIcon } from "@mui/icons-material";
import { useAllLearningHubsQuery } from "../../learning-hubs/hooks/useLearningHub";
import { useAllLearnersQuery } from "../hooks/useLearners";
import { learnerApi } from "../services/learnerApi";
import { LearnerCard } from "../components/LearnerCard";

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

export default function LearnersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState(searchParams.get("schoolId") || "");

  const { data: schoolsData,  isLoading: schoolsLoading  } = useAllLearningHubsQuery({ hubType: "school" });
  const { data: learnersData, isLoading: learnersLoading } = useAllLearnersQuery();

  // A learner can now be enrolled at several hubs, so "filter by school" resolves through the
  // enrollment links rather than a field on the learner — the same schoolId-scoped query every
  // other hub-aware roster page already uses (see learner.service.js's getAllLearners).
  const { data: hubLearnersData, isLoading: hubLearnersLoading } = useQuery({
    queryKey: ["learners", "bySchool", schoolFilter],
    queryFn:  () => learnerApi.getAll({ schoolId: schoolFilter }),
    enabled:  !!schoolFilter,
  });

  const schools  = schoolsData?.data  || [];
  const learners = learnersData?.data || [];
  const hubLearnerIds = useMemo(() => new Set((hubLearnersData?.data || []).map((l) => l.id)), [hubLearnersData]);

  const filteredLearners = useMemo(() => {
    const term = search.trim().toLowerCase();
    return learners.filter((l) => {
      if (term && !`${l.firstName} ${l.lastName}`.toLowerCase().includes(term) && !l.guardianName?.toLowerCase().includes(term)) return false;
      if (schoolFilter && !hubLearnerIds.has(l.id)) return false;
      return true;
    });
  }, [learners, search, schoolFilter, hubLearnerIds]);

  const isLoading = schoolsLoading || learnersLoading || (!!schoolFilter && hubLearnersLoading);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Hero strip */}
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20px", right: "120px", width: "100px", height: "100px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
          <div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
              Learners
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "560px" }}>
              Every learner, independent of any school. Enroll a learner on their own, then assign them to one or more learning hubs from their profile.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/learners/create")}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 22px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(254,177,57,0.35)", whiteSpace: "nowrap" }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
            Enroll Learner
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by learner or guardian name…"
          style={inputStyle}
        />
        <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} style={selectStyle}>
          <option value="">All Schools</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {(search || schoolFilter) && (
          <button type="button" onClick={() => { setSearch(""); setSchoolFilter(""); }}
            style={{ padding: "7px 14px", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            ✕ Clear
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#9CA3AF" }}>
          {learnersLoading ? "Loading…" : `${filteredLearners.length} learner${filteredLearners.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[1, 2, 3, 4].map((n) => <SkeletonCard key={n} />)}
        </div>
      ) : filteredLearners.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#e8f5fb", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <SchoolIcon sx={{ color: "#25476a" }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
            {learners.length === 0 ? "No learners yet" : "No learners match these filters"}
          </p>
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>
            {learners.length === 0 ? "Enroll your first learner to get started." : "Try adjusting the search or filters."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {filteredLearners.map((learner) => (
            <LearnerCard key={learner.id} learner={learner} />
          ))}
        </div>
      )}
    </div>
  );
}
