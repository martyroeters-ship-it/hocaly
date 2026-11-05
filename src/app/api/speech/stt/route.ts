import { fail, ok } from "@/lib/api"
import { ensureDb, prisma } from "@/lib/prisma"
import { transcribeTurkish } from "@/lib/speech/stt"

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    await ensureDb()
    const form = await request.formData()
    const audio = form.get("audio")
    if (!(audio instanceof File)) {
      return fail(new Error("Record a spoken answer first."))
    }
    const settings = await prisma.settings.findUnique({ where: { id: "default" } })
    const buffer = Buffer.from(await audio.arrayBuffer())
    const result = await transcribeTurkish({
      buffer,
      mimeType: audio.type || "audio/webm",
      durationSec: Number(form.get("durationSec") ?? 0) || undefined,
      provider: settings?.sttProvider,
    })
    return ok(result)
  } catch (error) {
    return fail(error)
  }
}
