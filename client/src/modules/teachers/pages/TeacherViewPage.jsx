import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTeacherQuery } from "../hooks/useTeacher";
import { useSchoolQuery } from "../../schools/hooks/useSchool";
import { classApi } from "../../classes/services/classApi";

const STATUS_STYLES = {
  active:   { bg: "#EFF6FF", color: "#1E3A8A", border: "#BFDBFE" },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
  on_leave: { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" },
};
const STATUS_LABELS = { active: "Active", inactive: "Inactive", on_leave: "On Leave" };

function Avatar({ firstName, lastName, size = 64 }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: "linear-gradient(135deg, #0D47A1, #1565C0)",
        border: "3px solid rgba(255,255,255,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.34, fontWeight: "700", color: "#ffffff",
        flexShrink: 0, letterSpacing: "0.02em",
      }}
    >
      {initials || "?"}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
        <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>{title}</h2>
      </div>
      <div style={{ padding: "20px" }}>{children}</div>
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
      <span style={{ color: "#9CA3AF", flexShrink: 0, marginTop: "1px" }}>{icon}</span>
      <div>
        <p style={{ margin: "0 0 1px", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
        <p style={{ margin: 0, fontSize: "14px", color: "#111827" }}>{value}</p>
      </div>
    </div>
  );
}

function ComingSoonSection({ title, icon, description }) {
  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px dashed #E5E7EB", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
        <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#9CA3AF" }}>{title}</h2>
      </div>
      <div style={{ padding: "32px 20px", textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "10px" }}>{icon}</div>
        <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: "600", color: "#6B7280" }}>Coming soon</p>
        <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>{description}</p>
      </div>
    </div>
  );
}

export default function TeacherViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: teacher, isLoading, isError } = useTeacherQuery(id);
  const { data: school } = useSchoolQuery(teacher?.schoolId);
  const { data: schoolClassesData } = useQuery({
    queryKey: ["classes", "bySchool", teacher?.schoolId],
    queryFn:  () => classApi.getAll({ schoolId: teacher.schoolId }),
    enabled:  !!teacher?.schoolId,
  });
  const myClasses = (schoolClassesData?.data || []).filter((c) => c.classTeacherId === id);

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading teacher…
      </div>
    );
  }

  if (isError || !teacher) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ Teacher not found.
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[teacher.status] || STATUS_STYLES.inactive;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>

      {/* Hero header */}
      <div style={{ background: "linear-gradient(135deg, #0D2E6E 0%, #0D47A1 40%, #1565C0 75%, #1976D2 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
            <button type="button" onClick={() => navigate("/teachers")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.65)", fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}>
              Teachers
            </button>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>/</span>
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "13px", fontWeight: "500" }}>
              {teacher.firstName} {teacher.lastName}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <Avatar firstName={teacher.firstName} lastName={teacher.lastName} size={64} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.3px" }}>
                    {teacher.firstName} {teacher.lastName}
                  </h1>
                  <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}>
                    {STATUS_LABELS[teacher.status] ?? teacher.status}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
                  {teacher.employeeId}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/teachers/${id}/edit`)}
              style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "10px 20px", backgroundColor: "#ffffff", color: "#0D47A1", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Edit Teacher
            </button>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px", alignItems: "start" }}>

        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Section title="Classes">
            {myClasses.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#9CA3AF" }}>Not assigned as class teacher to any class yet.</p>
                <button type="button" onClick={() => navigate("/classes/create")} style={{ background: "none", border: "none", color: "#0D47A1", fontWeight: "600", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "13px", padding: 0 }}>Create a class →</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {myClasses.map((c) => (
                  <div key={c.id} onClick={() => navigate(`/classes/${c.id}/view`)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "10px", border: "1px solid #E5E7EB", cursor: "pointer", transition: "background-color 0.12s" }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{c.gradeName}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>Academic Year {c.academicYear}</p>
                    </div>
                    <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: c.status === "active" ? "#EFF6FF" : "#F9FAFB", color: c.status === "active" ? "#1E3A8A" : "#6B7280", border: `1px solid ${c.status === "active" ? "#BFDBFE" : "#E5E7EB"}` }}>
                      {c.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* School */}
          <Section title="School">
            {school ? (
              <div
                onClick={() => navigate(`/schools/${school.id}/view`)}
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "10px", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", cursor: "pointer" }}
              >
                <span style={{ fontSize: "24px", flexShrink: 0 }}>🏫</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: "700", color: "#1E3A8A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{school.name}</p>
                  <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{school.code}{school.address?.county ? ` · ${school.address.county}` : ""}</p>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ color: "#BFDBFE", flexShrink: 0, marginLeft: "auto" }}>
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#9CA3AF" }}>No school assigned.</p>
                <button type="button" onClick={() => navigate(`/teachers/${id}/edit`)} style={{ background: "none", border: "none", color: "#0D47A1", fontWeight: "600", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "13px", padding: 0 }}>
                  Assign school →
                </button>
              </div>
            )}
          </Section>

          {/* Contact */}
          <Section title="Contact Details">
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <DetailRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2"/><polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2"/></svg>}
                label="Email" value={teacher.email}
              />
              <DetailRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z" stroke="currentColor" strokeWidth="2"/></svg>}
                label="Phone" value={teacher.phone}
              />
              {!teacher.email && !teacher.phone && (
                <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", textAlign: "center" }}>
                  No contact details.{" "}
                  <button type="button" onClick={() => navigate(`/teachers/${id}/edit`)} style={{ background: "none", border: "none", color: "#0D47A1", fontWeight: "600", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "13px", padding: 0 }}>
                    Add →
                  </button>
                </p>
              )}
            </div>
          </Section>

          {/* Record info */}
          <Section title="Record Info">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <DetailRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/></svg>}
                label="Added"
                value={new Date(teacher.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
              />
              <DetailRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
                label="Last Updated"
                value={new Date(teacher.updatedAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
