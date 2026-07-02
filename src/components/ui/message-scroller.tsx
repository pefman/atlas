import * as React from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

function MessageScroller({ className, children }: React.ComponentProps<"div">) {
  return (
    <ScrollArea className={cn("h-[420px] rounded-lg border p-3", className)}>
      <div className="space-y-3">{children}</div>
    </ScrollArea>
  )
}

export { MessageScroller }
