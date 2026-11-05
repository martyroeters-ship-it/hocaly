import { fail, ok, readBody } from "@/lib/api"
import { prisma, ensureDb } from "@/lib/prisma"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureDb()
    const { id } = await context.params
    const body = await readBody<{ favorite?: boolean }>(request)
    const example = await prisma.exampleSentence.update({ where: { id }, data: { favorite: body.favorite } })
    return ok(example)
  } catch (error) {
    return fail(error)
  }
}
