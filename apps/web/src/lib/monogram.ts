/** Up to two initials from a name: "Иван Петров" -> "ИП", "Marketing" -> "M", "" -> "?". */
export function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

const PALETTE: Array<{ bg: string; fg: string }> = [
  { bg: "#fee2e2", fg: "#991b1b" }, // red
  { bg: "#ffedd5", fg: "#9a3412" }, // orange
  { bg: "#fef3c7", fg: "#92400e" }, // amber
  { bg: "#fef9c3", fg: "#854d0e" }, // yellow
  { bg: "#ecfccb", fg: "#3f6212" }, // lime
  { bg: "#d1fae5", fg: "#065f46" }, // emerald
  { bg: "#cffafe", fg: "#155e75" }, // cyan
  { bg: "#dbeafe", fg: "#1e40af" }, // blue
  { bg: "#e0e7ff", fg: "#3730a3" }, // indigo
  { bg: "#ede9fe", fg: "#5b21b6" }, // violet
  { bg: "#fae8ff", fg: "#86198f" }, // fuchsia
  { bg: "#fce7f3", fg: "#9d174d" }, // pink
];

/** FNV-1a hash over the id, mapped into a fixed 12-hue palette. Deterministic per id, never per name — two orgs named "Marketing" must still look different. */
export function colorFromId(id: string): { bg: string; fg: string } {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index]!;
}
