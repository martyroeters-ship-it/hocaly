"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CefrPicker } from "@/components/cefr-picker"
import { PageBody, PageHero } from "@/components/layout/page-hero"
import { api } from "@/lib/client"
import { DEFAULT_CEFR } from "@/lib/cefr"
import type { CefrLevel } from "@/lib/types"

export function ProfileView({ initialCefr = DEFAULT_CEFR }: { initialCefr?: CefrLevel }) {
  const [cefr, setCefr] = useState<CefrLevel>(initialCefr)

  async function save(next: CefrLevel) {
    const previous = cefr
    setCefr(next)
    try {
      await api("/api/settings", { method: "POST", body: JSON.stringify({ cefrDefault: next }) })
      toast.success("Turkish level saved")
    } catch (error) {
      setCefr(previous)
      toast.error(error instanceof Error ? error.message : "Could not save level")
    }
  }

  return (
    <div>
      <PageHero
        title="Profile"
        subtitle="Local single-user settings. Generated examples, stories, and practice follow this Turkish CEFR unless an exercise lets you pick another level for that session."
      />
      <PageBody narrow className="space-y-6">
        <div className="rounded-xl border bg-card p-4">
          <CefrPicker value={cefr} onChange={(level) => void save(level)} />
        </div>
      </PageBody>
    </div>
  )
}
