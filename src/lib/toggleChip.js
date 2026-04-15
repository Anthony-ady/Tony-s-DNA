import { cn } from "@/lib/utils";
import { TAILWIND_CLASSES } from "@/config/theme";

/**
 * Shared “Edit Deal” chip style: primary blue when active, white + slate border when not.
 * Use on <button type="button"> for multi-select toggles (devices, browsers, etc.).
 */
export function toggleChipClassName(isActive, className) {
  return cn(
    TAILWIND_CLASSES.toggleChip,
    isActive ? TAILWIND_CLASSES.toggleChipActive : TAILWIND_CLASSES.toggleChipInactive,
    className
  );
}
