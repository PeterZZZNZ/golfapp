import * as React from "react";
import { cn } from "@/lib/util";

export function EmptyState({
  title,
  description,
  action,
  className,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "card p-10 flex flex-col items-center text-center gap-3",
        className
      )}
    >
      {icon ? <div className="text-[var(--muted-2)]">{icon}</div> : null}
      <div className="h2">{title}</div>
      {description ? (
        <div className="muted text-sm max-w-md">{description}</div>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
