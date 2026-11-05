import { Suspense } from "react"
import { BackToTestsLink } from "@/components/tests/tests-hub"
import { TestsView } from "@/components/tests/tests-view"
import { dailyStudyPrefsFromQuery } from "@/lib/daily-study"
import { TEST_MODES, type TestMode } from "@/lib/types"

function idsFromParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value.join(",") : value
  return raw?.split(",").filter(Boolean) ?? []
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function modeFromParam(value: string | string[] | undefined): TestMode | undefined {
  const mode = first(value)
  return TEST_MODES.includes(mode as TestMode) ? (mode as TestMode) : undefined
}

async function TestsStudyContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const ids = idsFromParam(raw.ids)
  const session = dailyStudyPrefsFromQuery(raw)
  const initialMode = modeFromParam(raw.mode)
  return (
    <TestsView
      initialIds={ids.length ? ids : undefined}
      initialMode={initialMode}
      session={ids.length ? null : session}
      autoStart={Boolean(ids.length) || (!ids.length && first(raw.start) === "1")}
    />
  )
}

export default function TestsStudyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <div>
      <BackToTestsLink />
      <Suspense fallback={<p className="text-muted-foreground">Loading test setup…</p>}>
        <TestsStudyContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
