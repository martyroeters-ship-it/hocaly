import { z } from "zod"
import { fail, ok, readBody } from "@/lib/api"
import { completeJson } from "@/lib/ai/provider"
import { ensureDb, prisma } from "@/lib/prisma"
import { parseTranscriptText } from "@/lib/transcripts/parse"
import {
  dedupeTranscriptQuizItems,
  prioritizeWordsForGloss,
  selectTranscriptQuizItems,
} from "@/lib/transcripts/quiz"
import { normalizeTurkish } from "@/lib/turkish"
import { emptySrsCard } from "@/lib/srs/scheduler"

const QUIZ_SIZE = 12
const GLOSS_BATCH = 18
const GLOSS_MAX = 36

const transcriptGlossSchema = z.object({
  items: z.array(
    z.object({
      turkish: z.string().min(1),
      english: z.string().min(1),
    }),
  ),
})

export async function GET() {
  try {
    await ensureDb()
    const items = await prisma.transcript.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        sentences: {
          orderBy: { index: "asc" },
          include: { targets: true },
        },
      },
      take: 30,
    })
    return ok({
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        cefrLevel: item.cefrLevel,
        source: item.source,
        createdAt: item.createdAt.toISOString(),
        sentenceCount: item.sentences.length,
        targetCount: item.sentences.reduce((sum, row) => sum + row.targets.length, 0),
      })),
    })
  } catch (error) {
    return fail(error)
  }
}

async function translateBatch(words: string[]) {
  if (!words.length) return new Map<string, string>()
  const result = await completeJson({
    kind: "transcript-gloss",
    schema: transcriptGlossSchema,
    system: `You gloss Turkish words/forms for English learners.
Return JSON only: { "items": [ { "turkish": "...", "english": "..." } ] }.
Keep each "turkish" EXACTLY as given (same spelling/inflection).
"english" is a short natural gloss for that surface form in everyday speech (e.g. gidiyorum → I am going).`,
    user: JSON.stringify({ words }),
    cache: true,
    timeoutMs: 45_000,
  })
  const map = new Map<string, string>()
  for (const item of result.items ?? []) {
    const english = item.english.trim()
    if (!english) continue
    map.set(normalizeTurkish(item.turkish), english)
  }
  // Prefer index alignment when the model rewrites Turkish slightly
  words.forEach((word, index) => {
    const key = normalizeTurkish(word)
    if (map.has(key)) return
    const english = result.items?.[index]?.english?.trim()
    if (english) map.set(key, english)
  })
  return map
}

async function resolveMeanings(words: string[]) {
  const meanings = new Map<string, string>()
  if (!words.length) return meanings

  const ranked = prioritizeWordsForGloss(words)
  const normalized = ranked.map((word) => ({ word, key: normalizeTurkish(word) }))
  const existing = await prisma.word.findMany({
    where: { turkishNormalized: { in: normalized.map((item) => item.key) } },
    include: { meanings: { orderBy: { isPrimary: "desc" } } },
  })
  for (const word of existing) {
    const english = word.meanings.find((item) => item.isPrimary)?.english ?? word.meanings[0]?.english ?? ""
    if (english) meanings.set(word.turkishNormalized, english)
  }

  const missing = [
    ...new Map(normalized.filter((item) => !meanings.get(item.key)).map((item) => [item.key, item])).values(),
  ].slice(0, GLOSS_MAX)
  if (!missing.length) return meanings

  for (let i = 0; i < missing.length; i += GLOSS_BATCH) {
    const chunk = missing.slice(i, i + GLOSS_BATCH)
    try {
      const batch = await translateBatch(chunk.map((item) => item.word))
      for (const item of chunk) {
        const english = batch.get(item.key)
        if (english) meanings.set(item.key, english)
      }
    } catch {
      // Quiz still starts with whatever we already resolved
      break
    }
  }
  return meanings
}

function toQuizItems(
  sentences: {
    id: string
    turkish: string
    targets: { id: string; turkish: string; english: string | null; start: number | null; end: number | null }[]
  }[],
) {
  return sentences.flatMap((sentence) =>
    sentence.targets
      .filter((target) => {
        const english = (target.english ?? "").trim()
        return english.length > 0 && normalizeTurkish(english) !== normalizeTurkish(target.turkish)
      })
      .map((target) => ({
        targetId: target.id,
        sentenceId: sentence.id,
        sentence: sentence.turkish,
        start: target.start ?? 0,
        end: target.end ?? target.turkish.length,
        turkish: target.turkish,
        english: (target.english ?? "").trim(),
      })),
  )
}

