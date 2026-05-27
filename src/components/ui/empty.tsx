import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Empty({
  title,
  desc,
  icon,
  action,
  className,
}: {
  title: string;
  desc?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-center",
        className
      )}
    >
      {icon && <div className="text-muted-foreground/60">{icon}</div>}
      <div className="font-medium">{title}</div>
      {desc && <div className="text-sm text-muted-foreground max-w-md">{desc}</div>}
      {action}
    </div>
  );
}
