import { fail, ok, readBody } from "@/lib/api"
import { ensureDb } from "@/lib/prisma"
import { deleteAllRecordings, deleteRecording, listRecordings } from "@/lib/repos/speaking"

export async function GET() {
  try {
    await ensureDb()
    return ok({ recordings: await listRecordings() })
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{ id?: string; all?: boolean }>(request).catch(() => ({}) as { id?: string; all?: boolean })
    if (body.all) return ok(await deleteAllRecordings())
    if (!body.id) return fail(new Error("Choose a recording to delete"))
    return ok(await deleteRecording(body.id))
  } catch (error) {
    return fail(error)
  }
}
