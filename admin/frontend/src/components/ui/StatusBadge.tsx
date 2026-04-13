type Status = "ACTIVE" | "INACTIVE" | "PENDING";

export default function StatusBadge({ status }: { status: Status | string }) {
  const normalized = status.toUpperCase() as Status;
  const style =
    normalized === "ACTIVE"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : normalized === "INACTIVE"
      ? "bg-slate-100 text-slate-700 border-slate-300"
      : "bg-amber-50 text-amber-700 border-amber-200";

  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${style}`}>{normalized}</span>;
}
