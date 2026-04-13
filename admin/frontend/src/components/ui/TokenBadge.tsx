type TokenBadgeProps = {
  balance: number;
  allocated: number;
};

export default function TokenBadge({ balance, allocated }: TokenBadgeProps) {
  const ratio = allocated > 0 ? balance / allocated : 0;
  const style = ratio > 0.5 ? "bg-emerald-50 text-emerald-700" : ratio > 0.1 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";

  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${style}`}>{balance}</span>;
}
