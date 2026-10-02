// Well-known games offered as one-click suggestions when building the library (Events → Games)
// or choosing games on a bootcamp. Picking one adds it to the admin's own library, where it can
// be reworded like any other game — these are only a starting point, never shown on their own.
export const STARTER_GAMES = [
  { name: "Chess", icon: "chess-knight", color: "#25476a", description: "Two players, sixty-four squares. Plan ahead, protect your king and outthink your opponent.", skills: ["Strategy", "Patience", "Focus"] },
  { name: "Monopoly", icon: "property", color: "#D92D20", description: "Buy, build and trade your way round the board without going broke.", skills: ["Money sense", "Negotiation", "Decision making"] },
  { name: "Scrabble", icon: "letters", color: "#0E9384", description: "Build words from your letter tiles and chase the high-scoring squares.", skills: ["Vocabulary", "Spelling", "Quick thinking"] },
  { name: "Checkers", icon: "counters", color: "#B42318", description: "Jump, capture and crown your pieces before your opponent does.", skills: ["Planning", "Pattern spotting"] },
  { name: "Jenga", icon: "blocks", color: "#B54708", description: "Pull a block, stack it on top, and keep the tower standing.", skills: ["Steady hands", "Risk taking", "Focus"] },
  { name: "Uno", icon: "cards", color: "#F79009", description: "Match colours and numbers, play your specials and be first to empty your hand.", skills: ["Quick thinking", "Turn taking"] },
  { name: "Ludo", icon: "dice", color: "#7A5AF8", description: "Race all four of your pieces home before anyone else.", skills: ["Counting", "Sportsmanship"] },
  { name: "Snakes & Ladders", icon: "ladder", color: "#079455", description: "Climb the ladders, dodge the snakes and reach the top first.", skills: ["Counting", "Resilience"] },
  { name: "Rubik's Cube", icon: "cube", color: "#1570EF", description: "Twist and turn until every face is one colour.", skills: ["Problem solving", "Memory", "Persistence"] },
  { name: "Jigsaw Puzzles", icon: "puzzle", color: "#6938EF", description: "Piece a picture together as a team.", skills: ["Teamwork", "Attention to detail"] },
  { name: "Treasure Hunt", icon: "map", color: "#C4320A", description: "Crack the clues, follow the map and find the prize.", skills: ["Teamwork", "Problem solving", "Communication"] },
  { name: "Charades", icon: "masks", color: "#DD2590", description: "Act it out without a word while your team guesses.", skills: ["Confidence", "Creativity", "Teamwork"] },
];

// Tile colours offered when a game is created by hand (the icons come from gameIcons.js).
export const GAME_COLORS = ["#25476a", "#1570EF", "#0E9384", "#079455", "#F79009", "#D92D20", "#DD2590", "#7A5AF8"];

export const DEFAULT_GAME_COLOR = GAME_COLORS[0];
