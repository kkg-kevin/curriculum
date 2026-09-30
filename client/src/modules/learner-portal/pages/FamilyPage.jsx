import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiCheckCircle, FiClock, FiPlus, FiUsers } from "react-icons/fi";
import { homeLearningApi } from "../../home-learning/services/homeLearningApi";

const T = {
  accent: "#25476a", accentDeep: "#1a3550", tintBg: "#e8f5fb", tintBorder: "#a8d5ee",
  ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "22px 24px" };
const inputStyle = { width: "100%", boxSizing: "border-box", border: `1.5px solid ${T.border}`, borderRadius: 9, padding: "9px 11px", fontSize: 14, fontFamily: "Inter, sans-serif", background: "#fff", color: T.ink };
const labelStyle = { display: "grid", gap: 6, color: "#374151", fontSize: 13, fontWeight: 600 };
const primaryButton = { border: 0, borderRadius: 10, padding: "10px 18px", background: T.accent, color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 };
const secondaryButton = { ...primaryButton, background: "#fff", color: "#374151", border: `1.5px solid ${T.border}` };

const EMPTY_CHILD = { firstName: "", lastName: "", gender: "", dateOfBirth: "", currentGrade: "", username: "", password: "" };
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,30}$/;
const formatMoney = (amount, currency = "KES") => `${currency} ${Number(amount || 0).toLocaleString("en-KE")}`;

function AddChildForm({ household, onDone, onCancel }) {
  const queryClient = useQueryClient();
  const [child, setChild] = useState(EMPTY_CHILD);
  const set = (key) => (event) => setChild((current) => ({ ...current, [key]: event.target.value }));
  const mutation = useMutation({
    mutationFn: (data) => homeLearningApi.addFamilyChild(household.id, data),
    onSuccess: (created) => {
      // The new child joins this parent's "Viewing:" switcher and the family list.
      queryClient.invalidateQueries({ queryKey: ["learners"] });
      queryClient.invalidateQueries({ queryKey: ["home-learning", "family"] });
      onDone({ ...created, password: child.password });
    },
    onError: (error) => toast.error(error.message || "Could not add the child"),
  });

  const submit = (event) => {
    event.preventDefault();
    if (!USERNAME_RE.test(child.username.trim())) return toast.error("Usernames are 3–30 letters, numbers, dots, underscores or hyphens");
    if (child.password.length < 8) return toast.error("The password must be at least 8 characters");
    mutation.mutate({ ...child, username: child.username.trim() });
  };

  return (
    <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 18, padding: 18, borderRadius: 12, background: "#F8FAFC", border: `1px solid ${T.border}` }}>
      <label style={labelStyle}>First name<input style={inputStyle} required maxLength={80} value={child.firstName} onChange={set("firstName")} /></label>
      <label style={labelStyle}>Last name<input style={inputStyle} required maxLength={80} value={child.lastName} onChange={set("lastName")} /></label>
      <label style={labelStyle}>
        Gender
        <select style={inputStyle} required value={child.gender} onChange={set("gender")}>
          <option value="">Choose…</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label style={labelStyle}>Date of birth (optional)<input style={inputStyle} type="date" value={child.dateOfBirth} onChange={set("dateOfBirth")} /></label>
      <label style={{ ...labelStyle, gridColumn: "1/-1" }}>
        Current school grade (optional)
        <input style={inputStyle} maxLength={150} value={child.currentGrade} onChange={set("currentGrade")} placeholder="e.g. Grade 4 at Karen Primary" />
        <span style={{ fontSize: 12, fontWeight: 400, color: T.inkMuted }}>Helps us place them at the right level.</span>
      </label>
      <div style={{ gridColumn: "1/-1", paddingTop: 4, borderTop: `1px solid ${T.border}` }}>
        <p style={{ margin: "12px 0 0", fontSize: 13, fontWeight: 700, color: T.ink }}>Their own login</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted }}>Your child signs in with this username and password and sees only their own learning. You keep seeing all your children from your account.</p>
      </div>
      <label style={labelStyle}>Username<input style={inputStyle} required minLength={3} maxLength={30} autoComplete="off" value={child.username} onChange={set("username")} placeholder="e.g. amani.k" /></label>
      <label style={labelStyle}>Password<input style={inputStyle} required minLength={8} maxLength={72} type="password" autoComplete="new-password" value={child.password} onChange={set("password")} placeholder="At least 8 characters" /></label>
      <div style={{ gridColumn: "1/-1", display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="submit" disabled={mutation.isPending} style={primaryButton}>{mutation.isPending ? "Adding…" : "Add child"}</button>
        <button type="button" onClick={onCancel} style={secondaryButton}>Cancel</button>
      </div>
    </form>
  );
}

