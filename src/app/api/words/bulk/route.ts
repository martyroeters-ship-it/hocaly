import { ensureDb } from "@/lib/prisma"
import { fail, ok, readBody } from "@/lib/api"
import { bulkUpdate } from "@/lib/repos/words"
import type { LearningStatus } from "@/lib/types"

export async function POST(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{
      ids: string[]
      learningStatus?: LearningStatus
      tags?: string[]
      deleteWords?: boolean
    }>(request)
    if (!body.ids?.length) return fail(new Error("Select at least one word"))
    return ok(await bulkUpdate(body.ids, body))
  } catch (error) {
    return fail(error)
  }
}
