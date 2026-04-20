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
        "panel-gradient panel-elev border border-border rounded-[6px] overflow-hidden",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between px-4 py-[10px] border-b border-border">
          <div>
            {title && (
              <h2 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-fg">
                {title}
              </h2>
            )}
            {subtitle && (
              <div className="text-[10px] text-muted tracking-wide mt-[2px]">{subtitle}</div>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padding ? "p-4" : ""}>{children}</div>
    </section>
  );
}
