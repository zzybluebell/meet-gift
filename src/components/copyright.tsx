import { cn } from "@/lib/utils";

export function Copyright({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "text-center text-[11px] text-muted-foreground py-5 px-4 leading-relaxed",
        className
      )}
    >
      © 2026 Zhang Zhiyao · All rights reserved ·{" "}
      <a
        href="mailto:zhang_zhiyao@outlook.com"
        className="hover:underline hover:text-foreground transition-colors"
      >
        zhang_zhiyao@outlook.com
      </a>
    </footer>
  );
}
