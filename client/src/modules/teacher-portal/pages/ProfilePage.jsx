import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiCalendar, FiClock, FiHome, FiMail, FiPhone, FiUserCheck } from "react-icons/fi";
import { useUpdateTeacher } from "../../teachers/hooks/useTeacher";
import { classApi } from "../../classes/services/classApi";
import Avatar from "../../../components/ui/Avatar";

const ACCENT = "#25476a";

const STATUS_STYLES = {
  active:   { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
  on_leave: { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" },
};
const STATUS_LABELS = { active: "Active", inactive: "Inactive", on_leave: "On Leave" };

function Section({ title, children, action }) {
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</h2>
        {action}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function DetailRow({ icon, label, value, empty = "—" }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ color: "#9CA3AF", flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <p style={{ margin: "0 0 1px", fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
        <p style={{ margin: 0, fontSize: 14, color: "#111827" }}>{value || empty}</p>
      </div>
    </div>
  );
}

const iconMail = <FiMail size={14} strokeWidth={2} />;
const iconPhone = <FiPhone size={14} strokeWidth={2} />;
const iconCalendar = <FiCalendar size={14} strokeWidth={2} />;
const iconClock = <FiClock size={14} strokeWidth={2} />;

export default function ProfilePage() {
  const navigate = useNavigate();
  const { teacher, teacherLoading, hubs } = useOutletContext();
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");

  // Unlike the rest of the portal, Profile is identity info, not a workspace view — it always
  // shows every hub the teacher is assigned to, regardless of which one the switcher is
  // currently scoped to.
  const { data: classesData } = useQuery({
    queryKey: ["classes", "byClassTeacher", teacher?.id],
    queryFn: () => classApi.getAll({ classTeacherId: teacher.id }),
    enabled: !!teacher?.id,
  });
  const myClasses = classesData?.data || [];

  const { mutate: updateTeacher, isPending: savingPhone } = useUpdateTeacher();

  useEffect(() => { if (teacher) setPhoneDraft(teacher.phone || ""); }, [teacher]);

  if (teacherLoading) {
    return <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "#9CA3AF", fontSize: 14 }}>Loading…</div>;
  }

  if (!teacher) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", color: "#25476a", margin: "0 auto 16px" }}><FiUserCheck size={28} strokeWidth={1.8} /></div>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No teacher profile linked yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Ask your school admin to add you as a teacher using this same email address.</p>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[teacher.status] || STATUS_STYLES.inactive;

  const savePhone = () => {
    updateTeacher({ id: teacher.id, data: { phone: phoneDraft.trim() } }, { onSuccess: () => setEditingPhone(false) });
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: 20, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative" }}>
          <Avatar firstName={teacher.firstName} lastName={teacher.lastName} borderColor="rgba(255,255,255,0.3)" />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.3px" }}>{teacher.firstName} {teacher.lastName}</h1>
              <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}>
                {STATUS_LABELS[teacher.status] ?? teacher.status}
              </span>
            </div>
            {hubs?.length > 0 && (
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
                {hubs.map((h) => h.name).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, alignItems: "start" }}>
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Section title="My Classes">
            {myClasses.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF", textAlign: "center", padding: "8px 0" }}>Not assigned as class teacher to any class yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {myClasses.map((c) => (
                  <div key={c.id} onClick={() => navigate(`/teacher-portal/classes/${c.id}`)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, border: "1px solid #E5E7EB", cursor: "pointer" }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{c.gradeName}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>Academic Year {c.academicYear} · {c.learnerCount ?? 0} learner{(c.learnerCount ?? 0) !== 1 ? "s" : ""}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>View roster →</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Contact Details"
            action={!editingPhone && (
              <button type="button" onClick={() => setEditingPhone(true)} style={{ background: "none", border: "none", color: ACCENT, fontWeight: 600, fontSize: 12, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                Edit phone
              </button>
            )}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <DetailRow icon={iconMail} label="Email" value={teacher.email} />
              {editingPhone ? (
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Phone</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={phoneDraft}
                      onChange={(e) => setPhoneDraft(e.target.value)}
                      placeholder="+254 700 000 000"
                      style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none" }}
                    />
                    <button type="button" onClick={savePhone} disabled={savingPhone} style={{ padding: "8px 14px", backgroundColor: ACCENT, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: savingPhone ? "not-allowed" : "pointer", opacity: savingPhone ? 0.6 : 1 }}>
                      {savingPhone ? "Saving…" : "Save"}
                    </button>
                    <button type="button" onClick={() => { setEditingPhone(false); setPhoneDraft(teacher.phone || ""); }} style={{ padding: "8px 14px", backgroundColor: "transparent", color: "#6B7280", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <DetailRow icon={iconPhone} label="Phone" value={teacher.phone} />
              )}
              <p style={{ margin: 0, fontSize: 11.5, color: "#9CA3AF" }}>
                Name, email, and hub assignment are managed by your administrator.
              </p>
            </div>
          </Section>
        </div>

        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Section title="My Learning Hubs">
            {hubs?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {hubs.map((hub) => (
                  <div key={hub.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee" }}>
                    <span style={{ fontSize: 24, flexShrink: 0, color: ACCENT, display: "flex", alignItems: "center" }}><FiHome size={20} strokeWidth={2} /></span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: ACCENT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hub.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>{hub.code}{hub.address?.county ? ` · ${hub.address.county}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF", textAlign: "center" }}>Not assigned to any learning hub.</p>
            )}
          </Section>

          <Section title="Record Info">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <DetailRow icon={iconCalendar} label="Added" value={new Date(teacher.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })} />
              <DetailRow icon={iconClock} label="Last Updated" value={new Date(teacher.updatedAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })} />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
