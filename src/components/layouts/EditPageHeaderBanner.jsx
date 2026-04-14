/* eslint-disable react/prop-types -- documented via JSDoc at call sites */
import { cn } from "@/lib/utils";
import { TAILWIND_CLASSES } from "@/config/theme";

/**
 * Gradient header used across edit / create entity pages (Deal, User Sync, User, etc.).
 */
export function EditPageHeaderBanner({
  icon,
  title,
  subtitle = "Edit configuration",
  /** Shown as native tooltip on the title when provided */
  titleTooltip,
  /** Right side of the top row (badges, toggles) */
  trailing = null,
  /** Extra block below the main row (metadata grid, etc.) */
  children,
  className,
}) {
  return (
    <div className={cn("mb-6", className)}>
      <div className="bg-gradient-to-r from-white via-[rgb(244,246,255)] to-white border border-[rgb(220,227,255)] shadow-sm rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            {icon != null && (
              <div
                className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
                  TAILWIND_CLASSES.editIconBox
                )}
              >
                {icon}
              </div>
            )}
            <div className="space-y-1 min-w-0">
              <h1
                className="text-2xl font-semibold text-slate-900 leading-tight truncate"
                title={titleTooltip ?? (typeof title === "string" ? title : undefined)}
              >
                {title}
              </h1>
              {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
            </div>
          </div>
          {trailing ? <div className="flex flex-wrap items-center gap-3 shrink-0">{trailing}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export default EditPageHeaderBanner;
