"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { ListenView } from "@/components/listen/listen-view"
import { BackToTestsLink } from "@/components/tests/tests-hub"
import { dailyStudyPrefsFromQuery } from "@/lib/daily-study"

function ListenInner() {
  const params = useSearchParams()
  const ids = params.get("ids")?.split(",").filter(Boolean)
  const session = dailyStudyPrefsFromQuery(params)
  return (
    <div>
      <BackToTestsLink />
      <ListenView initialIds={ids} session={ids?.length ? null : session} />
    </div>
  )
}

export default function ListenPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading listening…</p>}>
      <ListenInner />
    </Suspense>
  )
}
