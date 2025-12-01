import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"




const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",

        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        nohover:
      "bg-transparent text-foreground cursor-pointer transition-none hover:bg-transparent hover:text-foreground",
        rgb: "relative text-white font-semibold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-[length:300%_300%] animate-rgbGradient hover:scale-105 transition-all duration-300 rounded-md shadow-md hover:shadow-lg",
      
        rgbAura:
      "relative z-0 text-white font-semibold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 " +
      "bg-[length:300%_300%] animate-rgbGradient rounded-md shadow-lg " +
      "hover:scale-105 transition-all duration-300 overflow-hidden " +
      "before:absolute before:inset-0 before:-z-10 before:rounded-md before:blur-xl " +
      "before:bg-gradient-to-r before:from-pink-500 before:via-purple-500 before:to-blue-500 " +
      "before:bg-[length:300%_300%] before:animate-rgbGradient",
      
        rgbBorder:
      "relative z-0 text-white font-semibold bg-black rounded-md px-4 py-2 " +
      "hover:scale-105 transition-all duration-300 " +
      "before:absolute before:inset-0 before:rounded-md before:p-[2px] before:bg-gradient-to-r " +
      "before:from-pink-500 before:via-purple-500 before:to-blue-500 " +
      "before:bg-[length:300%_300%] before:animate-rgbGradient before:-z-10 " +
      "after:absolute after:inset-[2px] after:rounded-md after:bg-black after:-z-10 " +
      "shadow-[0_0_20px_rgba(147,51,234,0.5)] hover:shadow-[0_0_25px_rgba(147,51,234,0.7)] overflow-hidden",

      rgbGlow:
      "relative z-0 text-white font-bold tracking-wide uppercase px-6 py-3 rounded-md " +
      "bg-black overflow-hidden transition-transform duration-300 hover:scale-110 " +
      "before:absolute before:inset-0 before:rounded-md before:p-[3px] " +
      "before:bg-gradient-to-r before:from-pink-500 before:via-purple-500 before:to-blue-500 " +
      "before:bg-[length:300%_300%] before:animate-rgbGradient " +
      "before:shadow-[0_0_25px_8px_rgba(168,85,247,0.7)] before:blur-[1px] before:-z-10 " +
      "after:absolute after:inset-[3px] after:rounded-md after:bg-black after:-z-10 " +
      "shadow-[0_0_35px_10px_rgba(168,85,247,0.6)] animate-glowPulse hover:shadow-[0_0_45px_15px_rgba(168,85,247,0.8)]",

      glow85:
  "button-85",

      
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
