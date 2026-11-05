import { providerStatus } from "@/lib/ai/provider"
import { fail, ok, readBody } from "@/lib/api"
import { parseCefrLevel } from "@/lib/cefr"
import { prisma, ensureDb } from "@/lib/prisma"
import { speechStatus } from "@/lib/speech/providers"

export async function GET() {
  try {
    await ensureDb()
    const settings = await prisma.settings.findUnique({ where: { id: "default" } })
    return ok({ settings, ai: providerStatus(), speech: speechStatus() })
  } catch (error) {
    return fail(error)
  }
}

export async function POST(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{
      newWordsPerDay?: number
      cefrDefault?: string
      aiProvider?: string
      ttsVoice?: string | null
      ttsProvider?: string
      sttProvider?: string
      keepRecordings?: boolean
      fontSize?: number
      seed?: boolean
    }>(request)
    if (body.seed) {
      const { seedSampleVocabulary } = await import("@/lib/seed")
      return ok({ seeded: await seedSampleVocabulary(), ai: providerStatus(), speech: speechStatus() })
    }
    const settings = await prisma.settings.update({
      where: { id: "default" },
      data: {
        newWordsPerDay: body.newWordsPerDay,
        cefrDefault: body.cefrDefault !== undefined ? parseCefrLevel(body.cefrDefault) : undefined,
        aiProvider: body.aiProvider,
        ttsVoice: body.ttsVoice,
        ttsProvider: body.ttsProvider,
        sttProvider: body.sttProvider,
        keepRecordings: body.keepRecordings,
        fontSize: body.fontSize,
      },
    })
    return ok({ settings, ai: providerStatus(), speech: speechStatus() })
  } catch (error) {
    return fail(error)
  }
}
