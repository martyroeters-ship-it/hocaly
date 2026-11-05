"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { StoriesView } from "@/components/stories/stories-view"
import { dailyStudyPrefsFromQuery } from "@/lib/daily-study"

function StoriesInner() {
  const params = useSearchParams()
  return <StoriesView session={dailyStudyPrefsFromQuery(params)} />
}

export default function StoriesPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading stories…</p>}>
      <StoriesInner />
    </Suspense>
  )
}
