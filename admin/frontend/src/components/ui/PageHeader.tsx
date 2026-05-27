import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e8e8e8] pb-4 mb-6">
      <div>
        <h1 className="text-3xl font-bold text-[#222222]">{title}</h1>
        {description ? <p className="mt-1 text-sm text-[#555555]">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