function HouseholdCard({ household }) {
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(null);
  const pendingPayment = household.status === "pending";

  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.inkFaint }}>Home Learning package</p>
          <h2 style={{ margin: "4px 0 2px", fontSize: 19, fontWeight: 800, color: T.ink }}>{household.packageName || "Your package"}</h2>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>{formatMoney(household.monthlyAmount, household.currency)} per month · {household.places} {household.places === 1 ? "child" : "children"}</p>
        </div>
        <div style={{ minWidth: 200 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.ink, fontWeight: 700 }}>
            <span>{household.filled} of {household.places} places filled</span>
            <span style={{ color: household.placesLeft ? "#047857" : T.inkMuted }}>{household.placesLeft} free</span>
          </div>
          <div style={{ marginTop: 6, height: 8, borderRadius: 99, background: "#EEF1F5", overflow: "hidden" }}>
            <div style={{ width: `${household.places ? Math.min(100, (household.filled / household.places) * 100) : 0}%`, height: "100%", background: T.accent }} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
        {household.children.map((child) => (
          <div key={child.learnerId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "11px 14px", borderRadius: 12, border: `1px solid ${T.border}` }}>
            <div>
              <strong style={{ fontSize: 14, color: T.ink }}>{child.name}</strong>
              {child.username && <span style={{ marginLeft: 8, fontSize: 12, color: T.inkMuted }}>login: {child.username}</span>}
            </div>
            {child.awaitingPlacement
              ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#92400E", background: "#FEF3C7", borderRadius: 99, padding: "3px 10px" }}><FiClock size={12} /> Being placed by our team</span>
              : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#047857", background: "#ECFDF5", borderRadius: 99, padding: "3px 10px" }}><FiCheckCircle size={12} /> Learning</span>}
          </div>
        ))}
      </div>

      {justAdded && (
        <div role="status" style={{ marginTop: 16, padding: "13px 16px", borderRadius: 12, background: T.tintBg, border: `1px solid ${T.tintBorder}`, fontSize: 13, color: T.accentDeep, lineHeight: 1.55 }}>
          <strong>{justAdded.name}</strong> has been added. They can sign in with username <strong>{justAdded.username}</strong> and the password you chose.
          Our team will choose their curriculum, grade and educator shortly.
        </div>
      )}

      {household.placesLeft > 0 ? (
        adding ? (
          <AddChildForm
            household={household}
            onCancel={() => setAdding(false)}
            onDone={(created) => { setAdding(false); setJustAdded(created); toast.success(`${created.name} added`); }}
          />
        ) : (
          <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={() => { setJustAdded(null); setAdding(true); }} style={primaryButton}><FiPlus size={16} /> Add a child</button>
            <span style={{ fontSize: 13, color: T.inkMuted }}>
              Your package has {household.placesLeft} free {household.placesLeft === 1 ? "place" : "places"} — already included in your monthly price.
              {pendingPayment && " New children can start once your first payment is confirmed."}
            </span>
          </div>
        )
      ) : (
        <p style={{ margin: "18px 0 0", fontSize: 13, color: T.inkMuted }}>All the places in your package are filled. To add more children, contact us and we&rsquo;ll move you to a larger package.</p>
      )}
    </section>
  );
}

// Parent portal → My Family. A parent whose package covers more children than they've registered
// (e.g. three places, one child so far) adds the others here: each gets their own login and is
// placed by the school (curriculum, grade, educator) — see home-learning-signup.service.js's
// addChildFromParent. Only the parent's own login reaches this page (a child's login can't).
export default function FamilyPage() {
  const { data: households = [], isLoading, isError } = useQuery({ queryKey: ["home-learning", "family"], queryFn: homeLearningApi.getFamily });

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "grid", gap: 20, maxWidth: 980 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: T.tintBg, color: T.accent, display: "grid", placeItems: "center" }}><FiUsers size={22} /></div>
        <div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, color: T.ink }}>My Family</h1>
          <p style={{ margin: "3px 0 0", fontSize: 14, color: T.inkMuted }}>Your Home Learning package and children. Add a child to any free place in your package.</p>
        </div>
      </header>

      {isLoading ? (
        <div style={{ ...cardStyle, color: T.inkMuted }}>Loading your family…</div>
      ) : isError ? (
        <div style={{ ...cardStyle, color: "#B91C1C" }}>Couldn&rsquo;t load your family. Please refresh the page.</div>
      ) : households.length === 0 ? (
        <div style={{ ...cardStyle, color: T.inkMuted }}>You don&rsquo;t have a Home Learning package with us yet.</div>
      ) : (
        households.map((household) => <HouseholdCard key={household.id} household={household} />)
      )}
    </div>
  );
}
