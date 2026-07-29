// A stream is just another Class row for the same grade — this is the one place that decides
// how to show that to a person, so "Grade 6" vs "Grade 6 · Blue" stays consistent everywhere.
export function formatClassName(cls) {
  if (!cls) return "";
  return cls.streamName ? `${cls.gradeName} · ${cls.streamName}` : cls.gradeName;
}
