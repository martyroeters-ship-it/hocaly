import { Suspense } from "react"
import { GrammarView } from "@/components/grammar/grammar-view"

export default function GrammarPage() {
  return (
    <Suspense fallback={<p className="p-6 text-muted-foreground">Loading grammar…</p>}>
      <GrammarView />
    </Suspense>
  )
}
