import { completeJson } from "@/lib/ai/provider"
import { vocabTopicPrompt } from "@/lib/ai/prompts"
import { vocabTopicSchema } from "@/lib/ai/schemas"
import { fail, ok, readBody, RequestError } from "@/lib/api"
import { ensureDb } from "@/lib/prisma"
import { listWords } from "@/lib/repos/words"
import { shufflePick } from "@/lib/vocab/groups"
import { pickByTopic } from "@/lib/vocab/topic"

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{ topic?: string; count?: number }>(request)
    const topic = body.topic?.replace(/\s+/g, " ").trim() ?? ""
    if (topic.length < 2) throw new RequestError("Type a subject, for example Holiday.")
    const count = Math.min(20, Math.max(4, body.count ?? 12))
    const { items } = await listWords({ take: 400 })
    const compact = items.map((word) => ({
      id: word.id,
      turkish: word.turkish,
      english: word.english,
      meanings: word.meanings,
    }))
    const known = new Set(items.map((word) => word.id))
    let ids: string[] = []
    let note = ""
    try {
      const prompt = vocabTopicPrompt(
        topic,
        compact.map((word) => ({ id: word.id, turkish: word.turkish, english: word.english })),
      )
      const result = await completeJson({
        kind: "vocab-topic",
        schema: vocabTopicSchema,
        system: prompt.system,
        user: prompt.user,
        cache: true,
      })
      ids = result.ids.filter((id) => known.has(id))
      note = result.note
    } catch (error) {
      console.warn("[kelime] topic pick AI failed; using local match.", error instanceof Error ? error.message : error)
    }
    if (ids.length < 3) {
      ids = pickByTopic(compact, topic, count)
      if (!note) note = ids.length ? "Closest matches from your list." : "Nothing in your list fits that subject yet."
    }
    return ok({
      topic,
      wordIds: shufflePick(ids, count),
      note,
    })
  } catch (error) {
    return fail(error)
  }
}
