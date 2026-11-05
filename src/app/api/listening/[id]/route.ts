import { fail, ok } from "@/lib/api"
import { ensureDb } from "@/lib/prisma"
import { getListeningExercise } from "@/lib/repos/listening"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureDb()
    const { id } = await context.params
    return ok(await getListeningExercise(id))
  } catch (error) {
    return fail(error)
  }
}
