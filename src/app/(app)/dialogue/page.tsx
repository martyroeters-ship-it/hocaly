"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { DialogueView } from "@/components/dialogue/dialogue-view"
import { dailyStudyPrefsFromQuery } from "@/lib/daily-study"

function DialogueInner() {
  const params = useSearchParams()
  const ids = params.get("ids")?.split(",").filter(Boolean)
  const session = dailyStudyPrefsFromQuery(params)
  return <DialogueView initialIds={ids} session={ids?.length ? null : session} />
}

export default function DialoguePage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading dialogue…</p>}>
      <DialogueInner />
    </Suspense>
  )
}
