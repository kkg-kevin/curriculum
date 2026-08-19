import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useRoomsByHub, useCreateRoom, useUpdateRoom, useDeleteRoom } from "../../rooms/hooks/useRooms";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const T = {
  accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
const selectStyle = {
  padding: "8px 32px 8px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13,
  fontFamily: "Inter, sans-serif", backgroundColor: "#fff", color: T.ink, outline: "none", cursor: "pointer",
  appearance: "none", maxWidth: "100%",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
};
const inputStyle = { boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "Inter, sans-serif", color: T.ink, outline: "none" };

function RoomForm({ initial, onSubmit, onCancel, isSaving }) {
  const [form, setForm] = useState(() => initial || { name: "", capacity: "", notes: "", status: "active" });
  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const submit = () => {
    if (!form.name.trim()) return;
    onSubmit({
      name: form.name.trim(),
      capacity: form.capacity === "" ? null : Number(form.capacity),
      notes: form.notes,
      status: form.status,
    });
  };

  return (
    <div style={{ ...cardStyle, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, border: `1.5px solid ${T.tintBorder}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <input type="text" placeholder="Room name" value={form.name} onChange={(e) => set("name", e.target.value)} style={inputStyle} />
        <input type="number" min="1" placeholder="Capacity (optional)" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} style={inputStyle} />
        <select value={form.status} onChange={(e) => set("status", e.target.value)} style={selectStyle}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <input type="text" placeholder="Notes (optional)" value={form.notes} onChange={(e) => set("notes", e.target.value)} style={inputStyle} />

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={{ padding: "8px 16px", backgroundColor: "#fff", color: T.inkMuted, border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={isSaving || !form.name.trim()} style={{ padding: "8px 18px", backgroundColor: isSaving ? "#b8d9ee" : T.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: isSaving ? "not-allowed" : "pointer" }}>
          {isSaving ? "Saving…" : "Save Room"}
        </button>
      </div>
    </div>
  );
}

function RoomRow({ room, onEdit, onDelete }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 140 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>
          {room.name}
          {room.status === "inactive" && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: "#B91C1C", backgroundColor: "#FEF2F2", padding: "2px 8px", borderRadius: 20 }}>Inactive</span>}
        </p>
        <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint }}>
          {room.capacity ? `Capacity ${room.capacity}` : "No capacity set"}{room.notes ? ` · ${room.notes}` : ""}
        </p>
      </div>
      <button type="button" onClick={onEdit} style={{ padding: "5px 10px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
        Edit
      </button>
      <button type="button" onClick={onDelete} style={{ padding: "5px 10px", backgroundColor: "#FEF2F2", color: "#B91C1C", border: "1.5px solid #FECACA", borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
        Remove
      </button>
    </div>
  );
}

export default function RoomsPage() {
  const { school, hubsLoading: schoolLoading } = useOutletContext();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const { data: roomsData, isLoading: roomsLoading } = useRoomsByHub(school?.id);
  const rooms = (roomsData?.data || []).slice().sort((a, b) => a.name.localeCompare(b.name));

  const { mutate: createRoom, isPending: creating } = useCreateRoom();
  const { mutate: updateRoom, isPending: updating } = useUpdateRoom();
  const { mutate: deleteRoom } = useDeleteRoom();

  const handleCreate = (data) => {
    createRoom({ ...data, hubId: school.id }, { onSuccess: () => setAdding(false) });
  };
  const handleUpdate = (data) => {
    updateRoom({ id: editingId, data }, { onSuccess: () => setEditingId(null) });
  };
  const confirmDelete = () => {
    deleteRoom(pendingDeleteId);
    setPendingDeleteId(null);
  };

  if (schoolLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }
  if (!school) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px", fontFamily: "Inter, sans-serif" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No hub profile linked yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Ask an admin to link this login to a Learning Hub.</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>Rooms</h1>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 620 }}>
          Physical spaces at this hub — pick one when scheduling a timetable slot and it's automatically checked for double-booking.
        </p>
      </div>

      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: T.ink }}>Rooms</p>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.inkMuted }}>
              {roomsLoading ? "Loading…" : rooms.length === 0 ? "No rooms configured yet" : `${rooms.length} room${rooms.length === 1 ? "" : "s"}`}
            </p>
          </div>
          {!adding && (
            <button type="button" onClick={() => { setAdding(true); setEditingId(null); }} style={{ padding: "6px 14px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0 }}>
              + Add Room
            </button>
          )}
        </div>

        {roomsLoading ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading rooms…</div>
        ) : (
          <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {rooms.length === 0 && !adding && (
              <p style={{ margin: 0, fontSize: 12.5, color: T.inkFaint, fontStyle: "italic" }}>No rooms yet — add one to start picking it in the Timetable editor.</p>
            )}
            {rooms.map((room) => (
              editingId === room.id ? (
                <RoomForm
                  key={room.id}
                  initial={{ name: room.name, capacity: room.capacity ?? "", notes: room.notes || "", status: room.status }}
                  onSubmit={handleUpdate}
                  onCancel={() => setEditingId(null)}
                  isSaving={updating}
                />
              ) : (
                <RoomRow
                  key={room.id}
                  room={room}
                  onEdit={() => { setEditingId(room.id); setAdding(false); }}
                  onDelete={() => setPendingDeleteId(room.id)}
                />
              )
            ))}
            {adding && (
              <RoomForm onSubmit={handleCreate} onCancel={() => setAdding(false)} isSaving={creating} />
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!pendingDeleteId}
        title="Remove this room?"
        message="Any timetable slots using this room will keep their schedule but lose the room assignment."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
