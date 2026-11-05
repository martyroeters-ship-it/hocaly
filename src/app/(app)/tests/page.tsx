import { Suspense } from "react"
import { TestsHub } from "@/components/tests/tests-hub"
import { TestsView } from "@/components/tests/tests-view"

function idsFromParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value.join(",") : value
  return raw?.split(",").filter(Boolean) ?? []
}

async function TestsContent({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[] }>
}) {
  const ids = idsFromParam((await searchParams).ids)
  if (ids.length) return <TestsView initialIds={ids} />
  return <TestsHub />
}

export default function TestsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[] }>
}) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading tests…</p>}>
      <TestsContent searchParams={searchParams} />
    </Suspense>
  )
}
