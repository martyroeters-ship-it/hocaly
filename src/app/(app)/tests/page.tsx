import { TestsHub } from "@/components/tests/tests-hub"
import { TestsView } from "@/components/tests/tests-view"

function idsFromParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value.join(",") : value
  return raw?.split(",").filter(Boolean) ?? []
}

export default async function TestsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[] }>
}) {
  const ids = idsFromParam((await searchParams).ids)
  if (ids.length) return <TestsView initialIds={ids} />
  return <TestsHub />
}
