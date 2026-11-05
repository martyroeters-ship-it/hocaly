import { createHash } from "node:crypto"
import OpenAI from "openai"
import type { z } from "zod"
import { prisma } from "@/lib/prisma"

export class AiUnavailableError extends Error {
  constructor(message = "No AI provider is configured. Add GEMINI_API_KEY or OPENAI_API_KEY in .env.") {
    super(message)
    this.name = "AiUnavailableError"
  }
}

export class AiResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AiResponseError"
  }
}

export class GeminiQuotaError extends AiResponseError {
  constructor(message = "Gemini's free quota is exhausted for the moment. Wait a minute and try again.") {
    super(message)
    this.name = "GeminiQuotaError"
  }
}

type ProviderName = "gemini" | "openai"

function geminiModel() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash"
}

export type VisionImage = {
  mimeType: string
  data: string
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
])

export function assertVisionImage(image: VisionImage) {
  if (!ALLOWED_IMAGE_TYPES.has(image.mimeType)) {
    throw new AiResponseError("Use a JPEG, PNG, or WebP photo of the highlighted text.")
  }
  if (!image.data || image.data.length > 7_000_000) {
    throw new AiResponseError("That image is too large. Try a closer crop or a smaller photo.")
  }
}

const RATE_LIMIT_MS = 4000
let lastCall = 0

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function throttle() {
  const wait = RATE_LIMIT_MS - (Date.now() - lastCall)
  if (wait > 0) await sleep(wait)
  lastCall = Date.now()
}

function activeProvider(): { name: ProviderName; model: string } {
  const requested = (process.env.AI_PROVIDER ?? "gemini").toLowerCase()
  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  const openaiKey = process.env.OPENAI_API_KEY?.trim()

  if (requested === "openai" && openaiKey) {
    return { name: "openai", model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini" }
  }
  if (geminiKey) {
    return { name: "gemini", model: geminiModel() }
  }
  if (openaiKey) {
    return { name: "openai", model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini" }
  }
  throw new AiUnavailableError()
}

function cacheKey(kind: string, system: string, user: string, model: string, image?: VisionImage) {
  const imageHash = image ? createHash("sha256").update(image.data).digest("hex") : ""
  return createHash("sha256").update(`${kind}:${model}:${system}:${user}:${imageHash}`).digest("hex")
}

function estimateCost(provider: ProviderName, input: number, output: number) {
  const rates =
    provider === "openai"
      ? { in: 0.15 / 1_000_000, out: 0.6 / 1_000_000 }
      : { in: 0.1 / 1_000_000, out: 0.4 / 1_000_000 }
  return input * rates.in + output * rates.out
}

function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced?.[1] ?? trimmed
  try {
    return JSON.parse(raw)
  } catch {
    const start = raw.indexOf("{")
    const end = raw.lastIndexOf("}")
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1))
    throw new AiResponseError("AI did not return valid JSON.")
  }
}

type ThinkingLevel = "minimal" | "low" | "medium" | "high"

type GeminiCallOptions = {
  timeoutMs?: number
  thinkingLevel?: ThinkingLevel
}

function isNarrativeKind(kind: string) {
  return kind === "listening-passage" || kind === "story"
}

function thinkingConfigFor(model: string, level?: ThinkingLevel) {
  if (/gemini-3(?:\.\d+)?|gemini-4/.test(model)) return { thinkingLevel: (level ?? "low") as ThinkingLevel }
  if (/gemini-2\.5/.test(model)) return { thinkingBudget: 0 }
  return undefined
}

function scrubGeminiError(message: string) {
  return message
    .replace(/key=[^&\s]+/gi, "key=REDACTED")
    .replace(/AIza[0-9A-Za-z_\-]+/g, "REDACTED")
    .replace(/AQ\.[A-Za-z0-9_\-]+/g, "REDACTED")
}

function partsText(parts: Array<{ text?: string; thought?: boolean }> | undefined) {
  return (parts ?? [])
    .filter((part) => !part.thought && part.text)
    .map((part) => part.text ?? "")
    .join("")
    .trim()
}

const GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite"

async function completeGeminiModel(
  model: string,
  system: string,
  user: string,
  image?: VisionImage,
  extras?: GeminiCallOptions,
) {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) throw new AiUnavailableError()

  const thinkingConfig = thinkingConfigFor(model, extras?.thinkingLevel)
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    maxOutputTokens: 8192,
  }
  if (thinkingConfig) generationConfig.thinkingConfig = thinkingConfig
  if (!thinkingConfig) generationConfig.temperature = image ? 0.2 : 0.4

  const userParts: Array<Record<string, unknown>> = [{ text: user }]
  if (image) {
    userParts.push({ inlineData: { mimeType: image.mimeType, data: image.data } })
  }

  const controller = new AbortController()
  const timeoutMs = extras?.timeoutMs ?? (image ? 60_000 : 30_000)
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: userParts }],
        generationConfig,
      }),
    })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AiResponseError("Gemini timed out. Try again in a moment.")
    }
    throw new AiResponseError(`Could not reach Gemini (${scrubGeminiError(error instanceof Error ? error.message : "network error")}).`)
  } finally {
    clearTimeout(timer)
  }

  const raw = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; status?: string; code?: number }
    candidates?: Array<{
      finishReason?: string
      content?: { parts?: Array<{ text?: string; thought?: boolean }> }
    }>
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }
  }

  if (response.status === 429 || raw.error?.status === "RESOURCE_EXHAUSTED") {
    throw new GeminiQuotaError()
  }
  if (!response.ok) {
    throw new AiResponseError(
      scrubGeminiError(raw.error?.message || `Gemini request failed (${response.status}).`).slice(0, 240),
    )
  }

  const candidate = raw.candidates?.[0]
  const text = partsText(candidate?.content?.parts)
  if (!text) {
    throw new AiResponseError(`Gemini returned no text (${candidate?.finishReason ?? "empty"}). Try generating again.`)
  }
  return {
    text,
    model,
    input: raw.usageMetadata?.promptTokenCount ?? 0,
    output: (raw.usageMetadata?.candidatesTokenCount ?? 0) + (raw.usageMetadata?.thoughtsTokenCount ?? 0),
  }
}

