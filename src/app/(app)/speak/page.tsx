"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { SpeakView } from "@/components/speak/speak-view"
import { BackToTestsLink } from "@/components/tests/tests-hub"
import { dailyStudyPrefsFromQuery } from "@/lib/daily-study"

function SpeakInner() {
  const params = useSearchParams()
  const ids = params.get("ids")?.split(",").filter(Boolean)
  const session = dailyStudyPrefsFromQuery(params)
  return (
    <div>
      <BackToTestsLink />
      <SpeakView initialIds={ids} dailySession={ids?.length ? null : session} />
    </div>
  )
}

export default function SpeakPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading speaking…</p>}>
      <SpeakInner />
    </Suspense>
  )
}
