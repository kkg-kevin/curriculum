import { useState } from "react";
import { FiChevronLeft, FiChevronRight, FiX } from "react-icons/fi";
import { useCreateGame, useGames } from "../hooks/useGames";
import { GameBadge, GameIcon } from "./GameTile";
import GameFormModal from "./GameFormModal";
import { StarterChips } from "./GamesLibrarySection";

const MAX_GAMES = 30;
const arrowBtn = (disabled) => ({ width: 22, height: 22, borderRadius: 6, border: "1px solid #E5E7EB", background: "#fff", color: disabled ? "#D1D5DB" : "#6B7280", display: "grid", placeItems: "center", cursor: disabled ? "default" : "pointer", padding: 0 });
const subLabel = { margin: "0 0 6px", fontSize: 11.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.04em" };

// The bootcamp form's games picker. `value` is the bootcamp's game ids in the order they will be
// shown; games come from the Events games library, and one can be added to the library from
// here without leaving the form.
export default function GamesField({ value = [], onChange }) {
  const { data: games = [], isLoading } = useGames();
  const createGame = useCreateGame({ quiet: true });
  const [creating, setCreating] = useState(false);

  const byId = new Map(games.map((game) => [game.id, game]));
  // Ids whose game has since been deleted are simply not shown (the server drops them too).
  const selected = value.map((id) => byId.get(id)).filter(Boolean);
  const available = games.filter((game) => !value.includes(game.id));
  const existingNames = new Set(games.map((game) => game.name.toLowerCase()));
  const full = value.length >= MAX_GAMES;

  const add = (id) => { if (!full && !value.includes(id)) onChange([...value, id]); };
  const remove = (id) => onChange(value.filter((v) => v !== id));
  const move = (index, by) => {
    const ids = selected.map((game) => game.id);
    const target = index + by;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    onChange(ids);
  };
  // A new game goes into the library and straight onto this bootcamp.
  const createAndAdd = (data, after) => createGame.mutate(data, { onSuccess: (game) => { add(game.id); after?.(); } });

  if (isLoading) return <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>Loading your games…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {selected.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10 }}>
          {selected.map((game, index) => (
            <div key={game.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 12, border: "1.5px solid #cfe6f5", background: "#F7FBFE" }}>
              <GameBadge game={game} size={36} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{game.name}</span>
              <button type="button" title="Show earlier" disabled={index === 0} onClick={() => move(index, -1)} style={arrowBtn(index === 0)}><FiChevronLeft size={13} /></button>
              <button type="button" title="Show later" disabled={index === selected.length - 1} onClick={() => move(index, 1)} style={arrowBtn(index === selected.length - 1)}><FiChevronRight size={13} /></button>
              <button type="button" title={`Remove ${game.name}`} onClick={() => remove(game.id)} style={{ ...arrowBtn(false), color: "#DC2626" }}><FiX size={13} /></button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, padding: "12px 14px", borderRadius: 10, background: "#F9FAFB", border: "1.5px dashed #E5E7EB", fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
          No games on this bootcamp yet. Add some below and the website shows them as part of what a child gets — leave it empty and nothing about games appears.
        </p>
      )}

      {available.length > 0 && !full && (
        <div>
          <p style={subLabel}>From your games</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {available.map((game) => (
              <button
                key={game.id} type="button" onClick={() => add(game.id)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999, border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
              >
                <GameIcon name={game.icon} size={15} /> {game.name} <span style={{ color: "#25476a", fontWeight: 800 }}>+</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!full && (
        <div>
          <p style={subLabel}>Quick add</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <StarterChips existingNames={existingNames} disabled={createGame.isPending} onPick={(starter) => createAndAdd(starter)} />
            <button
              type="button" onClick={() => setCreating(true)}
              style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid #25476a", background: "#25476a", color: "#fff", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              + Add your own game
            </button>
          </div>
        </div>
      )}

      {creating && (
        <GameFormModal game={{}} saving={createGame.isPending} onSave={(data) => createAndAdd(data, () => setCreating(false))} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}
