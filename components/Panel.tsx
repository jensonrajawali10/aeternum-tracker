import type { ReactNode } from "react";
import { clsx } from "@/lib/format";

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  padding = true,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <section
      className={clsx(
        "ae-panel bg-panel border border-border rounded-[10px] overflow-hidden",
        className,
      )}
    >
      {(title || actions) && (
        <header className="ae-panel-header flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            {title && (
              <h2 className="ae-h2 text-[14px] font-medium tracking-[-0.01em] text-fg">
                {title}
              </h2>
            )}
            {subtitle && (
              <div className="ae-h2-sub text-[11px] text-muted mt-[2px]">{subtitle}</div>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padding ? "ae-panel-body p-4" : ""}>{children}</div>
    </section>
  );
}
