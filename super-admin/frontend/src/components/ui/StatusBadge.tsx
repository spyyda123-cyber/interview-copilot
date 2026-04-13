type StatusValue = "ACTIVE" | "INACTIVE" | "PENDING" | string;

export default function StatusBadge({ status }: { status: StatusValue }) {
  const tone =
    status === "ACTIVE"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "INACTIVE"
        ? "bg-slate-100 text-slate-700 border-slate-300"
        : "bg-amber-50 text-amber-700 border-amber-200";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>{status}</span>;
}
