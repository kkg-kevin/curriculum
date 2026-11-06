// A class's name as people should see it: its grade, plus its stream when it has one — "Grade 4 ·
// Blue". Two classes of one grade at a hub are told apart only by their stream, and a Home
// Learning class (one per child) carries the child's name as its stream ("Crib · Derrick Maina"),
// so the grade alone would show several identical "Crib" buttons.
export function classLabel(cls, fallback = "Class") {
  if (!cls) return fallback;
  const base = cls.gradeName || cls.name || fallback;
  const stream = String(cls.streamName || "").trim().replace(/\s+/g, " ");
  return stream ? `${base} · ${stream}` : base;
}
