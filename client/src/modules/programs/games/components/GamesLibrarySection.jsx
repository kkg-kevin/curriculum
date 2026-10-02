import { useState } from "react";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { useCreateGame, useDeleteGame, useGames, useUpdateGame } from "../hooks/useGames";
import { STARTER_GAMES } from "../starterGames";
import { GameBadge, GameIcon, SkillChips } from "./GameTile";
import GameFormModal from "./GameFormModal";

const iconBtn = { width: 30, height: 30, borderRadius: 8, border: "1.5px solid #E5E7EB", background: "#fff", color: "#6B7280", display: "grid", placeItems: "center", cursor: "pointer" };

// One-click chips for well-known games the library doesn't have yet. Shared with the bootcamp
// form's picker (GamesField), where adding one also selects it.
export function StarterChips({ existingNames, onPick, disabled }) {
  const missing = STARTER_GAMES.filter((starter) => !existingNames.has(starter.name.toLowerCase()));
  if (!missing.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {missing.map((starter) => (
        <button
          key={starter.name} type="button" disabled={disabled} onClick={() => onPick(starter)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999, border: "1.5px dashed #a8d5ee", background: "#F7FBFE", color: "#25476a", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: disabled ? "wait" : "pointer" }}
        >
          <GameIcon name={starter.icon} size={15} /> {starter.name} <span style={{ color: "#9CA3AF", fontWeight: 800 }}>+</span>
        </button>
      ))}
    </div>
  );
}

// Events → Games: the library of games and play activities bootcamps can include.
export default function GamesLibrarySection() {
  const { data: games = [], isLoading, isError, error } = useGames();
  const createGame = useCreateGame();
  const updateGame = useUpdateGame();
  const deleteGame = useDeleteGame();
  const [editing, setEditing] = useState(null); // a game, or {} for a new one

  const existingNames = new Set(games.map((game) => game.name.toLowerCase()));
  const save = (data) => {
    const done = { onSuccess: () => setEditing(null) };
    if (editing?.id) updateGame.mutate({ id: editing.id, ...data }, done);
    else createGame.mutate(data, done);
  };
  const remove = (game) => {
    const warning = game.usedIn
      ? `Delete ${game.name}? It will also be taken off ${game.usedIn} ${game.usedIn === 1 ? "bootcamp" : "bootcamps"} that include it.`
      : `Delete ${game.name}?`;
    if (window.confirm(warning)) deleteGame.mutate(game.id);
  };

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: "0 0 3px", fontSize: 17, fontWeight: 800, color: "#111827" }}>Games</h2>
          <p style={{ margin: 0, fontSize: 12.5, color: "#6B7280", lineHeight: 1.5, maxWidth: 560 }}>
            The games and play that make a bootcamp more than lessons. Describe each one once here, then add it to any bootcamp — families see them on the bootcamp&rsquo;s page on the website.
          </p>
        </div>
        <button
          type="button" onClick={() => setEditing({})}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(254,177,57,0.35)" }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> New Game
        </button>
      </div>

      {isLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>Loading games…</p>
      ) : isError ? (
        <div style={{ padding: "16px 20px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: 12, color: "#EF4444", fontSize: 14 }}>Failed to load games: {error?.message}</div>
      ) : (
        <>
          {games.length === 0 && (
            <div style={{ padding: "18px 20px", borderRadius: 14, border: "1.5px dashed #E5E7EB", backgroundColor: "#F9FAFB", marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#374151" }}>No games yet</p>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "#6B7280", lineHeight: 1.55 }}>Start with a few well-known ones below, or add your own.</p>
            </div>
          )}

          {games.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14, marginBottom: 16 }}>
              {games.map((game) => (
                <div key={game.id} style={{ backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <GameBadge game={game} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{game.name}</h3>
                      <p style={{ margin: "2px 0 0", fontSize: 11.5, color: game.usedIn ? "#059669" : "#9CA3AF", fontWeight: 600 }}>
                        {game.usedIn ? `In ${game.usedIn} ${game.usedIn === 1 ? "bootcamp" : "bootcamps"}` : "Not in a bootcamp yet"}
                      </p>
                    </div>
                    <button type="button" title="Edit game" style={iconBtn} onClick={() => setEditing(game)}><FiEdit2 size={13} /></button>
                    <button type="button" title="Delete game" style={{ ...iconBtn, color: "#DC2626" }} onClick={() => remove(game)}><FiTrash2 size={13} /></button>
                  </div>
                  {game.description && <p style={{ margin: 0, fontSize: 12.5, color: "#6B7280", lineHeight: 1.5 }}>{game.description}</p>}
                  <SkillChips skills={game.skills} max={4} />
                </div>
              ))}
            </div>
          )}

          <StarterChips existingNames={existingNames} disabled={createGame.isPending} onPick={(starter) => createGame.mutate(starter)} />
        </>
      )}

      {editing && <GameFormModal game={editing} saving={createGame.isPending || updateGame.isPending} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}