async function completeGemini(
  _model: string,
  system: string,
  user: string,
  image?: VisionImage,
  forceLite = false,
  extras?: GeminiCallOptions,
) {
  const preferred = forceLite ? GEMINI_FALLBACK_MODEL : geminiModel()
  const models = preferred === GEMINI_FALLBACK_MODEL ? [preferred] : [preferred, GEMINI_FALLBACK_MODEL]
  let lastError: unknown
  for (const model of models) {
    try {
      const lite = forceLite || model === GEMINI_FALLBACK_MODEL
      return await completeGeminiModel(model, system, user, image, {
        timeoutMs: extras?.timeoutMs,
        thinkingLevel: lite ? "low" : extras?.thinkingLevel,
      })
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : ""
      const canFallback =
        model !== models.at(-1) &&
        (error instanceof GeminiQuotaError || /timed out|no text/i.test(message))
      if (!canFallback) throw error
    }
  }
  throw lastError instanceof Error ? lastError : new AiResponseError("Gemini request failed.")
}

async function completeOpenAi(model: string, system: string, user: string, image?: VisionImage) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const result = await client.chat.completions.create({
    model,
    temperature: image ? 0.2 : 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      image
        ? {
            role: "user",
            content: [
              { type: "text", text: user },
              { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data}`, detail: "high" } },
            ],
          }
        : { role: "user", content: user },
    ],
  })
  const text = result.choices[0]?.message?.content ?? ""
  return {
    text,
    model,
    input: result.usage?.prompt_tokens ?? 0,
    output: result.usage?.completion_tokens ?? 0,
  }
}

export function describeAiFailure(error: unknown) {
  if (error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues: unknown }).issues)) {
    return "schema"
  }
  const message = error instanceof Error ? error.message : String(error ?? "")
  if (/skip-ai/i.test(message)) return "skip-ai"
  if (/list-like|story dump|dummy story dump/i.test(message)) return "list-like"
  if (/did not return valid JSON|returned no text|empty JSON/i.test(message)) return "empty JSON"
  if (/timed out/i.test(message)) return "timeout"
  if (/quota|RESOURCE_EXHAUSTED/i.test(message)) return "quota"
  if (/ZodError|invalid_type|too_small/i.test(message)) return "schema"
  return message.replace(/\s+/g, " ").trim().slice(0, 180) || "unknown"
}

export async function completeJson<T>(options: {
  kind: string
  schema: z.ZodType<T>
  system: string
  user: string
  image?: VisionImage
  cache?: boolean
  timeoutMs?: number
  thinkingLevel?: ThinkingLevel
}): Promise<T> {
  if (options.image) assertVisionImage(options.image)
  const { name, model } = activeProvider()
  const key = cacheKey(options.kind, options.system, options.user, model, options.image)
  const narrative = isNarrativeKind(options.kind)
  const extras: GeminiCallOptions = {
    timeoutMs: options.timeoutMs ?? (options.image ? 60_000 : narrative ? 40_000 : 30_000),
    thinkingLevel: options.thinkingLevel ?? (narrative ? "medium" : undefined),
  }

  const useCache = narrative ? options.cache === true : options.cache !== false
  if (useCache) {
    const cached = await prisma.aiCache.findUnique({ where: { key } })
    if (cached) return options.schema.parse(JSON.parse(cached.payload))
  }

  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await throttle()
      const raw = name === "gemini"
        ? await completeGemini(model, options.system, options.user, options.image, attempt > 0, extras)
        : await completeOpenAi(model, options.system, options.user, options.image)

      await prisma.tokenUsage.create({
        data: {
          provider: name,
          model: raw.model,
          inputTokens: raw.input,
          outputTokens: raw.output,
          estimatedUsd: estimateCost(name, raw.input, raw.output),
        },
      })

      const extracted = extractJson(raw.text)
      let parsed: T
      try {
        parsed = options.schema.parse(extracted)
      } catch (error) {
        if (isNarrativeKind(options.kind)) {
          const keys =
            extracted && typeof extracted === "object" ? Object.keys(extracted as object).join(",") : typeof extracted
          console.warn(`[kelime] ${options.kind} schema failed; payload keys: ${keys || "empty JSON"}`)
        }
        throw error
      }
      if (useCache) {
        await prisma.aiCache.upsert({
          where: { key },
          update: { payload: JSON.stringify(parsed) },
          create: { key, kind: options.kind, payload: JSON.stringify(parsed) },
        })
      }
      return parsed
    } catch (error) {
      lastError = error
      if (error instanceof AiUnavailableError || error instanceof GeminiQuotaError) throw error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new AiResponseError("AI response failed validation after retries.")
}

export function providerStatus() {
  try {
    const active = activeProvider()
    return { configured: true, provider: active.name, model: active.model }
  } catch {
    return { configured: false, provider: null, model: null }
  }
}
