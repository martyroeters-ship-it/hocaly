import { Suspense } from "react"
import { VocabularyWorkspace } from "@/components/vocabulary/vocabulary-workspace"

export default function VocabularyPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading vocabulary…</p>}>
      <VocabularyWorkspace />
    </Suspense>
  )
}
