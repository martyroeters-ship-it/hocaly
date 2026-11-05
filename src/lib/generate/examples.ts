import { completeJson } from "@/lib/ai/provider"
import { wordExamplesPrompt } from "@/lib/ai/prompts"
import { wordExamplesSchema } from "@/lib/ai/schemas"
import { parseCefrLevel } from "@/lib/cefr"
import { fallbackCombinedSentence } from "@/lib/generate/fallback"
import { prisma } from "@/lib/prisma"
import { containsWord, looksLikeVerb, normalizeTurkish } from "@/lib/turkish"

export const EXAMPLE_SOURCE = "ai-v2"

export type WordForExample = {
  id: string
  turkish: string
  partOfSpeech: string | null
  meanings: { english: string; isPrimary: boolean }[]
  examples: {
    id?: string
    turkish: string
    english: string
    highlight?: string | null
    source?: string | null
    favorite?: boolean
  }[]
}

export type EnsuredExample = {
  id: string
  turkish: string
  english: string
  highlight: string | null
  reused: boolean
}

type ExamplePair = { turkish: string; english: string }

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function looksLikeBrokenExample(
  example: ExamplePair,
  word?: { turkish?: string; english?: string; partOfSpeech?: string | null },
) {
  const turkish = example.turkish.trim()
  const english = example.english.trim()
  if (!turkish || !english) return true
  const blob = `${turkish} ${english}`
  if (/kullanıyorum|i am using\b|comes to mind|aklıma geliyor/i.test(blob)) return true
  if (/\b(çok )?önemlidir\.?$/i.test(turkish) || /\bis important\.?$/i.test(english)) return true
  if (/^(this word|bu kelime)\b/i.test(turkish) || /^this word\b/i.test(english)) return true
  if ((english.match(/,/g) ?? []).length >= 2 && !/[.!?']/.test(english) && english.length < 60) return true
  if (/\b(addiction|habit|dependence) to health\b/i.test(english)) return true
  if (/\bcreates? a\b[^.]{0,48}\bto health\b/i.test(english)) return true
  if (/\bsağlığa\b/i.test(turkish) && /\bbağımlılık\b/i.test(turkish)) return true
  if (/^I am looking at\b/i.test(english)) return true
  if (/\bgörüyorum\.?$/i.test(turkish) && word?.english && !looksLikeVerb(word.turkish ?? "")) return true
  const sense = (word?.english ?? "").split(/[;,/]/)[0]?.replace(/^to\s+/i, "").trim() ?? ""
  if (sense.length >= 4) {
    const calque = new RegExp(`\\b${escapeRegExp(sense)}s? to health\\b`, "i")
    if (calque.test(english)) return true
  }
  return false
}

export function storedExample(word: WordForExample | Pick<WordForExample, "examples">): EnsuredExample | null {
  const existing = word.examples[0]
  if (!existing?.turkish?.trim() || !existing.english?.trim()) return null
  const full = "turkish" in word && "meanings" in word ? (word as WordForExample) : null
  if (
    looksLikeBrokenExample(existing, {
      turkish: full?.turkish,
      english: full ? englishOf(full) : undefined,
      partOfSpeech: full?.partOfSpeech,
    })
  ) {
    return null
  }
  if (!existing.favorite) {
    const source = existing.source ?? "ai"
    if (source !== EXAMPLE_SOURCE && source !== "user") return null
  }
  return {
    id: existing.id ?? "",
    turkish: existing.turkish,
    english: existing.english ?? "",
    highlight: existing.highlight ?? null,
    reused: true,
  }
}

export function shouldGenerateWordExample(word: WordForExample | Pick<WordForExample, "examples">, refresh = false) {
  return refresh || !storedExample(word)
}

function englishOf(word: WordForExample) {
  return word.meanings.find((item) => item.isPrimary)?.english ?? word.meanings[0]?.english ?? ""
}

function localExample(word: WordForExample) {
  return fallbackCombinedSentence([
    { turkish: word.turkish, english: englishOf(word), partOfSpeech: word.partOfSpeech },
  ])
}

function matchGeneratedWord(row: { word: string; turkish: string }, words: WordForExample[]) {
  return (
    words.find((item) => normalizeTurkish(item.turkish) === normalizeTurkish(row.word)) ??
    words.find((item) => containsWord(row.turkish, item.turkish) || containsWord(row.word, item.turkish))
  )
}

async function saveExample(
  wordId: string,
  turkish: string,
  english: string,
  source: string,
  cefr: string,
  favorite = false,
) {
  if (favorite) {
    await prisma.exampleSentence.updateMany({ where: { wordId }, data: { favorite: false } })
  }
  return prisma.exampleSentence.create({
    data: {
      wordId,
      turkish,
      english,
      cefrLevel: cefr,
      source,
      favorite,
    },
  })
}

async function requestExamples(
  words: WordForExample[],
  cefr: string,
  options?: { cache?: boolean; rejected?: { word: string; turkish: string; english: string }[] },
) {
  const prompt = wordExamplesPrompt(
    words.map((word) => ({
      turkish: word.turkish,
      english: englishOf(word),
      partOfSpeech: word.partOfSpeech,
    })),
    parseCefrLevel(cefr),
  )
  const user = options?.rejected?.length
    ? `${prompt.user}\n\nREJECTED previous drafts — rewrite until a native speaker would say the Turkish, and English is a real translation of it:\n${JSON.stringify(options.rejected)}`
    : prompt.user
  return completeJson({
    kind: "word-examples",
    schema: wordExamplesSchema,
    system: prompt.system,
    user,
    cache: options?.cache ?? true,
  })
}

export async function ensureWordExamples(
  words: WordForExample[],
  cefr: string,
  options?: { refresh?: boolean },
) {
  const refresh = Boolean(options?.refresh)
  const examples = new Map<string, EnsuredExample>()
  if (!refresh) {
    for (const word of words) {
      const existing = storedExample(word)
      if (existing) examples.set(word.id, existing)
    }
    const unchecked = words.filter((word) => !examples.has(word.id)).map((word) => word.id)
    if (unchecked.length) {
      const rows = await prisma.exampleSentence.findMany({
        where: { wordId: { in: unchecked } },
        orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
      })
      for (const row of rows) {
        if (examples.has(row.wordId) || !row.turkish.trim()) continue
        const word = words.find((item) => item.id === row.wordId)
        if (!word) continue
        const existing = storedExample({ ...word, examples: [row] })
        if (!existing) continue
        examples.set(row.wordId, existing)
      }
    }
  }

  const missing = words.filter((word) => !examples.has(word.id))
  if (missing.length) {
    try {
      const take = async (
        batch: WordForExample[],
        cache: boolean,
        rejected?: { word: string; turkish: string; english: string }[],
      ) => {
        const result = await requestExamples(batch, cefr, { cache, rejected })
        const rejectedRows: { word: string; turkish: string; english: string }[] = []
        for (const row of result.examples) {
          const word = matchGeneratedWord(row, batch)
          if (!word || examples.has(word.id)) continue
          const example = { turkish: row.turkish.trim(), english: row.english.trim() }
          const hint = { turkish: word.turkish, english: englishOf(word), partOfSpeech: word.partOfSpeech }
          if (!example.turkish || !example.english || looksLikeBrokenExample(example, hint)) {
            rejectedRows.push({ word: word.turkish, turkish: example.turkish, english: example.english })
            continue
          }
          const saved = await saveExample(word.id, example.turkish, example.english, EXAMPLE_SOURCE, cefr, refresh)
          examples.set(word.id, {
            id: saved.id,
            turkish: saved.turkish,
            english: saved.english,
            highlight: saved.highlight,
            reused: false,
          })
        }
        return {
          leftover: batch.filter((word) => !examples.has(word.id)),
          rejectedRows,
        }
      }

      const first = await take(missing, !refresh)
      if (first.leftover.length) {
        await take(first.leftover, false, first.rejectedRows)
      }
    } catch (error) {
      console.warn("[marty] Gemini word examples failed; using local sentences.", error instanceof Error ? error.message : error)
    }
  }

  for (const word of missing) {
    if (examples.has(word.id)) continue
    const fallback = localExample(word)
    if (looksLikeBrokenExample(fallback, { turkish: word.turkish, english: englishOf(word), partOfSpeech: word.partOfSpeech })) continue
    const saved = await saveExample(word.id, fallback.turkish, fallback.english, "local-v2", cefr, refresh)
    examples.set(word.id, {
      id: saved.id,
      turkish: saved.turkish,
      english: saved.english,
      highlight: saved.highlight,
      reused: false,
    })
  }

  return examples
}
