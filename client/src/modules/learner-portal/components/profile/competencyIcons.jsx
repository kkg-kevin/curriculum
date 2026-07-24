import { FiAward, FiBarChart2, FiCompass, FiCpu, FiMonitor, FiShield, FiTarget, FiUsers, FiZap } from "react-icons/fi";

const ICON_RULES = [
  { keywords: ["computational", "programming", "coding"], Icon: FiCpu },
  { keywords: ["critical", "problem"], Icon: FiTarget },
  { keywords: ["creativ", "innovat"], Icon: FiZap },
  { keywords: ["digital literacy", "digital creativity"], Icon: FiMonitor },
  { keywords: ["data"], Icon: FiBarChart2 },
  { keywords: ["collaborat", "communicat"], Icon: FiUsers },
  { keywords: ["ethic", "citizenship"], Icon: FiShield },
  { keywords: ["self-direct", "learning to learn", "self direct"], Icon: FiCompass },
];

export function iconFor(name = "") {
  const lower = name.toLowerCase();
  const match = ICON_RULES.find((r) => r.keywords.some((k) => lower.includes(k)));
  return match?.Icon || FiAward;
}
