// The system's colours, in one place — navy, mid blue, sky blue and gold (the logo's), with neutral
// greys for text and lines. Status and emphasis come from these too: a "good" state is mid blue, a
// "waiting / needs you" one gold, a neutral one grey. Red is only for destructive actions and real
// errors. New screens take their colours from here instead of picking their own.

export const BRAND = {
  navy: "#25476a",
  navyDeep: "#1a3550",
  mid: "#2e7db5",
  sky: "#38aae1",
  gold: "#feb139",

  ink: "#111827",
  inkSoft: "#374151",
  muted: "#5B6475",
  faint: "#8C94A3",
  border: "#E5E7EB",
  line: "#EEF1F5",
  track: "#EEF0F4",
  surface: "#FFFFFF",
  canvas: "#F5F8FC",

  // Soft fills, each with the text colour that reads on it.
  skyTint: "#EAF6FD", skyBorder: "#BFE3F7", skyText: "#1F6F9E",
  goldTint: "#FFF5E1", goldBorder: "#FDD89A", goldText: "#7A4F00",
  navyTint: "#E6ECF3", navyBorder: "#A9BCD2",
  greyTint: "#F3F4F6", greyText: "#4B5563",

  danger: "#B91C1C", dangerTint: "#FEF2F2", dangerBorder: "#FECACA",
};

export const FONT = "Inter, sans-serif";

// The page header gradient every portal uses.
export const HERO_GRADIENT = `linear-gradient(135deg, ${BRAND.navyDeep} 0%, ${BRAND.navy} 40%, ${BRAND.mid} 75%, ${BRAND.sky} 100%)`;

// A pill for a state: tone "good" (mid blue), "waiting" (gold), "info" (sky), "neutral" (grey),
// "strong" (navy), "danger" (red).
export const TONES = {
  good: { bg: BRAND.skyTint, color: BRAND.navy, border: BRAND.skyBorder },
  info: { bg: BRAND.skyTint, color: BRAND.skyText, border: BRAND.skyBorder },
  waiting: { bg: BRAND.goldTint, color: BRAND.goldText, border: BRAND.goldBorder },
  neutral: { bg: BRAND.greyTint, color: BRAND.greyText, border: BRAND.border },
  strong: { bg: BRAND.navyTint, color: BRAND.navy, border: BRAND.navyBorder },
  danger: { bg: BRAND.dangerTint, color: BRAND.danger, border: BRAND.dangerBorder },
};

export const pill = (tone = "neutral", extra = {}) => {
  const t = TONES[tone] || TONES.neutral;
  return { display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: t.bg, color: t.color, border: `1px solid ${t.border}`, fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap", ...extra };
};

export const card = { background: BRAND.surface, borderRadius: 16, border: `1.5px solid ${BRAND.border}`, minWidth: 0 };

// The small uppercase heading on a card ("PARENT RATING").
export const cardHeading = { margin: 0, fontSize: 11, fontWeight: 800, color: BRAND.sky, textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 6 };
