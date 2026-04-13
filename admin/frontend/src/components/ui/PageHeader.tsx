import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-border)] pb-4">
      <div>
        <h1 className="text-3xl font-semibold text-[var(--color-text-primary)]">{title}</h1>
        {description ? <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
