import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiPlus, FiTag } from "react-icons/fi";
import { BRAND, FONT, card, cardHeading } from "../../../theme/brand";
import { errorOf, expensesApi } from "../services/expensesApi";
import { btn, hint, input, label, primary } from "./ui";

// Expenses → Settings: the categories people choose from.
const keyOf = (text) => String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || `cat_${Date.now()}`;

export default function SettingsPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["expenses", "settings"], queryFn: expensesApi.settings });
  const [form, setForm] = useState(null);
  useEffect(() => { if (data) setForm({ categories: data.categories.map((c) => ({ ...c })) }); }, [data]);
  const save = useMutation({
    mutationFn: () => expensesApi.saveSettings({ categories: form.categories.map((c) => ({ key: c.key, label: c.label.trim(), active: c.active })) }),
    onSuccess: (saved) => { qc.setQueryData(["expenses", "settings"], saved); qc.invalidateQueries({ queryKey: ["expenses", "options"] }); toast.success("Settings saved"); },
    onError: (err) => toast.error(errorOf(err, "Couldn't save the settings")),
  });
  if (!form) return <p style={hint}>Loading…</p>;
  const setCat = (i, k, v) => setForm((f) => ({ ...f, categories: f.categories.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} style={{ display: "grid", gap: 14, gridTemplateColumns: "100%", fontFamily: FONT }}>
      <section style={{ ...card, padding: 18, display: "grid", gap: 12, gridTemplateColumns: "100%" }}>
        <h3 style={cardHeading}><FiTag size={13} /> Categories</h3>
        <p style={hint}>What people choose from for each expense. A category switched off can't be chosen for new expenses; older claims keep it.</p>
        {form.categories.map((c, i) => (
          <div key={c.key} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", opacity: c.active ? 1 : 0.6 }}>
            <label style={{ ...label, flex: "2 1 260px" }}>Name
              <input style={input} value={c.label} onChange={(e) => setCat(i, "label", e.target.value)} maxLength={80} required />
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft, paddingBottom: 10 }}>
              <input type="checkbox" checked={c.active} onChange={(e) => setCat(i, "active", e.target.checked)} /> In use
            </label>
          </div>
        ))}
        <div>
          <button type="button" style={btn} onClick={() => setForm((f) => ({ ...f, categories: [...f.categories, { key: keyOf(`new_category_${f.categories.length + 1}`), label: "New category", active: true }] }))}>
            <FiPlus size={14} /> Add a category
          </button>
        </div>
      </section>
      <div><button type="submit" style={primary} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save settings"}</button></div>
    </form>
  );
}
