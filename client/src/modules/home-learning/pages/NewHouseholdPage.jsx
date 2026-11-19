import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiArrowLeft } from "react-icons/fi";
import { HouseholdFields } from "../components/HouseholdFields";
import { inputStyle, labelStyle, panelStyle, primaryButton } from "../components/ui";
import { useCreateHousehold, useHouseholds, usePackages, usePickLists } from "../hooks/useHomeLearning";

const EMPTY_HOUSEHOLD = { guardianName: "", guardianEmail: "", guardianPhone: "", county: "", subCounty: "", town: "", addressLine: "", landmark: "", mapUrl: "", locationPhotos: [], packageId: "", childCount: "", billingPeriod: "", status: "pending", startDate: "", notes: "", portalPassword: "", fromLearnerId: "" };

// Home Learning → Add household (/home-learning/new): the family, their package and home. Saving
// opens the new family's page — with the learner it started from ready to place, if any.
export default function NewHouseholdPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_HOUSEHOLD);
  const { households } = useHouseholds();
  const { packages, isLoading: packagesLoading, hasActive } = usePackages();
  const { learners, availableLearners } = usePickLists(households);
  const create = useCreateHousehold();

  // Picking a learner who's already in the system fills in the parent from their profile.
  const startFromLearner = (learnerId) => {
    const learner = learners.find((l) => l.id === learnerId);
    setForm((current) => ({
      ...current,
      fromLearnerId: learnerId,
      ...(learner ? { guardianName: learner.guardianName || "", guardianPhone: learner.guardianPhone || "", guardianEmail: learner.guardianEmail || "" } : {}),
    }));
  };
  const submit = (event) => {
    event.preventDefault();
    const { billingPeriod, ...rest } = form;
    create.mutate({ ...rest, childCount: form.childCount === "" ? undefined : Number(form.childCount), ...(billingPeriod ? { billingPeriod } : {}) }, {
      onSuccess: (created) => {
        toast.success(form.fromLearnerId ? "Household added — now choose the learner's curriculum and grade" : "Household added — now add the children");
        navigate(`/home-learning/${created.id}${form.fromLearnerId ? `?place=${form.fromLearnerId}` : ""}`, { replace: true });
      },
    });
  };

  return <div style={{ width: "100%", maxWidth: 1000, fontFamily: "Inter, sans-serif", color: "#111827", display: "grid", gridTemplateColumns: "100%", gap: 14 }}>
    <Link to="/home-learning" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#25476a", textDecoration: "none", justifySelf: "start" }}><FiArrowLeft size={14} /> Home Learning</Link>
    <div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Add a household</h1>
      <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 14 }}>Register a family, their package and home location. You add the children on the next screen.</p>
    </div>

    {!packagesLoading && !hasActive && <div role="status" style={{ ...panelStyle, padding: "14px 18px", background: "#FFF7E8", borderColor: "#FDE3B0", color: "#92400E", fontSize: 13 }}>
      There are no active packages yet, so households can&apos;t be added. Create one in{" "}
      <Link to="/billing?tab=packages" style={{ color: "#92400E", fontWeight: 800 }}>Billing → Packages</Link>.
    </div>}

    <form onSubmit={submit} style={{ ...panelStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(210px,100%),1fr))", gap: 14 }}>
      <div style={{ gridColumn: "1/-1", padding: 14, borderRadius: 12, background: "#F8FBFE", border: "1px dashed #A8D5EE" }}>
        <label style={labelStyle}>
          Is one of the children already in the system? (optional)
          <select style={inputStyle} value={form.fromLearnerId} onChange={(e) => startFromLearner(e.target.value)}>
            <option value="">No — I&apos;ll type the parent&apos;s details</option>
            {availableLearners.map((learner) => <option key={learner.id} value={learner.id}>{learner.firstName} {learner.lastName}{learner.guardianName ? ` · parent: ${learner.guardianName}` : ""}</option>)}
          </select>
        </label>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6B7280" }}>Picking a learner fills in the parent&apos;s details from their profile. After saving, the household opens with that learner ready to place.</p>
      </div>
      <HouseholdFields values={form} setValue={(key, value) => setForm((current) => ({ ...current, [key]: value }))} packages={packages} showStatus />
      <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ color: "#6B7280", fontSize: 12 }}>The household is billed at the package price shown above. Its parent&apos;s details are also added to each child&apos;s profile where missing.</span>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/home-learning" style={{ ...primaryButton, background: "#fff", color: "#4B5563", border: "1px solid #D1D5DB", textDecoration: "none" }}>Cancel</Link>
          <button disabled={create.isPending || !hasActive} style={primaryButton}>{create.isPending ? "Saving…" : "Add household"}</button>
        </div>
      </div>
    </form>
  </div>;
}
