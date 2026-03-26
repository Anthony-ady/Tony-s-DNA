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
};

/** Tailwind arbitrary value classes - use in className */
export const TAILWIND_CLASSES = {
  primary: 'bg-[rgb(75,99,226)]',
  primaryHover: 'hover:bg-[rgb(60,80,200)]',
  primaryText: 'text-[rgb(75,99,226)]',
  primaryDarkText: 'text-[rgb(79,70,229)]',
  primaryBgLight: 'bg-[rgb(75,99,226)]/10',
};
