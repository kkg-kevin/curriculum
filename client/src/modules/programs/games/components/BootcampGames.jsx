import { useGames } from "../hooks/useGames";
import { GameBadge, SkillChips } from "./GameTile";

// The "Games & play" card on a bootcamp's own page in the admin app — the games it includes, as
// they'll be listed on the website.
export default function BootcampGames({ gameIds = [], note, onEdit }) {
  const { data: games = [] } = useGames();
  const byId = new Map(games.map((game) => [game.id, game]));
  const included = gameIds.map((id) => byId.get(id)).filter(Boolean);

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Games &amp; play</h3>
      {included.length === 0 ? (
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "#9CA3AF" }}>
          No games on this bootcamp yet.{" "}
          <button type="button" onClick={onEdit} style={{ background: "none", border: "none", color: "#25476a", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif", padding: 0 }}>Add some</button>{" "}
          to show families it&rsquo;s more than lessons.
        </p>
      ) : (
        <>
          {note && <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "#374151", lineHeight: 1.6 }}>{note}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12, marginTop: 14 }}>
            {included.map((game) => (
              <div key={game.id} style={{ display: "flex", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1.5px solid #E5E7EB" }}>
                <GameBadge game={game} />
                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "#111827" }}>{game.name}</span>
                  {game.description && <span style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.45 }}>{game.description}</span>}
                  <SkillChips skills={game.skills} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
