import { readFileSync } from "node:fs"
import path from "node:path"
import { prisma } from "@/lib/prisma"
import { emptySrsCard } from "@/lib/srs/scheduler"
import { normalizeTurkish } from "@/lib/turkish"

type CurriculumWord = {
  turkish: string
  english: string
  partOfSpeech?: string
  frequencyRank?: number
  collocations?: string[]
  grammarNotes?: string
}

type CurriculumPack = {
  cefr: string
  cefrSource?: string
  source?: string
  words: CurriculumWord[]
}

function loadA1Core(): CurriculumPack {
  const file = path.join(process.cwd(), "data", "curriculum", "a1-core.json")
  return JSON.parse(readFileSync(file, "utf8")) as CurriculumPack
}

export async function seedSampleVocabulary() {
  const pack = loadA1Core()
  const empty = emptySrsCard()
  let created = 0
  for (const item of pack.words) {
    const normalized = normalizeTurkish(item.turkish)
    const existing = await prisma.word.findUnique({ where: { turkishNormalized: normalized } })
    if (existing) continue
    await prisma.word.create({
      data: {
        turkish: item.turkish,
        turkishNormalized: normalized,
        dictionaryForm: item.turkish,
        dictionaryNormalized: normalized,
        partOfSpeech: item.partOfSpeech ?? null,
        cefrLevel: pack.cefr,
        cefrSource: pack.cefrSource ?? "estimate",
        frequencyRank: item.frequencyRank ?? null,
        collocationsJson: item.collocations?.length ? JSON.stringify(item.collocations) : null,
        grammarNotes: item.grammarNotes ?? null,
        notes: pack.source ? `Curriculum: ${pack.source}` : null,
        meanings: { create: { english: item.english, isPrimary: true } },
        tags: {
          create: [
            {
              tag: {
                connectOrCreate: {
                  where: { name: `curriculum:${pack.cefr.toLowerCase()}` },
                  create: { name: `curriculum:${pack.cefr.toLowerCase()}` },
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
    created += 1
  }
  return { created, pack: "a1-core-v1" }
}
