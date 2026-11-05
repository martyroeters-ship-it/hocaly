import { prisma } from "@/lib/prisma"
import { ensureDb } from "@/lib/prisma"
import { fail, ok, readBody } from "@/lib/api"
import { updateWord } from "@/lib/repos/words"
import { resetWordProgress } from "@/lib/repos/reviews"
import type { LearningStatus } from "@/lib/types"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureDb()
    const { id } = await context.params
    const body = await readBody<{
      turkish?: string
      english?: string
      meanings?: string[]
      partOfSpeech?: string | null
      cefrLevel?: string | null
      learningStatus?: LearningStatus
      notes?: string | null
      tags?: string[]
      reset?: boolean
    }>(request)
    if (body.reset) {
      await resetWordProgress(id)
    }
    const word = await updateWord(id, body)
    return ok(word)
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureDb()
    const { id } = await context.params
    await prisma.word.delete({ where: { id } })
    return ok({ ok: true })
  } catch (error) {
    return fail(error)
  }
}
