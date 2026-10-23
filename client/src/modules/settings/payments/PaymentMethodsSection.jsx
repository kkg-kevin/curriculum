import { useEffect, useState } from "react";
import { Toggle } from "../../../components/ui/EmailNotificationSettings";
import { usePaymentOptions, useSavePaymentOptions } from "./paymentSettingsApi";
import { SettingsSection, Field, FieldGrid, FooterNote, LoadState } from "../components/SettingsLayout";

const EMPTY = {
  paybill: { enabled: false, number: "", accountName: "" },
  sendMoney: { enabled: false, phone: "", name: "" },
  bank: { enabled: false, bankName: "", accountName: "", accountNumber: "", branch: "", instructions: "" },
  cheque: { enabled: false, payableTo: "", instructions: "" },
  cash: { enabled: false, instructions: "" },
  pickup: { enabled: true, note: "" },
  delivery: { enabled: false, fee: 0, note: "" },
};

function Text({ id, label, value, onChange, placeholder, maxLength = 100, multiline = false }) {
  return (
    <Field label={label} htmlFor={id}>
      {multiline
        ? <textarea id={id} className="stg-input" rows={2} value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ resize: "vertical" }} />
        : <input id={id} className="stg-input" value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />}
    </Field>
  );
}

// One way of paying: its name and a line on how it works, a switch, and — while it's on — its
// details underneath.
function Method({ title, description, on, locked, onToggle, children, last }) {
  return (
    <div style={{ padding: "14px 0", borderBottom: last ? "none" : "1px solid #F3F4F6" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: on ? "#111827" : "#6B7280" }}>{title}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6B7280", lineHeight: 1.45 }}>{description}</p>
        </div>
        <Toggle checked={on} disabled={locked} onChange={onToggle} label={title} />
      </div>
      {on && children && <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>}
    </div>
  );
}

