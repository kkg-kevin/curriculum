import { useState } from "react";
import { useCreateModule, useCreateSessionsBulk } from "../hooks/useCourse";

// Creating a module can seed it with N sessions right away (bulk-created into that module),
// instead of starting empty and adding sessions one at a time afterward.
export default function AddModuleModal({ courseId, defaultName, onClose }) {
  const { mutate: createModule, isPending: creatingModule } = useCreateModule(courseId);
  const { mutateAsync: createSessionsBulkAsync, isPending: creatingSessions } = useCreateSessionsBulk();
  const [name, setName] = useState(defaultName);
  const [sessionCount, setSessionCount] = useState("0");
  const [error, setError] = useState("");
  const isPending = creatingModule || creatingSessions;

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Name is required"); return; }
    const count = Math.max(0, Math.min(30, Number(sessionCount) || 0));
    createModule({ name: trimmed }, {
      onSuccess: async (newModule) => {
        if (count > 0) {
          await createSessionsBulkAsync({ courseId, count, moduleId: newModule.id });
        }
        onClose();
      },
    });
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,38,69,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: "18px", width: "100%", maxWidth: "440px", boxShadow: "0 24px 64px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", background: "linear-gradient(135deg,#1a3550 0%,#25476a 60%,#2e7db5 100%)" }}>
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#fff" }}>New Module</h2>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Groups sessions under a named bucket in this course</p>
        </div>
        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <div style={{ padding: "9px 12px", background: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "9px", color: "#EF4444", fontSize: "12.5px" }}>
              {error}
            </div>
          )}
          <div>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "#374151", display: "block", marginBottom: "5px" }}>Module Name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Module 1"
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: "9px", border: "1.5px solid #E5E7EB", fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "#374151", display: "block", marginBottom: "5px" }}>Number of Sessions</label>
            <input
              type="number"
              min="0"
              max="30"
              value={sessionCount}
              onChange={(e) => setSessionCount(e.target.value)}
              style={{ width: "140px", boxSizing: "border-box", padding: "9px 11px", borderRadius: "9px", border: "1.5px solid #E5E7EB", fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none" }}
            />
            <p style={{ margin: "6px 0 0", fontSize: "11.5px", color: "#9CA3AF" }}>
              Optional — creates this many blank sessions inside the module right away. Leave at 0 to add sessions later.
            </p>
          </div>
        </div>
        <div style={{ padding: "14px 22px", display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid #F3F4F6" }}>
          <button type="button" onClick={onClose} style={{ padding: "9px 16px", background: "#fff", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "9px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            style={{ padding: "9px 18px", background: isPending ? "#fde3b0" : "#feb139", color: "#25476a", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer" }}
          >
            {isPending ? "Creating…" : "Create Module"}
          </button>
        </div>
      </div>
    </div>
  );
}
