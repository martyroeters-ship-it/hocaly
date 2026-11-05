import { prisma } from "@/lib/prisma"

export async function logSpeechUsage(data: {
  kind: "tts" | "stt"
  provider: string
  model: string
  units: number
  estimatedUsd: number
}) {
  await prisma.speechUsage.create({ data })
}

export function estimateTtsCost(provider: string, characters: number) {
  if (provider === "openai") return (characters / 1_000_000) * 12
  if (provider === "gemini") return (characters / 1_000_000) * 1
  return 0
}

export function estimateSttCost(provider: string, seconds: number) {
  if (provider === "openai") return (seconds / 60) * 0.006
  return 0
}
