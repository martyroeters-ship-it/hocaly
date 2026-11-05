import { CEFR_LEVELS, type CefrLevel } from "@/lib/types"

export const DEFAULT_CEFR: CefrLevel = "A2"

export function isCefrLevel(value: unknown): value is CefrLevel {
  return typeof value === "string" && (CEFR_LEVELS as readonly string[]).includes(value)
}

export function parseCefrLevel(value: unknown): CefrLevel {
  return isCefrLevel(value) ? value : DEFAULT_CEFR
}

export function cefrFromSessionOrProfile(
  sessionCefr: string | null | undefined,
  profileCefr: string | null | undefined,
): CefrLevel {
  if (sessionCefr && sessionCefr !== "any") return parseCefrLevel(sessionCefr)
  return parseCefrLevel(profileCefr)
}
