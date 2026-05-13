export type StudentType = "JHS" | "SHS" | "UNI" | "POSTGRAD" | "PRO" | "STUDENT";

export function studentTypeFromLevel(level?: string | null): { type: StudentType; label: string; color: string } {
  if (!level) return { type: "STUDENT", label: "STUDENT", color: "#94a3b8" };
  const l = level.toUpperCase();
  if (l.startsWith("JHS")) return { type: "JHS", label: "JHS STUDENT", color: "#22c55e" };
  if (l.startsWith("SHS")) return { type: "SHS", label: "SHS STUDENT", color: "#14b8a6" };
  if (l.includes("UNIVERSITY") || /^L\d/.test(l) || l.includes("UNIVERSITY_L"))
    return { type: "UNI", label: "UNIVERSITY STUDENT", color: "#3b82f6" };
  if (l.includes("POSTGRAD")) return { type: "POSTGRAD", label: "POSTGRADUATE", color: "#8b5cf6" };
  if (l.includes("PROFESSIONAL")) return { type: "PRO", label: "PROFESSIONAL", color: "#F4A300" };
  return { type: "STUDENT", label: "STUDENT", color: "#94a3b8" };
}

export function StudentBadge({ level }: { level?: string | null }) {
  const { label, color } = studentTypeFromLevel(level);
  return (
    <span
      className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
      style={{
        backgroundColor: `${color}33`,
        color,
      }}
    >
      {label}
    </span>
  );
}
