type StatCardProps = {
  label: string;
  value: string | number;
  icon?: string;
  variant?: "default" | "warning" | "danger";
};

const variantStyles: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "border-[#e8e8e8]",
  warning: "border-[#f59e0b]/40",
  danger: "border-[#ef4444]/40",
};

export default function StatCard({ label, value, icon, variant = "default" }: StatCardProps) {
  return (
    <div className={`rounded-xl border bg-white p-5 flex flex-col justify-between h-[120px] ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold tracking-[0.1em] text-[#888888] uppercase">{label}</p>
        {icon ? <span className="text-xs text-[#888888]">{icon}</span> : null}
      </div>
      <div>
        <p className="text-3xl font-bold text-[#222222] leading-none mb-1">{value}</p>
      </div>
    </div>
  );
}
