import { completeJson } from "@/lib/ai/provider"
import { highlightExtractionPrompt, translationPrompt } from "@/lib/ai/prompts"
import { highlightedWordsSchema, translationBatchSchema } from "@/lib/ai/schemas"
import { fail, ok, readBody, RequestError } from "@/lib/api"
import { highlightsToParsedRows } from "@/lib/import/from-highlights"
import { markFileDuplicates } from "@/lib/import/parse"
import { ensureDb } from "@/lib/prisma"
import { previewParsed } from "@/lib/repos/words"
import { normalizeTurkish } from "@/lib/turkish"

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{ mimeType: string; data: string }>(request)
    if (!body?.data || !body.mimeType) {
      throw new RequestError("Choose a photo of the highlighted text.")
    }

    const prompt = highlightExtractionPrompt()
    const extracted = await completeJson({
      kind: "highlights",
      schema: highlightedWordsSchema,
      system: prompt.system,
      user: prompt.user,
      image: { mimeType: body.mimeType, data: body.data.replace(/^data:[^;]+;base64,/, "") },
    })

    const parsed = markFileDuplicates(highlightsToParsedRows(extracted.words))
    const missing = parsed.filter((row) => !row.english)
    if (missing.length) {
      const translate = translationPrompt(missing.map((row) => row.turkish))
      const translated = await completeJson({
        kind: "translate",
        schema: translationBatchSchema,
        system: translate.system,
        user: translate.user,
      })
      const byNorm = new Map(translated.items.map((item) => [normalizeTurkish(item.turkish), item]))
      for (const row of missing) {
        const item = byNorm.get(row.normalized)
        if (!item?.meanings?.[0]) continue
        row.english = item.meanings[0]
        row.extraMeanings = item.meanings.slice(1)
        row.partOfSpeech = item.partOfSpeech ?? row.partOfSpeech
        row.cefrLevel = item.cefrLevel ?? row.cefrLevel
      }
    }

    const preview = await previewParsed(parsed)
    return ok({
      note: extracted.note,
      found: extracted.words.length,
      preview,
    })
  } catch (error) {
    return fail(error)
  }
}
