import { GoogleGenerativeAI } from "@google/generative-ai"
import OpenAI from "openai"
import { prisma } from "@/lib/prisma"
import { resolveSttProvider, SpeechUnavailableError } from "@/lib/speech/providers"
import { estimateSttCost, logSpeechUsage } from "@/lib/speech/usage"

const ALLOWED = new Set(["audio/webm", "audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/x-wav", "audio/webm;codecs=opus"])

export async function transcribeTurkish(options: {
  buffer: Buffer
  mimeType: string
  durationSec?: number
  provider?: string | null
}): Promise<{ transcript: string; provider: string; model: string }> {
  const mimeType = options.mimeType.split(";")[0] || "audio/webm"
  if (![...ALLOWED].some((item) => mimeType.startsWith(item.split(";")[0]))) {
    throw new SpeechUnavailableError("Use a microphone recording in WebM, WAV, or MP3.")
  }
  if (options.buffer.length > 8_000_000) {
    throw new SpeechUnavailableError("That recording is too long. Try a shorter answer.")
  }

  const provider = resolveSttProvider(options.provider)
  if (provider === "browser") {
    throw new SpeechUnavailableError("Browser speech recognition runs on the device. Send a transcript, or configure OpenAI/Gemini STT.")
  }

  const seconds = options.durationSec ?? Math.max(1, Math.round(options.buffer.length / 16_000))

  if (provider === "openai") {
    const model = process.env.OPENAI_STT_MODEL?.trim() || "whisper-1"
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const file = new File([new Uint8Array(options.buffer)], `speech.${mimeType.includes("wav") ? "wav" : "webm"}`, { type: mimeType })
    const result = await client.audio.transcriptions.create({
      file,
      model,
      language: "tr",
    })
    const transcript = ("text" in result ? result.text : "").trim()
    await logSpeechUsage({
      kind: "stt",
      provider,
      model,
      units: seconds,
      estimatedUsd: estimateSttCost(provider, seconds),
    })
    return { transcript, provider, model }
  }

  const model = "gemini-3.8-flash"
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const gen = client.getGenerativeModel({
    model,
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
  })
  const result = await gen.generateContent([
    'Transcribe this Turkish speech. Return JSON {"transcript":"..."} only. Preserve Turkish letters. If nothing is audible, return {"transcript":""}.',
    { inlineData: { mimeType, data: options.buffer.toString("base64") } },
  ])
  let transcript = ""
  try {
    const parsed = JSON.parse(result.response.text()) as { transcript?: string }
    transcript = parsed.transcript?.trim() ?? ""
  } catch {
    transcript = result.response.text().trim()
  }
  await prisma.tokenUsage.create({
    data: {
      provider: "gemini",
      model,
      inputTokens: result.response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: result.response.usageMetadata?.candidatesTokenCount ?? 0,
      estimatedUsd: 0,
    },
  })
  await logSpeechUsage({
    kind: "stt",
    provider: "gemini",
    model,
    units: seconds,
    estimatedUsd: 0,
  })
  return { transcript, provider: "gemini", model }
}
