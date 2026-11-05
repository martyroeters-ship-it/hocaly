import { readFile } from "node:fs/promises"
import OpenAI from "openai"
import { prisma } from "@/lib/prisma"
import { audioPath, ttsCacheKey, writeAudioFile } from "@/lib/speech/fs"
import { resolveTtsProvider, SpeechUnavailableError } from "@/lib/speech/providers"
import { estimateTtsCost, logSpeechUsage } from "@/lib/speech/usage"

export type TtsAudioResult = {
  provider: "openai" | "gemini"
  model: string
  mimeType: string
  buffer: Buffer
  cached: boolean
}

export type TtsResult =
  | { provider: "browser"; model: "speechSynthesis" }
  | TtsAudioResult

const GEMINI_VOICES = new Set([
  "Zephyr",
  "Puck",
  "Charon",
  "Kore",
  "Fenrir",
  "Leda",
  "Orus",
  "Aoede",
  "Callirrhoe",
  "Autonoe",
  "Enceladus",
  "Iapetus",
  "Umbriel",
  "Algieba",
  "Despina",
  "Erinome",
  "Algenib",
  "Rasalas",
  "Laomedeia",
  "Achernar",
  "Alnilam",
  "Schedar",
  "Gacrux",
  "Pulcherrima",
  "Achird",
  "Zubenelgenubi",
  "Vindemiatrix",
  "Sadachbia",
  "Sadaltager",
  "Sulafat",
])

function geminiVoice(requested?: string | null) {
  const named = requested?.trim()
  if (named && GEMINI_VOICES.has(named)) return named
  const env = process.env.GEMINI_TTS_VOICE?.trim()
  if (env && GEMINI_VOICES.has(env)) return env
  return "Kore"
}

function pcmToWav(pcm: Buffer, sampleRate = 24000) {
  const header = Buffer.alloc(44)
  header.write("RIFF", 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write("WAVE", 8)
  header.write("fmt ", 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write("data", 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

function audioFromInline(mimeType: string, data: string) {
  const raw = Buffer.from(data, "base64")
  if (mimeType.includes("L16") || mimeType.includes("pcm")) {
    const rate = Number(mimeType.match(/rate=(\d+)/)?.[1] ?? 24000)
    return { buffer: pcmToWav(raw, rate), mimeType: "audio/wav" }
  }
  if (mimeType.includes("wav")) return { buffer: raw, mimeType: "audio/wav" }
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return { buffer: raw, mimeType: "audio/mpeg" }
  return { buffer: raw, mimeType: mimeType || "audio/wav" }
}

function geminiTtsPrompt(model: string, text: string) {
  if (model.includes("2.5")) {
    return `Read this Turkish text aloud. Generate audio only, with no extra words:\n${text}`
  }
  return text
}

async function synthesizeGemini(text: string, voice: string): Promise<TtsAudioResult> {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) throw new SpeechUnavailableError("Gemini TTS needs GEMINI_API_KEY.")
  const models = [
    process.env.GEMINI_TTS_MODEL?.trim(),
    "gemini-3.8-flash-lite-tts",
    "gemini-3.8-flash-tts",
    "gemini-2.5-flash-preview-tts",
  ].filter((item, index, list): item is string => Boolean(item) && list.indexOf(item) === index)

  let lastError = "Gemini TTS failed."
  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: geminiTtsPrompt(model, text) }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      }),
    })
    const json = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; status?: string }
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>
    }
    if (response.status === 429 || json.error?.status === "RESOURCE_EXHAUSTED") {
      lastError = "Gemini speech quota is exhausted for the moment. Try again in a minute."
      continue
    }
    if (!response.ok) {
      lastError = json.error?.message || `Gemini TTS failed (${response.status}).`
      continue
    }
    const part = json.candidates?.[0]?.content?.parts?.find((item) => item.inlineData?.data)
    if (!part?.inlineData?.data) {
      lastError = "Gemini returned no audio."
      continue
    }
    const audio = audioFromInline(part.inlineData.mimeType ?? "", part.inlineData.data)
    return { provider: "gemini", model, mimeType: audio.mimeType, buffer: audio.buffer, cached: false }
  }
  throw new SpeechUnavailableError(lastError)
}

async function synthesizeOpenAi(text: string, voice: string): Promise<TtsAudioResult> {
  const model = process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts"
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  let response: Awaited<ReturnType<typeof client.audio.speech.create>>
  try {
    response = await client.audio.speech.create({
      model,
      voice: voice as "alloy" | "ash" | "ballad" | "coral" | "echo" | "fable" | "nova" | "onyx" | "sage" | "shimmer" | "verse",
      input: text,
      instructions: "Speak natural, clear Turkish. Neutral Istanbul pronunciation. Do not add extra words.",
      response_format: "mp3",
    })
  } catch {
    response = await client.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
      response_format: "mp3",
    })
  }
  return {
    provider: "openai",
    model,
    mimeType: "audio/mpeg",
    buffer: Buffer.from(await response.arrayBuffer()),
    cached: false,
  }
}

export async function synthesizeTurkish(options: {
  text: string
  provider?: string | null
  voice?: string | null
}): Promise<TtsResult> {
  const text = options.text.trim()
  if (!text) throw new SpeechUnavailableError("Nothing to speak.")
  const provider = resolveTtsProvider(options.provider)
  if (provider === "browser") return { provider: "browser", model: "speechSynthesis" }

  const voice = provider === "gemini" ? geminiVoice(options.voice) : options.voice?.trim() || process.env.OPENAI_TTS_VOICE?.trim() || "coral"
  const modelHint = provider === "gemini" ? process.env.GEMINI_TTS_MODEL?.trim() || "gemini-tts" : process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts"
  const cacheKey = ttsCacheKey(text, provider, modelHint, voice)
  const cached = await prisma.audioCache.findUnique({ where: { key: cacheKey } })
  if (cached) {
    try {
      const buffer = await readFile(cached.path)
      return { provider, model: cached.model, mimeType: cached.mimeType, buffer, cached: true }
    } catch {
      await prisma.audioCache.delete({ where: { key: cacheKey } }).catch(() => undefined)
    }
  }

  const result = provider === "gemini" ? await synthesizeGemini(text, voice) : await synthesizeOpenAi(text, voice)
  const ext = result.mimeType.includes("wav") ? "wav" : "mp3"
  const filePath = audioPath(cacheKey, ext)
  await writeAudioFile(filePath, result.buffer)
  await prisma.audioCache.upsert({
    where: { key: cacheKey },
    update: { path: filePath, provider, model: result.model, mimeType: result.mimeType, charCount: text.length },
    create: { key: cacheKey, path: filePath, provider, model: result.model, mimeType: result.mimeType, charCount: text.length },
  })
  await logSpeechUsage({
    kind: "tts",
    provider,
    model: result.model,
    units: text.length,
    estimatedUsd: estimateTtsCost(provider, text.length),
  })
  return result
}
