import { isCefrLevel, parseCefrLevel } from "@/lib/cefr"
import { prisma } from "@/lib/prisma"
import type { CefrLevel } from "@/lib/types"

export async function getProfileCefr(): Promise<CefrLevel> {
  const settings = await prisma.settings.findUnique({ where: { id: "default" } })
  return parseCefrLevel(settings?.cefrDefault)
}

export async function resolveRequestCefr(value?: string | null): Promise<CefrLevel> {
  if (isCefrLevel(value)) return value
  return getProfileCefr()
}
