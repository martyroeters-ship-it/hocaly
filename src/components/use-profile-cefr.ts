"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/client"
import { cefrFromSessionOrProfile, parseCefrLevel } from "@/lib/cefr"
import type { CefrLevel } from "@/lib/types"

export function useProfileCefr(sessionCefr?: string | null) {
  const [cefr, setCefr] = useState<CefrLevel>(() => cefrFromSessionOrProfile(sessionCefr, undefined))

  useEffect(() => {
    if (sessionCefr && sessionCefr !== "any") {
      setCefr(parseCefrLevel(sessionCefr))
      return
    }
    let cancelled = false
    api<{ settings?: { cefrDefault?: string } }>("/api/settings")
      .then((data) => {
        if (!cancelled) setCefr(parseCefrLevel(data.settings?.cefrDefault))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [sessionCefr])

  return [cefr, setCefr] as const
}
