import { Toaster as Sonner } from "sonner";

/**
 * Global toast host (Sonner). Used for non-blocking feedback (e.g. save OK/KO).
 * Positioned top-right; success/error styling via richColors.
 */
export function Toaster(props) {
  return (
    <Sonner
      theme="light"
      position="top-right"
      richColors
      closeButton
      offset={16}
      toastOptions={{
        duration: 4500,
        classNames: {
          toast:
            "group border shadow-md backdrop-blur-sm !right-4 !top-4 max-w-[min(100vw-2rem,22rem)]",
          title: "font-semibold text-sm",
          description: "text-xs opacity-90",
          success: "!bg-emerald-50 !text-emerald-950 !border-emerald-200",
          error: "!bg-red-50 !text-red-950 !border-red-200",
          warning: "!bg-amber-50 !text-amber-950 !border-amber-200",
        },
      }}
      {...props}
    />
  );
}
