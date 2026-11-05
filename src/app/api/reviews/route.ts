import { fail, ok, readBody } from "@/lib/api"
import { ensureDb } from "@/lib/prisma"
import { applyReview, checkProductionAnswer, resetWordProgress } from "@/lib/repos/reviews"
import { isVocabFace, type SrsRating, type VocabFace } from "@/lib/types"

export async function POST(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{
      wordId: string
      rating?: SrsRating
      source?: string
      seconds?: number
      reset?: boolean
      clientKey?: string
      face?: VocabFace
      checkOnly?: boolean
      given?: string
    }>(request)

    if (body.reset) {
      await resetWordProgress(body.wordId)
      return ok({ ok: true })
    }

    if (body.checkOnly) {
      return ok(await checkProductionAnswer(body.wordId, body.given ?? ""))
    }

    if (!body.rating) throw new Error("rating is required")
    const face = isVocabFace(body.face) ? body.face : undefined
    return ok(
      await applyReview(body.wordId, body.rating, body.source, body.seconds ?? 0, {
        clientKey: body.clientKey,
        face,
      }),
    )
  } catch (error) {
    return fail(error)
  }
}
