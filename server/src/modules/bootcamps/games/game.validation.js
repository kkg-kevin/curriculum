const { z } = require("zod");

// A game in the Events games library (chess, Monopoly, a treasure hunt…) — picked into bootcamps
// and shown on the public bootcamp page. `icon` is the built-in picture every game has — a key
// into the icon set both apps carry (gameIcons.js; an unknown key falls back to the default
// there) — and `image` is an optional photo that takes its place.
const gameFields = z.object({
  name:        z.string().trim().min(1, "Give the game a name").max(80),
  // One or two lines on what the children actually do.
  description: z.string().trim().max(300).optional().default(""),
  // What playing it builds — short tags ("Strategy", "Teamwork") shown on the back of the card.
  skills:      z.array(z.string().trim().min(1).max(30)).max(6).optional().default([]),
  icon:        z.string().trim().max(40).regex(/^[a-z0-9-]*$/, "Invalid icon").optional().default(""),
  color:       z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid colour").optional().default("#25476a"),
  // A stored "/uploads/x.png" path or an absolute URL — same shape as bootcamp.coverImage.
  image:       z.string().max(500).optional().nullable(),
});

module.exports = {
  createGameSchema: gameFields,
  updateGameSchema: gameFields.partial(),
};
