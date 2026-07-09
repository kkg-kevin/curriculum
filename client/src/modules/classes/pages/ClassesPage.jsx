import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAllSchoolsQuery } from "../../schools/hooks/useSchool";
import { useAllClassesQuery } from "../hooks/useClasses";
import SchoolPickerCard from "../../schools/components/SchoolPickerCard";

function SkeletonCard() {
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: "#F3F4F6" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ height: 15, width: "55%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
          <div style={{ height: 11, width: "35%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
        </div>
      </div>
      <div style={{ height: 62, backgroundColor: "#F9FAFB", borderRadius: 12 }} />
    </div>
  );
}

export default function ClassesPage() {
  const navigate = useNavigate();
  const { data: schoolsData, isLoading: schoolsLoading } = useAllSchoolsQuery();
  const { data: classesData, isLoading: classesLoading } = useAllClassesQuery();

  const schools = schoolsData?.data || [];
  const classes = classesData?.data || [];

  const classesBySchool = useMemo(() => {
    const map = {};
    for (const c of classes) {
      if (!map[c.schoolId]) map[c.schoolId] = [];
      map[c.schoolId].push(c);
    }
    return map;
  }, [classes]);

  const isLoading = schoolsLoading || classesLoading;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20px", right: "120px", width: "100px", height: "100px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
            Classes
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "560px" }}>
            Pick a school to manage its classes — set up the academic year, view rosters, and assign class teachers.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
        </div>
      ) : schools.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 6 }}>No schools found</p>
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>Add a school first, then set up its classes here.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {schools.map((school) => {
            const schoolClasses = classesBySchool[school.id] || [];
            const activeCount = schoolClasses.filter((c) => c.status === "active").length;
            return (
              <SchoolPickerCard
                key={school.id}
                school={school}
                icon="📚"
                count={schoolClasses.length}
                countLabel={schoolClasses.length === 1 ? "class" : "classes"}
                subStat={schoolClasses.length > 0 ? `${activeCount} active` : null}
                onClick={() => navigate(`/classes/school/${school.id}`)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
