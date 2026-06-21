export const SUPPLEMENTARY_TYPES = ["complementary", "substitutional"];

export const SUPPLEMENTARY_TYPE_META = {
  complementary: {
    label: "Complementary",
    description:
      "Adds courses that run alongside the base curriculum in the selected term. Students take both the base courses and these supplementary courses at the same time.",
    color: "#16A34A",
    bg: "#F0FDF4",
    border: "#BBF7D0",
  },
  substitutional: {
    label: "Substitutional",
    description:
      "Replaces the base curriculum courses for the selected term. Students follow only these courses instead of the base curriculum courses for that term.",
    color: "#D97706",
    bg: "#FFFBEB",
    border: "#FDE68A",
  },
};
