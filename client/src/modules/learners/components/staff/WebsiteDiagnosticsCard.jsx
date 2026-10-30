import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiGlobe } from "react-icons/fi";
import { learnerApi } from "../../services/learnerApi";

const ACCENT = "#7C3AED";
const formatDate = (value) => (value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

// Website diagnostics this learner's family took — found by the guardian's phone (a website
// diagnostic's enquiry keeps the parent's phone) or the bootcamp enrolment they came from. One not
// on their record yet (the family enquired after it, and staff added the learner) can be added: it
// then counts like a diagnostic marked in the portal — the report on the
// profile, their competencies, and their place on that pathway (server: website-diagnostic.service.js).
// Shown only while there's one to add — once on their record it's in the Diagnostic report. Admins
// and hubs only (`canLink`).
export default function WebsiteDiagnosticsCard({ learnerId, canLink }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["learners", "detail", learnerId, "website-diagnostics"],
    queryFn: () => learnerApi.websiteDiagnostics(learnerId),
    enabled: !!learnerId && canLink,
  });
  const { mutate: link, isPending, variables } = useMutation({
    mutationFn: (attemptId) => learnerApi.linkWebsiteDiagnostic(learnerId, attemptId),
    onSuccess: () => {
      // Its report, competencies, Progress Arc and pathway placement all change.
      qc.invalidateQueries();
      toast.success("Website diagnostic added to this learner's record");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Couldn't add the diagnostic"),
  });

  const toAdd = rows.filter((row) => !row.linked);
  if (!canLink || isLoading || toAdd.length === 0) return null;

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
        <FiGlobe size={14} /> Website diagnostics
      </h3>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9CA3AF" }}>
        Taken on the website under this family's phone number. Add the one this learner took: its report, competency marks and placement then show on their profile.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {toAdd.map((row) => (
          <div key={row.attemptId} style={{ padding: "12px 14px", borderRadius: 10, background: "#FAFCFF", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13 }}>
              <strong style={{ color: "#111827" }}>{row.pathwayName}</strong>
              <span style={{ color: "#6B7280" }}>
                {[row.childName, row.childAge != null ? `age ${row.childAge}` : null, formatDate(row.takenAt)].filter(Boolean).join(" · ")}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{row.totalScore}/{row.maxScore}</span>
            </div>
            <button
              type="button"
              onClick={() => link(row.attemptId)}
              disabled={isPending}
              style={{ padding: "8px 16px", backgroundColor: ACCENT, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}
            >
              {isPending && variables === row.attemptId ? "Adding…" : "Add to this learner"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
