type StatCardProps = {
  label: string;
  value: string | number;
  icon?: string;
  variant?: "default" | "warning" | "danger";
};

const variantClass: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "border-[var(--color-border)]",
  warning: "border-[var(--color-warning)]/40",
  danger: "border-[var(--color-danger)]/40",
};

export default function StatCard({ label, value, icon, variant = "default" }: StatCardProps) {
  return (
    <div className={`rounded-xl border bg-[var(--color-surface)] p-4 ${variantClass[variant]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-secondary)]">{label}</p>
        {icon ? <span className="text-xs text-[var(--color-text-secondary)]">{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
