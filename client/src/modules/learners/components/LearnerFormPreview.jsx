import { useState } from "react";
import { useFormContext } from "react-hook-form";

// Mirrors ProfileIdentityCard.jsx's own computeAge — display-only, kept as a local duplicate
// (same "small enough to keep in sync by inspection" reasoning LearnerForm.jsx's own copy uses)
// rather than a shared import.
function computeAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

const GENDER_LABEL = { male: "Male", female: "Female", other: "Other" };

// Same initials-first, fade-in-on-load treatment as PublicLearnerProfilePage.jsx's own Avatar —
// `photo` here is already a resolved upload URL (see ImageUploadField), so the same "don't show a
// blank circle while it's in flight" concern applies.
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

// Same "Live Preview" card language as CurriculumPreview.jsx (label dot, white card with a soft
// blue-tinted shadow/border) — fills the wide empty column this form otherwise leaves next to a
// single centered 640px form, and doubles as visual confirmation of what's actually being entered
// as the guardian/admin fills in the fields.
export default function LearnerFormPreview() {
  const { watch } = useFormContext();
  const { firstName, lastName, gender, dateOfBirth, nationality, languages, photo, guardianName, guardianPhone, guardianEmail } = watch();

  const age = computeAge(dateOfBirth);
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const languageList = languages ? languages.split(",").map((l) => l.trim()).filter(Boolean) : [];
  const isEmpty = !firstName && !lastName && !guardianName;

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
                {fullName || "Learner Name"}
              </h3>
              <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "#6B7280" }}>
                {[GENDER_LABEL[gender], age !== null ? `Age ${age}` : null].filter(Boolean).join(" · ") || "Gender · Age"}
              </p>
            </div>
          </div>

          <div style={{ height: "1px", background: "linear-gradient(90deg, #d6edf8, #E0F2FE, transparent)" }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
            <InfoRow label="Nationality" value={nationality} />
            <InfoRow label="Languages" value={languageList.join(", ")} />
          </div>

          <div style={{ height: "1px", backgroundColor: "#F3F4F6" }} />

          <div>
            <p style={{ margin: "0 0 10px", fontSize: "11px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Guardian</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <InfoRow label="Name" value={guardianName} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 16px" }}>
                <InfoRow label="Phone" value={guardianPhone} />
                <InfoRow label="Email" value={guardianEmail} />
              </div>
            </div>
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
