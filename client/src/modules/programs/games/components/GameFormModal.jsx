import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ImageUploadField from "../../../../components/ImageUploadField";
import { GameBadge, GameIcon } from "./GameTile";
import { DEFAULT_GAME_COLOR, GAME_COLORS } from "../starterGames";
import { DEFAULT_GAME_ICON, GAME_ICONS } from "../gameIcons";

const field = { display: "flex", flexDirection: "column", gap: 6 };
const label = { fontSize: 13, fontWeight: 600, color: "#374151" };
const hint = { fontSize: 12, color: "#9CA3AF", fontWeight: 400 };
const input = { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff" };

const toForm = (game) => ({
  name: game?.name || "",
  description: game?.description || "",
  skills: game?.skills || [],
  icon: game?.icon || DEFAULT_GAME_ICON,
  color: game?.color || DEFAULT_GAME_COLOR,
  image: game?.image || null,
});

// Add or edit one game. `game` is the game being edited, or a partial starting point (e.g. a
// name typed in a picker) for a new one — it has no `id` then.
export default function GameFormModal({ game, saving, onSave, onClose }) {
  const [form, setForm] = useState(() => toForm(game));
  const [skillDraft, setSkillDraft] = useState("");
  const [error, setError] = useState("");
  const isEdit = Boolean(game?.id);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const addSkill = () => {
    const value = skillDraft.trim();
    if (!value || form.skills.length >= 6 || form.skills.some((s) => s.toLowerCase() === value.toLowerCase())) return setSkillDraft("");
    set("skills", [...form.skills, value.slice(0, 30)]);
    setSkillDraft("");
  };

  const submit = () => {
    if (!form.name.trim()) return setError("Give the game a name");
    // A tag still sitting in the box counts — nobody expects to lose it by pressing Save.
    const pending = skillDraft.trim();
    const skills = pending && form.skills.length < 6 && !form.skills.some((s) => s.toLowerCase() === pending.toLowerCase()) ? [...form.skills, pending.slice(0, 30)] : form.skills;
    onSave({ ...form, name: form.name.trim(), description: form.description.trim(), skills });
  };

  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label={isEdit ? "Edit game" : "Add a game"}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(15,38,69,0.45)", display: "grid", placeItems: "center", padding: 16, fontFamily: "Inter, sans-serif" }}
    >
      <div style={{ width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", background: "#fff", borderRadius: 18, boxShadow: "0 24px 60px rgba(15,38,69,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: "1px solid #F3F4F6" }}>
          <GameBadge game={form} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#111827" }}>{isEdit ? "Edit game" : "Add a game"}</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6B7280" }}>This is what families see on the bootcamp page.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: "none", background: "none", fontSize: 22, lineHeight: 1, color: "#9CA3AF", cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={field}>
            <label style={label}>Name</label>
            <input autoFocus style={input} maxLength={80} value={form.name} placeholder="e.g. Chess" onChange={(e) => { set("name", e.target.value); setError(""); }} />
            {error && <span style={{ fontSize: 12, color: "#DC2626" }}>{error}</span>}
          </div>

          <div style={field}>
            <label style={label}>What do the children do? <span style={hint}>(optional)</span></label>
            <textarea style={{ ...input, resize: "vertical", minHeight: 62 }} maxLength={300} value={form.description} placeholder="One or two lines a parent will read" onChange={(e) => set("description", e.target.value)} />
          </div>

          <div style={field}>
            <label style={label}>What it builds <span style={hint}>(up to 6 — shown on the back of the card)</span></label>
            {form.skills.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {form.skills.map((skill) => (
                  <span key={skill} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "#EEF6FC", border: "1px solid #a8d5ee", color: "#25476a" }}>
                    {skill}
                    <button type="button" aria-label={`Remove ${skill}`} onClick={() => set("skills", form.skills.filter((s) => s !== skill))} style={{ background: "none", border: "none", cursor: "pointer", color: "#25476a", padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
            {form.skills.length < 6 && (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={{ ...input, flex: 1 }} maxLength={30} value={skillDraft} placeholder="e.g. Strategy — press Enter"
                  onChange={(e) => setSkillDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                />
                <button type="button" onClick={addSkill} style={{ padding: "9px 14px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: "#fff", color: "#25476a", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Add</button>
              </div>
            )}
          </div>

          <div style={field}>
            <label style={label}>Icon</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Object.entries(GAME_ICONS).map(([key, icon]) => (
                <button
                  key={key} type="button" title={icon.label} aria-label={`Use the ${icon.label} icon`} aria-pressed={form.icon === key} onClick={() => set("icon", key)}
                  style={{ width: 36, height: 36, borderRadius: 9, display: "grid", placeItems: "center", cursor: "pointer", color: form.icon === key ? "#fff" : "#374151", background: form.icon === key ? form.color : "#fff", border: `1.5px solid ${form.icon === key ? form.color : "#E5E7EB"}` }}
                >
                  <GameIcon name={key} size={19} strokeWidth={1.8} />
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              <span style={{ fontSize: 12, color: "#6B7280" }}>Card colour</span>
              {GAME_COLORS.map((color) => (
                <button
                  key={color} type="button" aria-label={`Use colour ${color}`} aria-pressed={form.color === color} onClick={() => set("color", color)}
                  style={{ width: 26, height: 26, borderRadius: "50%", background: color, cursor: "pointer", border: "2px solid #fff", boxShadow: form.color === color ? `0 0 0 2.5px ${color}` : "0 0 0 1px #E5E7EB" }}
                />
              ))}
            </div>
          </div>

          <div style={field}>
            <label style={label}>Your own photo <span style={hint}>(optional — used instead of the icon)</span></label>
            <ImageUploadField value={form.image} onChange={(url) => set("image", url)} width="160px" height="104px" />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 22px", borderTop: "1px solid #F3F4F6" }}>
          <button type="button" onClick={onClose} style={{ padding: "10px 18px", background: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Cancel</button>
          <button type="button" disabled={saving} onClick={submit} style={{ padding: "10px 22px", background: saving ? "#b8d9ee" : "#25476a", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add game"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