// Settings → Payments → How families can pay: the methods offered on the website's Payment step
// at the end of a Home Learning, Tech Club or Bootcamp sign-up (server: payments/payment-options.js).
// Families who pay by any of them say "I've paid", and staff confirm it in Billing → To confirm.
export default function PaymentMethodsSection() {
  const { data, isLoading, isError } = usePaymentOptions();
  const { mutate: save, isPending: saving } = useSavePaymentOptions();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (data?.options) setForm({ ...EMPTY, ...data.options });
  }, [data]);

  const set = (method, field) => (value) => setForm((f) => ({ ...f, [method]: { ...f[method], [field]: value } }));
  const anyOn = Object.values(form).some((m) => m.enabled) || Boolean(data?.mpesaLive);
  const dirty = Boolean(data?.options) && JSON.stringify(form) !== JSON.stringify({ ...EMPTY, ...data.options });

  if (isLoading || isError || !data) return <LoadState isLoading={isLoading} isError={isError || (!isLoading && !data)} what="How families can pay" />;

  const saveButton = <button type="submit" className="stg-btn-primary" disabled={!dirty || saving}>{saving ? "Saving…" : "Save"}</button>;

  return (
    <>
    <SettingsSection
      as="form"
      onSubmit={(e) => { e.preventDefault(); save(form); }}
      title="How families can pay"
      description="The choices shown after a website sign-up. Families tell us once they've paid; you confirm it in Billing → To confirm."
      footer={(
        <>
          {saveButton}
          {!anyOn && <FooterNote>With everything off, families only see their invoice.</FooterNote>}
        </>
      )}
    >
      <div>
        <Method
          title="M-Pesa Paybill"
          description={data.mpesaLive
            ? `Paybill ${data.mpesaLive.paybill}, from the M-Pesa connection below — payments are matched automatically.`
            : "Families pay with the invoice's account number and type in their M-Pesa code."}
          on={form.paybill.enabled || Boolean(data.mpesaLive)}
          locked={Boolean(data.mpesaLive)}
          onToggle={set("paybill", "enabled")}
        >
          {!data.mpesaLive && (
            <FieldGrid>
              <Text id="po-paybill" label="Paybill number" value={form.paybill.number} onChange={(v) => set("paybill", "number")(v.replace(/\D/g, ""))} placeholder="e.g. 522522" maxLength={10} />
              <Text id="po-paybill-name" label="Name payers see" value={form.paybill.accountName} onChange={set("paybill", "accountName")} placeholder="e.g. Digifunzi" />
            </FieldGrid>
          )}
        </Method>

        <Method title="M-Pesa Send Money" description="Families send to a phone number and type in the M-Pesa code." on={form.sendMoney.enabled} onToggle={set("sendMoney", "enabled")}>
          <FieldGrid>
            <Text id="po-sm-phone" label="Phone number" value={form.sendMoney.phone} onChange={set("sendMoney", "phone")} placeholder="e.g. 0712 345 678" maxLength={20} />
            <Text id="po-sm-name" label="Registered name" value={form.sendMoney.name} onChange={set("sendMoney", "name")} placeholder="As M-Pesa shows it" />
          </FieldGrid>
        </Method>

        <Method title="Bank transfer" description="Families use the invoice number as the reference and give us theirs." on={form.bank.enabled} onToggle={set("bank", "enabled")}>
          <FieldGrid>
            <Text id="po-bank" label="Bank" value={form.bank.bankName} onChange={set("bank", "bankName")} placeholder="e.g. KCB" />
            <Text id="po-bank-branch" label="Branch" value={form.bank.branch} onChange={set("bank", "branch")} />
            <Text id="po-bank-name" label="Account name" value={form.bank.accountName} onChange={set("bank", "accountName")} maxLength={150} />
            <Text id="po-bank-number" label="Account number" value={form.bank.accountNumber} onChange={set("bank", "accountNumber")} maxLength={40} />
          </FieldGrid>
          <Text id="po-bank-notes" label="Other details (optional)" value={form.bank.instructions} onChange={set("bank", "instructions")} placeholder="e.g. SWIFT code" maxLength={300} multiline />
        </Method>

        <Method title="Cheque" description="Families give us the cheque number. Confirm it once it clears." on={form.cheque.enabled} onToggle={set("cheque", "enabled")}>
          <FieldGrid>
            <Text id="po-cheque" label="Payable to" value={form.cheque.payableTo} onChange={set("cheque", "payableTo")} maxLength={150} />
          </FieldGrid>
          <Text id="po-cheque-notes" label="Where to drop it off (optional)" value={form.cheque.instructions} onChange={set("cheque", "instructions")} placeholder="e.g. Front desk of your learning hub" maxLength={300} multiline />
        </Method>

        <Method title="Cash" description="Families tell us cash is coming. Confirm it once received." on={form.cash.enabled} onToggle={set("cash", "enabled")} last>
          <Text id="po-cash" label="Where to pay (optional)" value={form.cash.instructions} onChange={set("cash", "instructions")} placeholder="e.g. At your learning hub — ask for a receipt" maxLength={300} multiline />
        </Method>
      </div>
    </SettingsSection>

    <SettingsSection
      as="form"
      onSubmit={(e) => { e.preventDefault(); save(form); }}
      title="Delivery & pickup (website store)"
      description="How a Store order reaches the family. Orders with only project access need neither."
      footer={saveButton}
    >
      <div>
        <Method title="Pickup at a hub" description="Families collect their order from one of your active, in-person learning hubs. You mark it ready in Billing → Orders." on={form.pickup.enabled} onToggle={set("pickup", "enabled")}>
          <Text id="po-pickup-note" label="Pickup note (optional)" value={form.pickup.note} onChange={set("pickup", "note")} placeholder="e.g. Collect from the front desk, Mon–Sat 9am–5pm" maxLength={300} multiline />
        </Method>
        <Method title="Delivery" description="Delivered for a flat fee added to the order. You mark it dispatched in Billing → Orders." on={form.delivery.enabled} onToggle={set("delivery", "enabled")} last>
          <FieldGrid>
            <Field label="Delivery fee (KES)" htmlFor="po-delivery-fee" note={Number(form.delivery.fee) > 0 ? null : "0 means free delivery."}>
              <input id="po-delivery-fee" className="stg-input" type="number" min="0" step="1" value={form.delivery.fee} onChange={(e) => set("delivery", "fee")(e.target.value === "" ? 0 : Number(e.target.value))} />
            </Field>
          </FieldGrid>
          <Text id="po-delivery-note" label="Delivery note (optional)" value={form.delivery.note} onChange={set("delivery", "note")} placeholder="e.g. Nairobi and Kiambu only, 2–3 working days" maxLength={300} multiline />
        </Method>
      </div>
      {!form.pickup.enabled && !form.delivery.enabled && <FooterNote>With both off, the website can only sell project access.</FooterNote>}
    </SettingsSection>
    </>
  );
}