export async function POST(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{
      action?: string
      title?: string
      text?: string
      cefrLevel?: string
      source?: string
      transcriptId?: string
      targetId?: string
    }>(request)

    if (body.action === "quiz" && body.transcriptId) {
      const transcript = await prisma.transcript.findUnique({
        where: { id: body.transcriptId },
        include: {
          sentences: { orderBy: { index: "asc" }, include: { targets: true } },
        },
      })
      if (!transcript) throw new Error("Transcript not found")
      const items = dedupeTranscriptQuizItems(toQuizItems(transcript.sentences))
      if (!items.length) throw new Error("No quiz-ready words for this transcript yet")
      // Full unique pool — client samples with diversity + avoids the previous run.
      return ok({ title: transcript.title, items })
    }

    if (body.action === "save-target" && body.targetId) {
      const target = await prisma.transcriptTarget.findUnique({
        where: { id: body.targetId },
        include: { sentence: true },
      })
      if (!target) throw new Error("Target not found")
      const normalized = normalizeTurkish(target.turkish)
      let word = await prisma.word.findUnique({ where: { turkishNormalized: normalized } })
      if (!word) {
        const empty = emptySrsCard()
        const english = target.english?.trim() && target.english !== target.turkish ? target.english : "needs translation"
        word = await prisma.word.create({
          data: {
            turkish: target.turkish,
            turkishNormalized: normalized,
            dictionaryForm: target.turkish,
            dictionaryNormalized: normalized,
            cefrLevel: null,
            cefrSource: "user",
            meanings: { create: { english, isPrimary: true } },
            examples: {
              create: {
                turkish: target.sentence.turkish,
                english: english === "needs translation" ? "" : english,
                highlight: target.turkish,
                source: "transcript",
              },
            },
            tags: {
              create: [
                {
                  tag: {
                    connectOrCreate: {
                      where: { name: "from-transcript" },
                      create: { name: "from-transcript" },
                    },
                  },
                },
              ],
            },
            card: {
              create: {
                due: empty.due,
                stability: empty.stability,
                difficulty: empty.difficulty,
                elapsedDays: empty.elapsed_days,
                scheduledDays: empty.scheduled_days,
                learningSteps: empty.learning_steps,
                reps: empty.reps,
                lapses: empty.lapses,
                state: "New",
              },
            },
          },
        })
      }
      await prisma.transcriptTarget.update({ where: { id: target.id }, data: { wordId: word.id } })
      return ok({ wordId: word.id, turkish: word.turkish })
    }

    const text = (body.text ?? "").trim()
    if (!text) throw new Error("Paste a transcript first")
    const title = (body.title ?? "Video transcript").trim() || "Video transcript"
    const parsed = parseTranscriptText(text)
    if (!parsed.length) throw new Error("No sentences found in that transcript")

    const unique = [...new Set(parsed.flatMap((row) => row.targets.map((item) => item.turkish)))]
    if (!unique.length) {
      throw new Error("Found sentences, but no quiz words. Try a longer transcript with content words.")
    }

    const meanings = await resolveMeanings(unique)

    const transcript = await prisma.transcript.create({
      data: {
        title,
        cefrLevel: body.cefrLevel ?? null,
        source: body.source ?? null,
        rawText: text,
        sentences: {
          create: parsed.map((sentence) => ({
            index: sentence.index,
            turkish: sentence.turkish,
            targets: {
              create: sentence.targets.map((target) => ({
                turkish: target.turkish,
                english: meanings.get(normalizeTurkish(target.turkish)) || "",
                start: target.start,
                end: target.end,
              })),
            },
          })),
        },
      },
      include: {
        sentences: {
          orderBy: { index: "asc" },
          include: { targets: true },
        },
      },
    })

    const allQuizItems = toQuizItems(transcript.sentences)

    if (!allQuizItems.length) {
      throw new Error(
        "Extracted words, but couldn’t resolve English meanings yet. Try again in a moment, or paste a shorter transcript.",
      )
    }

    const quizItems = selectTranscriptQuizItems(allQuizItems, Math.min(QUIZ_SIZE, allQuizItems.length))

    return ok({
      id: transcript.id,
      title: transcript.title,
      sentenceCount: transcript.sentences.length,
      targetCount: transcript.sentences.reduce((sum, row) => sum + row.targets.length, 0),
      translatedCount: allQuizItems.length,
      quizItems,
    })
  } catch (error) {
    return fail(error)
  }
}

