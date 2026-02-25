import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono tracking-widest uppercase text-xs transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-30 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-[#2560E0] text-white border border-[#2560E0] hover:bg-[#1A4FC4] hover:border-[#1A4FC4] px-10 py-[0.875rem]",
        ghost:
          "border border-black/12 text-black/60 bg-transparent hover:text-[#2560E0] hover:border-[#2560E0]/25 hover:bg-[#2560E0]/5 px-5 py-2",
        outline:
          "relative overflow-hidden border border-black/22 text-black/85 bg-transparent hover:text-white hover:border-[#2560E0] px-10 py-[0.875rem] group",
        secondary:
          "bg-[#EDF3FF] text-[#2560E0] border border-[#2560E0]/15 hover:bg-[#dce8ff] px-5 py-2",
        destructive:
          "bg-red-500 text-white border border-red-500 hover:bg-red-600 px-5 py-2",
        link: "text-[#2560E0] underline-offset-4 hover:underline p-0",
      },
      size: {
        default: "text-xs",
        sm: "text-[0.65rem] px-4 py-1.5",
        lg: "text-sm px-12 py-4",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {variant === "outline" ? (
          <>
            <span className="absolute inset-0 bg-[#2560E0] -translate-x-full group-hover:translate-x-0 transition-transform duration-[380ms] ease-[cubic-bezier(0.16,1,0.3,1)]" />
            <span className="relative z-10 flex items-center gap-3">{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
