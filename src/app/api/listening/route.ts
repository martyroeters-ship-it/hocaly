import { fail, ok, readBody, RequestError } from "@/lib/api"
import { ensureDb } from "@/lib/prisma"
import { resolveRequestCefr } from "@/lib/profile"
import { createListeningExercise, gradeListening, listListeningExercises, saveListeningExercise } from "@/lib/repos/listening"
import type { CefrLevel, ListeningFormat } from "@/lib/types"

export const maxDuration = 60

export async function GET() {
  try {
    await ensureDb()
    return ok({ exercises: await listListeningExercises() })
  } catch (error) {
    return fail(error)
  }
}

export async function POST(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{
      action?: "generate" | "grade" | "save"
      wordIds?: string[]
      topic?: string
      cefr?: CefrLevel
      format?: ListeningFormat
      durationSec?: number
      speed?: number
      id?: string
      saved?: boolean
      kind?: "comprehension" | "dictation" | "vocab"
      prompt?: string
      given?: string
      expected?: string
      extra?: string[]
    }>(request)

    if (body.action === "grade" && body.id) {
      return ok(
        await gradeListening({
          exerciseId: body.id,
          kind: body.kind ?? "comprehension",
          prompt: body.prompt ?? "",
          given: body.given ?? "",
          expected: body.expected ?? "",
          extra: body.extra,
        }),
      )
    }
    if (body.action === "save" && body.id) {
      return ok(await saveListeningExercise(body.id, body.saved !== false))
    }

    if (!body.wordIds?.length) throw new RequestError("Select vocabulary first")
    const exercise = await createListeningExercise({
      wordIds: body.wordIds,
      topic: body.topic?.trim() || "Daily life",
      cefr: await resolveRequestCefr(body.cefr),
      format: body.format ?? "monologue",
      durationSec: body.durationSec ?? 60,
      speed: body.speed ?? 1,
    })
    return ok(exercise)
  } catch (error) {
    return fail(error)
  }
}
