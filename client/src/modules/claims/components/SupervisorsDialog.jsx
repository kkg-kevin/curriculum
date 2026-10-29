import { Dialog } from "../shared";
import SupervisorsPanel from "./SupervisorsPanel";

// Supervisors from Billing → Educator Claims, for staff who manage claim approvals: they can't open
// Settings → People & sharing (owner only), where the owner manages supervisors.
export default function SupervisorsDialog({ onClose }) {
  return (
    <Dialog title="Supervisors" subtitle="Accounts that review the claims and QA visits of the educators assigned to them. Pick an educator's supervisor on the educator form." onClose={onClose} width={620}>
      <SupervisorsPanel />
    </Dialog>
  );
}
