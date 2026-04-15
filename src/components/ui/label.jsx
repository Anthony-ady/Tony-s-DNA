import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"
import { TAILWIND_CLASSES } from "@/config/theme"

const labelVariants = cva(
  "leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
  {
    variants: {
      variant: {
        /** App-wide form / field caption — small caps, slate (see `TAILWIND_CLASSES.formSectionLabel`) */
        default: TAILWIND_CLASSES.formSectionLabel,
        /** Alias — same as default */
        section: TAILWIND_CLASSES.formSectionLabel,
        /** Sentence-case (e.g. login email/password) */
        body: "text-sm font-medium normal-case tracking-normal text-slate-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Label = React.forwardRef(({ className, variant, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants({ variant }), className)} {...props} />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
