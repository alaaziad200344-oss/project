interface StatusBadgeProps {
  status: "pending" | "confirmed" | "completed" | "cancelled";
}

const map: Record<string, { label: string; class: string }> = {
  pending: { label: "قيد الانتظار", class: "bg-amber-100 text-amber-700" },
  confirmed: { label: "مؤكد", class: "bg-teal-100 text-teal-700" },
  completed: { label: "مكتمل", class: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "ملغي", class: "bg-rose-100 text-rose-700" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const s = map[status] || map.pending;
  return <span className={`chip ${s.class}`}>{s.label}</span>;
}
