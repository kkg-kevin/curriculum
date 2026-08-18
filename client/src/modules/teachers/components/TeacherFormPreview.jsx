import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { useCoursesQuery } from "../../courses/hooks/useCourse";

// Same status colors as TeacherCard.jsx's own StatusBadge — kept as a local duplicate rather than
// a shared import since that file's badge is sized/spaced for a list card, not a form preview.
const STATUS_STYLES = {
  active:   { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee", label: "Active"   },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: "Inactive" },
  on_leave: { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A", label: "On Leave" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.active;
  return (
    <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

// Same initials-first, fade-in-on-load avatar as LearnerFormPreview.jsx / PublicLearnerProfilePage.jsx.
function Avatar({ firstName, lastName, photo }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const showPhoto = !!photo && !imgFailed;
  return (
    <div style={{
      position: "relative", width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
      backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 22, fontWeight: 800, color: "#25476a",
    }}>
      {initials || "?"}
      {showPhoto && (
        <img
          src={photo}
          alt=""
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover",
            opacity: imgLoaded ? 1 : 0, transition: "opacity 0.2s ease",
          }}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
      <span style={{ fontSize: "10.5px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: "13px", color: value ? "#374151" : "#D1D5DB", fontStyle: value ? "normal" : "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value || "Not provided"}
      </span>
    </div>
  );
}

// Same "Live Preview" card language as CurriculumPreview.jsx / LearnerFormPreview.jsx — fills the
// wide empty column CreateTeacherPage.jsx/EditTeacherPage.jsx otherwise leave next to a single
// form column, and doubles as visual confirmation of what's being entered.
export default function TeacherFormPreview() {
  const { watch } = useFormContext();
  const { firstName, lastName, photo, email, phone, status, qualifiedCourseIds } = watch();

  const { data: coursesResponse } = useCoursesQuery();
  const allCourses = coursesResponse?.data || [];
  const qualifiedCourses = (qualifiedCourseIds || [])
    .map((id) => allCourses.find((c) => c.id === id))
    .filter(Boolean);

  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const isEmpty = !firstName && !lastName && !email && !phone;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "12px" }}>
        <div style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#25476a", boxShadow: "0 0 0 3px rgba(37,71,106,0.15)" }} />
        <span style={{ fontSize: "11px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>Live Preview</span>
      </div>

      <div style={{
        backgroundColor: "#ffffff", borderRadius: "18px", overflow: "hidden", border: "1px solid #E8F0FE",
        boxShadow: "0 4px 24px rgba(37,71,106,0.09), 0 1px 4px rgba(0,0,0,0.05)",
      }}>
        <div style={{ padding: "22px", display: "flex", flexDirection: "column", gap: "18px" }}>

          <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
            <Avatar firstName={firstName} lastName={lastName} photo={photo} />
            <div style={{ minWidth: 0 }}>
              <h3 style={{
                margin: 0, fontSize: "17px", fontWeight: "800", lineHeight: 1.25,
                color: fullName ? "#0F2645" : "#D1D5DB", fontStyle: fullName ? "normal" : "italic",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {fullName || "Educator Name"}
              </h3>
              <div style={{ marginTop: "5px" }}>
                <StatusBadge status={status} />
              </div>
            </div>
          </div>

          <div style={{ height: "1px", background: "linear-gradient(90deg, #d6edf8, #E0F2FE, transparent)" }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
            <InfoRow label="Email" value={email} />
            <InfoRow label="Phone" value={phone} />
          </div>

          <div style={{ height: "1px", backgroundColor: "#F3F4F6" }} />

          <div>
            <p style={{ margin: "0 0 10px", fontSize: "11px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Qualifications</p>
            {qualifiedCourses.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                {qualifiedCourses.map((course) => (
                  <span
                    key={course.id}
                    style={{
                      padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600",
                      backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee", color: "#25476a",
                    }}
                  >
                    {course.name}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>Unrestricted — can be assigned to any course</p>
            )}
          </div>

        </div>
      </div>

      {isEmpty && (
        <p style={{ textAlign: "center", fontSize: "11px", color: "#C3D3E8", marginTop: "10px" }}>
          Start filling in the form to see a live preview
        </p>
      )}
    </div>
  );
}
