import { useQuery } from "@tanstack/react-query";
import { FiArrowRight, FiShuffle } from "react-icons/fi";
import { BRAND, FONT } from "../../../theme/brand";
import { learnerMovesApi } from "../services/learnerMovesApi";

// A learner's moves between places and programmes, newest first (server learner_transfers, via
// GET /api/learner-moves/:id/history) — on the staff learner page's History tab. Each move says
// where they left and where they went, when and who did it. Shows nothing when they never moved.
export default function LearnerMoves({ learnerId }) {
  const { data: moves = [], isLoading } = useQuery({
    queryKey: ["learner-moves", learnerId, "history"],
    queryFn: () => learnerMovesApi.history(learnerId),
    enabled: Boolean(learnerId),
  });
  if (isLoading || !moves.length) return null;
  return (
    <section style={{ background: BRAND.surface, border: `1px solid ${BRAND.border}`, borderRadius: 16, padding: "16px 18px", fontFamily: FONT }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: BRAND.ink, display: "flex", alignItems: "center", gap: 8 }}>
        <FiShuffle size={16} color={BRAND.mid} /> Moves
      </h3>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {moves.map((m) => (
          <li key={m.id} style={{ padding: "10px 12px", borderRadius: 12, background: BRAND.canvas, border: `1px solid ${BRAND.line}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13.5, color: BRAND.ink }}>
              <Side side={m.from} empty="Joined" />
              <FiArrowRight size={14} color={BRAND.faint} aria-label="to" />
              <Side side={m.to} />
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: BRAND.muted }}>
              {new Date(m.at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              {m.by ? ` · by ${m.by}` : ""}
              {m.admissionNumber ? ` · admission no. there ${m.admissionNumber}` : ""}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Side({ side, empty }) {
  if (!side) return <span style={{ color: BRAND.muted, fontWeight: 600 }}>{empty || "—"}</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
      {side.programmeLabel && (
        <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: BRAND.navyTint, color: BRAND.navy, border: `1px solid ${BRAND.navyBorder}` }}>{side.programmeLabel}</span>
      )}
      <span style={{ fontWeight: 600 }}>{side.label || "—"}</span>
    </span>
  );
}
