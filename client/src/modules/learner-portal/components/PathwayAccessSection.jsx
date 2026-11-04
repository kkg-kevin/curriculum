import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiLock, FiRepeat, FiUnlock } from "react-icons/fi";
import CourseCatalogGrid from "../../courses/components/CourseCatalogGrid";
import { pathwaySubscriptionApi } from "../../pathway-subscriptions/services/pathwaySubscriptionApi";
import { formatDay } from "../../../utils/billingPeriods";

// The pathways this learner may open outside their class (pathway-subscriptions/): a website
// subscription (open until its paid period's end plus the grace days) or a one-off purchase (for
// good). An open pathway shows its courses as usual; a locked one shows them greyed with why —
// and, to the parent, a Renew button that raises the new period's invoice and opens it to pay.
// Progress on a locked pathway is kept.
export default function PathwayAccessSection({ pathways, isParent = false }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const renew = useMutation({
    mutationFn: (subscriptionId) => pathwaySubscriptionApi.renewMine(subscriptionId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pathway-subscriptions"] });
      if (result?.invoice?.id) {
        toast.success("Renewal invoice ready — pay it to open the courses again");
        navigate(`/parent/invoices/${result.invoice.id}`);
      } else {
        toast.success("Renewed");
      }
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Couldn't renew — please contact us"),
  });

  if (!pathways?.length) return null;
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "100%" }}>
      {pathways.map((p) => {
        const lifetime = p.source === "purchase";
        const until = lifetime ? "Yours to keep" : p.open ? `Open until ${formatDay(p.paidThrough || p.accessUntil)}` : p.subscriptionStatus === "pending" ? "Opens once the first payment is in" : "Locked — renew to carry on";
        return (
          <section key={p.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "16px 18px", display: "grid", gap: 12, gridTemplateColumns: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#38aae1" }}>{lifetime ? "Pathway" : "Pathway subscription"}</p>
                <h2 style={{ margin: "2px 0 0", fontSize: 17, fontWeight: 800, color: "#111827" }}>{p.pathwayName}</h2>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 800, background: p.open ? "#ECFDF5" : "#FFFBEB", color: p.open ? "#047857" : "#B45309" }}>
                {p.open ? <FiUnlock size={12} /> : <FiLock size={12} />} {until}
              </span>
            </div>
            {p.open ? (
              <CourseCatalogGrid role="learner" courses={p.courses || []} />
            ) : (
              <>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                  {(p.courses || []).map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "#F8FAFC", border: "1px dashed #D1D5DB", color: "#6B7280", fontSize: 13, fontWeight: 600 }}>
                      <FiLock size={13} style={{ flexShrink: 0 }} /> <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{c.name}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#6B7280", flex: "1 1 240px" }}>
                    {p.subscriptionStatus === "pending" ? "These courses open as soon as the first payment is recorded." : "Your work so far is kept — it's all here again once the subscription is renewed."}
                  </p>
                  {isParent && p.subscriptionId && p.subscriptionStatus !== "pending" && (
                    <button type="button" disabled={renew.isPending} onClick={() => renew.mutate(p.subscriptionId)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: 0, background: "#25476a", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      <FiRepeat size={13} /> {renew.isPending ? "Renewing…" : "Renew"}
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
