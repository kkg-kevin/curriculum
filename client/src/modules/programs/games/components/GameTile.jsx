import { createElement } from "react";
import { DEFAULT_GAME_COLOR } from "../starterGames";
import { gameIcon } from "../gameIcons";

// One of the games library's line icons (see gameIcons.js), in the current text colour.
export function GameIcon({ name, size = 20, strokeWidth = 2 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ display: "block", flexShrink: 0 }}
    >
      {gameIcon(name).shapes.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}

// The picture a game is known by everywhere in the admin app: its photo when it has one,
// otherwise its icon in white on its own colour.
export function GameBadge({ game, size = 44 }) {
  const color = game.color || DEFAULT_GAME_COLOR;
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: size * 0.28, flexShrink: 0, display: "grid", placeItems: "center", overflow: "hidden", color: "#fff",
        background: game.image ? `center / cover no-repeat url(${game.image})` : `linear-gradient(135deg, ${color}, ${color}cc)`,
        boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.12)",
      }}
    >
      {!game.image && <GameIcon name={game.icon} size={Math.round(size * 0.56)} strokeWidth={1.8} />}
    </span>
  );
}

export function SkillChips({ skills = [], max = 3 }) {
  if (!skills.length) return null;
  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {skills.slice(0, max).map((skill) => (
        <span key={skill} style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, color: "#25476a", background: "#EEF6FC", border: "1px solid #cfe6f5" }}>{skill}</span>
      ))}
      {skills.length > max && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", alignSelf: "center" }}>+{skills.length - max}</span>}
    </span>
  );
}
