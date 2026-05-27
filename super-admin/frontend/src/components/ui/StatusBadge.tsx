type StatusValue = "ACTIVE" | "INACTIVE" | "PENDING" | string;

export default function StatusBadge({ status }: { status: StatusValue }) {
  const tone =
    status === "ACTIVE"
      ? "bg-[#f7ffe0] text-[#222222] border-[#d9f36e]"
      : status === "INACTIVE"
      ? "bg-[#f3f3f3] text-[#555555] border-[#e8e8e8]"
      : "bg-[#fff8e1] text-[#b45309] border-[#fcd34d]";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}
