import { useNavigate, useParams } from "react-router-dom";
import { useSchoolQuery } from "../hooks/useSchool";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";

function DetailRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
      <span style={{ color: "#9CA3AF", flexShrink: 0, marginTop: "1px" }}>{icon}</span>
      <div>
        <p style={{ margin: "0 0 1px 0", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </p>
        <p style={{ margin: 0, fontSize: "14px", color: "#111827" }}>{value}</p>
      </div>
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

export default function SchoolViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: school, isLoading, isError } = useSchoolQuery(id);
  const { data: curriculum } = useCurriculumQuery(school?.curriculumId);

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading school…
      </div>
    );
  }

  if (isError || !school) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ School not found.
      </div>
    );
  }

  const statusStyle = school.status === "active"
    ? { bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0" }
    : { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" };

  const address = [
    school.address?.street,
    school.address?.city,
    school.address?.county ? `${school.address.county} County` : null,
    "Kenya",
  ].filter(Boolean).join(", ");

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #064E3B 0%, #047857 50%, #059669 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
            <button
              type="button"
              onClick={() => navigate("/schools")}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.65)", fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}
            >
              Schools
            </button>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>/</span>
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "13px", fontWeight: "500" }}>{school.name}</span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              {/* Icon */}
              <div style={{ width: "60px", height: "60px", borderRadius: "16px", background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", flexShrink: 0 }}>
                🏫
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.3px" }}>
                    {school.name}
                  </h1>
                  <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`, textTransform: "capitalize" }}>
                    {school.status}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
                  {school.code}
                  {school.address?.county ? ` · ${school.address.county} County` : ""}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/schools/${id}/edit`)}
              style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "10px 20px", backgroundColor: "#ffffff", color: "#047857", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Edit School
            </button>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px", alignItems: "start" }}>

        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Curriculum */}
          <Section title="Assigned Curriculum">
            {curriculum ? (
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: "12px", backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", cursor: "pointer" }}
                onClick={() => navigate(`/curriculum/${curriculum.id}/view`)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
                    📋
                  </div>
                  <div>
                    <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: "700", color: "#065F46" }}>{curriculum.name}</p>
                    <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
                      {curriculum.framework} · {curriculum.academicCycleModel} · {curriculum.academicYear}
                    </p>
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: "#6EE7B7", flexShrink: 0 }}>
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "24px 16px", textAlign: "center" }}>
                <div style={{ fontSize: "28px" }}>📋</div>
                <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>No curriculum assigned to this school yet.</p>
                <button
                  type="button"
                  onClick={() => navigate(`/schools/${id}/edit`)}
                  style={{ padding: "8px 18px", backgroundColor: "#047857", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
                >
                  Assign Curriculum
                </button>
              </div>
            )}
          </Section>

          {/* Coming soon: Learners */}
          <ComingSoonSection
            title="Learners"
            icon="🎓"
            description="Learners enrolled in this school will appear here once the Learners module is set up."
          />

          {/* Coming soon: Teachers */}
          <ComingSoonSection
            title="Teachers"
            icon="👩‍🏫"
            description="Teachers assigned to this school will appear here once the Teachers module is set up."
          />
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Contact & Address */}
          <Section title="School Details">
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <DetailRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2"/><polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2"/></svg>}
                label="Email"
                value={school.email}
              />
              <DetailRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z" stroke="currentColor" strokeWidth="2"/></svg>}
                label="Phone"
                value={school.phone}
              />
              {address && (
                <DetailRow
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2"/></svg>}
                  label="Address"
                  value={address}
                />
              )}
              {!school.email && !school.phone && !address && (
                <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", textAlign: "center", padding: "12px 0" }}>
                  No contact details yet.{" "}
                  <button type="button" onClick={() => navigate(`/schools/${id}/edit`)} style={{ background: "none", border: "none", color: "#047857", fontWeight: "600", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "13px", padding: 0 }}>
                    Add them →
                  </button>
                </p>
              )}
            </div>
          </Section>

          {/* Metadata */}
          <Section title="Record Info">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <DetailRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/></svg>}
                label="Created"
                value={new Date(school.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
              />
              <DetailRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
                label="Last Updated"
                value={new Date(school.updatedAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
