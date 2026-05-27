type TokenBadgeProps = {
  balance: number;
  allocated: number;
};

export default function TokenBadge({ balance, allocated }: TokenBadgeProps) {
  const ratio = allocated > 0 ? balance / allocated : 0;
  const style =
    ratio > 0.5
      ? "bg-[#f7ffe0] text-[#222222] border border-[#d9f36e]"
      : ratio > 0.1
      ? "bg-[#fff8e1] text-[#b45309] border border-[#fcd34d]"
      : "bg-red-50 text-red-700 border border-red-200";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
      {balance}
    </span>
  );
}
