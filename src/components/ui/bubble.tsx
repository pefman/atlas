import * as React from "react"

import { cn } from "@/lib/utils"

function Bubble({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble"
      className={cn("flex w-full", className)}
      {...props}
    />
  )
}

function BubbleContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-content"
      className={cn(
        "max-w-[85%] rounded-2xl border bg-card px-3 py-2 text-sm leading-relaxed shadow-xs",
        className
      )}
      {...props}
    />
  )
}

export { Bubble, BubbleContent }
