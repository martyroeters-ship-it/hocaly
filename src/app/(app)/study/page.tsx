import { Suspense } from "react"
import { StudyToday } from "@/components/study/study-today"

export default function StudyPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading today’s queue…</p>}>
      <StudyToday />
    </Suspense>
  )
}
