import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: string;
};

export default function StatCard({ label, value, icon, trend }: StatCardProps) {
  return (
    <div className="rounded-xl border border-[#e8e8e8] bg-white p-5 flex flex-col justify-between h-[120px]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold tracking-[0.1em] text-[#888888] uppercase">{label}</p>
        {icon ? <div className="text-[#d9f36e]">{icon}</div> : null}
      </div>
      <div>
        <p className="text-3xl font-bold text-[#222222] leading-none mb-1">{value}</p>
        {trend ? <p className="text-xs text-[#888888]">{trend}</p> : null}
      </div>
    </div>
  );
}
