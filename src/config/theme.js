/**
 * Theme constants - centralized colors and styling
 * Used across dashboards, analytics, edit pages, and components
 *
 * Usage:
 * - Inline style: style={{ color: COLORS.primary }}
 * - Tailwind: className={`bg-[${COLORS.primary}]`} or use TAILWIND_CLASSES
 */

export const COLORS = {
  /** Primary brand color - buttons, links, active states */
  primary: 'rgb(75,99,226)',
  /** Primary dark - hover, emphasis */
  primaryDark: 'rgb(79, 70, 229)',
  /** Primary hover - darker for button hover */
  primaryHover: 'rgb(60,80,200)',
  /** Primary gradient end */
  primaryGradientEnd: 'rgb(40,62,173)',
  /** Primary with opacity for backgrounds */
  primaryLight: 'rgba(75, 99, 226, 0.1)',
  /**
   * Edit Deal–style indigo: icon halo, in-form Card headers (bg + white text)
   * Pairs with primary (violet CTA) for a consistent “edit” chrome.
   */
  editAccent: 'rgb(59,76,164)',
};

/** Tailwind arbitrary value classes - use in className */
export const TAILWIND_CLASSES = {
  primary: 'bg-[rgb(75,99,226)]',
  primaryHover: 'hover:bg-[rgb(60,80,200)]',
  primaryText: 'text-[rgb(75,99,226)]',
  primaryDarkText: 'text-[rgb(79,70,229)]',
  primaryBgLight: 'bg-[rgb(75,99,226)]/10',
  /** Save Changes on edit / create entity pages (violet CTA, same family as Deal sidebar selection) */
  editPrimaryButton:
    'w-full bg-[rgb(75,99,226)] hover:bg-[rgb(60,80,200)] text-white',
  /** Header icon square behind Building2 / Link2 / User, etc. */
  editIconBox: 'bg-[rgb(59,76,164)]/10 text-[rgb(59,76,164)]',
  /** “General Parameters” card title strip — soft violet like Edit Deal banner */
  editSidebarSectionHeader:
    'border-b border-[rgb(220,227,255)] bg-gradient-to-r from-[rgb(244,246,255)]/80 to-white',
  editSidebarSectionTitle: 'text-sm font-semibold text-[rgb(59,76,164)]',
  /** Outline cancel aligned with edit chrome */
  editCancelButton:
    'w-full border-slate-200 hover:bg-[rgb(244,246,255)] hover:border-[rgb(75,99,226)]/30 hover:text-[rgb(75,99,226)]',
  /**
   * Multi-select toggle chip (Edit Deal Device/Browser style): blue selected, white + border unselected.
   * Use with `toggleChipClassName()` in `@/lib/toggleChip`.
   */
  toggleChip:
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(75,99,226)]/35 focus-visible:ring-offset-2',
  toggleChipActive: 'bg-[rgb(75,99,226)] text-white border-transparent shadow-sm',
  toggleChipInactive: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
  /**
   * Uppercase section caption for form blocks (same family as Inventory Directness on Edit Company).
   * Use on `<Label>` — merges with default Label styles via `cn`.
   */
  formSectionLabel: 'text-xs font-medium uppercase tracking-wide text-slate-600',
};
