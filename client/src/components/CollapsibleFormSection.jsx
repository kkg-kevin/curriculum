import { useState, useEffect, useRef } from "react";

// Hides an optional group of fields behind a "+ Label" toggle until clicked — used for
// less-common setup steps (portal logins, etc.) so a create/edit form leads with what most
// people actually need to fill in first, instead of every possible field expanded at once.
//
// `defaultOpen` isn't just a one-time initial value: on an edit form, the real data (e.g. an
// already-set username) often arrives via `reset()` a render or two after this component's
// first mount (the form mounts once with empty values, then react-query's data resolves and
// reset() populates it) — a plain `useState(defaultOpen)` would miss that and stay collapsed
// forever, hiding data that already exists. This re-opens automatically whenever `defaultOpen`
// turns true, but only if the user hasn't already made their own explicit choice — so it never
// fights someone who deliberately collapsed a section back down.
export default function CollapsibleFormSection({ label, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const userToggled = useRef(false);

  useEffect(() => {
    if (defaultOpen && !userToggled.current) setOpen(true);
  }, [defaultOpen]);

  const handleOpen = () => {
    userToggled.current = true;
    setOpen(true);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        style={{ alignSelf: "flex-start", padding: 0, background: "none", border: "none", color: "#25476a", fontWeight: "600", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
      >
        + {label}
      </button>
    );
  }

  return <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>{children}</div>;
}
