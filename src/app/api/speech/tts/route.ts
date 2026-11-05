import { fail, ok, readBody } from "@/lib/api"
import { ensureDb, prisma } from "@/lib/prisma"
import { synthesizeTurkish } from "@/lib/speech/tts"

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{ text: string; voice?: string | null }>(request)
    const settings = await prisma.settings.findUnique({ where: { id: "default" } })
    const result = await synthesizeTurkish({
      text: body.text ?? "",
      provider: settings?.ttsProvider,
      voice: body.voice ?? settings?.ttsVoice,
    })
    if (result.provider === "browser") {
      return ok({ provider: "browser" })
    }
    return new Response(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.mimeType,
        "X-Speech-Provider": result.provider,
        "X-Speech-Cached": result.cached ? "1" : "0",
        "Cache-Control": "private, max-age=86400",
      },
    })
  } catch (error) {
    return fail(error)
  }
}
