import { fail, ok, readBody, RequestError } from "@/lib/api"
import { ensureDb, prisma } from "@/lib/prisma"
import { resolveRequestCefr } from "@/lib/profile"
import {
  conversationReply,
  evaluateSpokenTurn,
  finishConversation,
  startSpeakingSession,
} from "@/lib/repos/speaking"
import { transcribeTurkish } from "@/lib/speech/stt"
import type { CefrLevel, SpeakingMode } from "@/lib/types"

export const maxDuration = 60

async function maybeTranscribe(body: {
  transcript?: string
  audio?: string
  mimeType?: string
  durationSec?: number
}) {
  if (body.transcript?.trim()) return body.transcript.trim()
  if (!body.audio) throw new RequestError("Speak an answer, or enable browser transcription.")
  const settings = await prisma.settings.findUnique({ where: { id: "default" } })
  const result = await transcribeTurkish({
    buffer: Buffer.from(body.audio, "base64"),
    mimeType: body.mimeType || "audio/webm",
    durationSec: body.durationSec,
    provider: settings?.sttProvider,
  })
  return result.transcript
}

export async function POST(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{
      action: "start" | "evaluate" | "converse" | "finish"
      mode?: SpeakingMode
      wordIds?: string[]
      topic?: string
      cefr?: CefrLevel
      speed?: number
      durationSec?: number
      sessionId?: string
      itemIndex?: number
      transcript?: string
      audio?: string
      mimeType?: string
      elapsedSec?: number
      keepRecording?: boolean
    }>(request)

    if (body.action === "start") {
      if (!body.wordIds?.length) throw new RequestError("Select vocabulary first")
      return ok(
        await startSpeakingSession({
          mode: body.mode ?? "listen-repeat",
          wordIds: body.wordIds,
          topic: body.topic,
          cefr: await resolveRequestCefr(body.cefr),
          speed: body.speed ?? 1,
          durationSec: body.durationSec,
        }),
      )
    }

    if (!body.sessionId) throw new RequestError("Missing speaking session")
    const settings = await prisma.settings.findUnique({ where: { id: "default" } })
    const keep = Boolean(body.keepRecording ?? settings?.keepRecordings)
    const recording =
      keep && body.audio
        ? { buffer: Buffer.from(body.audio, "base64"), mimeType: body.mimeType || "audio/webm" }
        : null

    if (body.action === "evaluate") {
      const transcript = await maybeTranscribe(body)
      return ok(
        await evaluateSpokenTurn({
          sessionId: body.sessionId,
          itemIndex: body.itemIndex ?? 0,
          transcript,
          recording,
          keepRecording: keep,
        }),
      )
    }
    if (body.action === "converse") {
      const transcript = await maybeTranscribe(body)
      return ok(
        await conversationReply({
          sessionId: body.sessionId,
          transcript,
          elapsedSec: body.elapsedSec ?? 0,
          recording,
          keepRecording: keep,
        }),
      )
    }
    if (body.action === "finish") {
      return ok(await finishConversation(body.sessionId))
    }
    throw new RequestError("Unknown speaking action")
  } catch (error) {
    return fail(error)
  }
}
