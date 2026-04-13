import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: string;
};

export default function StatCard({ label, value, icon, trend }: StatCardProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">{label}</p>
        {icon ? <div className="text-[var(--color-primary)]">{icon}</div> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{value}</p>
      {trend ? <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{trend}</p> : null}
    </div>
  );
}
