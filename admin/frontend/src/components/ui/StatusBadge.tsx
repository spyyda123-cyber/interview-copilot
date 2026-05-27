type Status = "ACTIVE" | "INACTIVE" | "PENDING";

export default function StatusBadge({ status }: { status: Status | string }) {
  const normalized = status.toUpperCase() as Status;
  const style =
    normalized === "ACTIVE"
      ? "bg-[#f7ffe0] text-[#222222] border-[#d9f36e]"
      : normalized === "INACTIVE"
      ? "bg-[#f3f3f3] text-[#555555] border-[#e8e8e8]"
      : "bg-[#fff8e1] text-[#b45309] border-[#fcd34d]";

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${style}`}>
      {normalized}
    </span>
  );
}
