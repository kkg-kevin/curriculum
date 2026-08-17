import { useParams } from "react-router-dom";
import { usePublicLearnerProfile } from "../hooks/useLearners";
import { formatClassName } from "../../classes/utils/classDisplay";

const GRAD_FROM = "#1a3550";
const GRAD_TO = "#38aae1";

const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  fontFamily: "Inter, sans-serif",
  background: `linear-gradient(135deg, ${GRAD_FROM} 0%, #25476a 45%, ${GRAD_TO} 100%)`,
};

const cardStyle = {
  width: "100%",
  maxWidth: 420,
  backgroundColor: "#ffffff",
  borderRadius: 20,
  padding: "32px 28px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
};

function Avatar({ firstName, lastName, photo }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  if (photo) {
    return <img src={photo} alt={`${firstName || ""} ${lastName || ""}`.trim()} style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover" }} />;
  }
  return (
    <div style={{ width: 88, height: 88, borderRadius: "50%", background: `linear-gradient(135deg, ${GRAD_FROM}, ${GRAD_TO})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 700, color: "#ffffff" }}>
      {initials || "?"}
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// The scan destination for a learner's "Share Profile" QR code (see LearnerViewPage.jsx's
// ShareProfileCard) — deliberately reachable with no login. Renders only whatever
// learner.service.js's getPublicProfile chose to expose: name, photo, class, guardian contact.
// A 404 here almost always means the token was regenerated (old QR/link retired), not a broken
// link — worded that way rather than a generic error.
export default function PublicLearnerProfilePage() {
  const { token } = useParams();
  const { data: profile, isLoading, isError } = usePublicLearnerProfile(token);

  if (isLoading) {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#111827" }}>This link is no longer valid</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
            The QR code or link may have been regenerated. Ask the school for a current one.
          </p>
        </div>
      </div>
    );
  }

  const classLabel = profile.gradeName ? formatClassName({ gradeName: profile.gradeName, streamName: profile.streamName }) : null;

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <Avatar firstName={profile.firstName} lastName={profile.lastName} photo={profile.photo} />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#111827", textAlign: "center" }}>
            {profile.firstName} {profile.lastName}
          </h1>
          {profile.hubName && <span style={{ fontSize: 12.5, color: "#6B7280" }}>{profile.hubName}</span>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 20, borderTop: "1px solid #F3F4F6" }}>
          <Row label="Class" value={classLabel} />
          <Row label="Guardian" value={profile.guardianName} />
          <Row label="Guardian Phone" value={profile.guardianPhone} />
        </div>

        <p style={{ margin: "24px 0 0", fontSize: 11, color: "#D1D5DB", textAlign: "center" }}>Digifunzi · Shared profile</p>
      </div>
    </div>
  );
}
