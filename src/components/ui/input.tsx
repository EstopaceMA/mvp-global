import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-[2px] border border-input bg-background px-3 py-1 font-mono text-base transition-colors duration-150 outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-11 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-[13px]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
