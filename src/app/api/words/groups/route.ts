import { completeJson } from "@/lib/ai/provider"
import { vocabGroupsPrompt } from "@/lib/ai/prompts"
import { vocabGroupsSchema } from "@/lib/ai/schemas"
import { fail, ok } from "@/lib/api"
import { ensureDb } from "@/lib/prisma"
import { listWords } from "@/lib/repos/words"
import { localGroups, mergeGroups, type VocabGroup } from "@/lib/vocab/groups"

export const maxDuration = 60

export async function GET() {
  try {
    await ensureDb()
    const { items } = await listWords({ take: 400 })
    const compact = items.map((word) => ({
      id: word.id,
      turkish: word.turkish,
      english: word.english,
      meanings: word.meanings,
      partOfSpeech: word.partOfSpeech,
      tags: word.tags,
    }))
    const local = localGroups(compact)
    try {
      const prompt = vocabGroupsPrompt(compact.map((word) => ({ id: word.id, turkish: word.turkish, english: word.english })))
      const result = await completeJson({
        kind: "vocab-groups",
        schema: vocabGroupsSchema,
        system: prompt.system,
        user: prompt.user,
      })
      const known = new Set(items.map((word) => word.id))
      const extra: VocabGroup[] = result.groups.map((group) => ({
        id: `ai:${group.name.toLocaleLowerCase("en-US")}`,
        name: group.name,
        help: group.help || "Related words in your list.",
        wordIds: group.ids.filter((id) => known.has(id)),
        source: "ai",
      }))
      return ok({ groups: mergeGroups(local, extra) })
    } catch (error) {
      console.warn("[kelime] vocab groups AI failed; using local groups.", error instanceof Error ? error.message : error)
      return ok({ groups: local })
    }
  } catch (error) {
    return fail(error)
  }
}
