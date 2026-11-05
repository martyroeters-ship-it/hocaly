import { dialogueTurnPrompt } from "@/lib/ai/prompts"
import { completeJson, describeAiFailure } from "@/lib/ai/provider"
import { dialogueTurnSchema } from "@/lib/ai/schemas"
import { fail, ok, readBody, RequestError } from "@/lib/api"
import {
  fallbackDialogueFollowUp,
  fallbackDialogueOpener,
  resolveDialogueScenario,
  type DialogueTurn,
} from "@/lib/dialogue"
import { ensureDb, prisma } from "@/lib/prisma"
import { resolveRequestCefr } from "@/lib/profile"
import { getWordsByIds } from "@/lib/repos/words"
import type { CefrLevel } from "@/lib/types"

export const maxDuration = 60

function englishOf(word: { meanings: { english: string; isPrimary: boolean }[] }) {
  return word.meanings.find((item) => item.isPrimary)?.english ?? word.meanings[0]?.english ?? ""
}

export async function POST(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{
      action: "start" | "turn"
      presetId?: string
      topic?: string
      speaker?: string
      cefr?: CefrLevel
      wordIds?: string[]
      messages?: { role: string; turkish: string }[]
      userText?: string
    }>(request)

    if (body.action !== "start" && body.action !== "turn") {
      throw new RequestError("Unknown dialogue action")
    }

    const resolved = resolveDialogueScenario({ presetId: body.presetId, topic: body.topic })
    const speaker = body.speaker?.trim() || resolved.speaker
    const cefr = await resolveRequestCefr(body.cefr)
    const words = body.wordIds?.length ? await getWordsByIds(body.wordIds) : []
    const targetWords = words.map((word) => ({ turkish: word.turkish, english: englishOf(word) }))
    const profile = await prisma.grammarProfile.findUnique({ where: { id: "default" } })
    const knownGrammar = JSON.parse(profile?.knownJson ?? "[]") as string[]
    const introduceNew = profile?.introduceNew ?? false
    const opening = body.action === "start"
    const userText = body.userText?.trim()
    const incoming = body.messages ?? []
    const last = incoming.at(-1)
    const history = opening
      ? []
      : userText && last?.role !== "user"
        ? [...incoming, { role: "user", turkish: userText }]
        : incoming

    if (!opening && !userText) {
      throw new RequestError("Type a reply first")
    }

    try {
      const prompt = dialogueTurnPrompt({
        scenario: resolved.scenario,
        speaker,
        cefr,
        targetWords,
        messages: history,
        knownGrammar,
        introduceNew,
        opening,
      })
      const turn = await completeJson({
        kind: "dialogue-turn",
        schema: dialogueTurnSchema,
        system: prompt.system,
        user: prompt.user,
        cache: false,
      })
      return ok({
        ...resolved,
        speaker: turn.speaker || speaker,
        turkish: turn.turkish,
        english: turn.english,
        draft: false,
      } satisfies DialogueTurn & { draft: boolean; id: string; label: string; scenario: string })
    } catch (error) {
      const reason = describeAiFailure(error)
      console.warn(`[kelime] Gemini dialogue skipped (${reason}). Using a local line.`, error instanceof Error ? error.message : error)
      const fallback = opening ? fallbackDialogueOpener({ ...resolved, speaker }) : fallbackDialogueFollowUp(speaker)
      return ok({
        ...resolved,
        ...fallback,
        speaker,
        draft: true,
      })
    }
  } catch (error) {
    return fail(error)
  }
}
