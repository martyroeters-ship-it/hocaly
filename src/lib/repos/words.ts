import { prisma } from "@/lib/prisma"
import { iso } from "@/lib/dates"
import { markFileDuplicates, parseImport, suggestedDictionaryForm } from "@/lib/import/parse"
import { normalizeTurkish } from "@/lib/turkish"
import { parseLabels } from "@/lib/labels"
import type { ImportPreviewRow, LearningStatus, WordListItem } from "@/lib/types"
import { emptySrsCard, retrievability, toFsrsCard } from "@/lib/srs/scheduler"
import type { SrsCard } from "@prisma/client"

function primaryEnglish(meanings: { english: string; isPrimary: boolean }[]): string {
  return meanings.find((item) => item.isPrimary)?.english ?? meanings[0]?.english ?? ""
}

function parseCollocations(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => String(item).trim()).filter(Boolean)
  } catch {
    return raw
      .split(/[;|]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
}

export function serializeWord(word: {
  id: string
  turkish: string
  dictionaryForm: string | null
  partOfSpeech: string | null
  cefrLevel: string | null
  cefrSource?: string | null
  frequencyRank?: number | null
  collocationsJson?: string | null
  grammarNotes?: string | null
  learningStatus: string
  reviewCount: number
  correctCount: number
  nextReviewAt: Date | null
  lastReviewedAt: Date | null
  notes: string | null
  meanings: { english: string; isPrimary: boolean }[]
  tags: { tag: { name: string } }[]
  examples: { id: string; turkish: string; english: string; highlight: string | null; favorite: boolean }[]
  card?: SrsCard | null
}): WordListItem {
  const example =
    word.examples.find((item) => item.favorite) ?? word.examples[0] ?? null
  const R = word.card ? retrievability(toFsrsCard(word.card)) : null
  return {
    id: word.id,
    turkish: word.turkish,
    dictionaryForm: word.dictionaryForm,
    english: primaryEnglish(word.meanings),
    meanings: word.meanings.map((item) => item.english),
    partOfSpeech: word.partOfSpeech,
    cefrLevel: word.cefrLevel,
    cefrSource: word.cefrSource ?? null,
    frequencyRank: word.frequencyRank ?? null,
    collocations: parseCollocations(word.collocationsJson),
    grammarNotes: word.grammarNotes ?? null,
    learningStatus: word.learningStatus,
    reviewCount: word.reviewCount,
    correctCount: word.correctCount,
    accuracy: word.reviewCount ? Math.round((word.correctCount / word.reviewCount) * 100) : null,
    nextReviewAt: iso(word.nextReviewAt),
    lastReviewedAt: iso(word.lastReviewedAt),
    tags: word.tags.map((item) => item.tag.name),
    example: example
      ? { id: example.id, turkish: example.turkish, english: example.english, highlight: example.highlight }
      : null,
    notes: word.notes,
    retrievability: R,
    lapses: word.card?.lapses,
    stability: word.card?.stability ?? null,
    difficulty: word.card?.difficulty ?? null,
  }
}

const wordInclude = {
  meanings: { orderBy: { isPrimary: "desc" as const } },
  tags: { include: { tag: true } },
  examples: { orderBy: [{ favorite: "desc" as const }, { createdAt: "desc" as const }] },
}

export async function listWords(options: {
  q?: string
  status?: string
  tag?: string
  sort?: string
  take?: number
  skip?: number
}) {
  const where = {
    AND: [
      options.q
        ? {
            OR: [
              { turkish: { contains: options.q } },
              { turkishNormalized: { contains: normalizeTurkish(options.q) } },
              { meanings: { some: { english: { contains: options.q } } } },
            ],
          }
        : {},
      options.status ? { learningStatus: options.status } : {},
      options.tag ? { tags: { some: { tag: { name: options.tag } } } } : {},
    ],
  }

  const orderBy =
    options.sort === "next"
      ? { nextReviewAt: "asc" as const }
      : options.sort === "reviews"
        ? { reviewCount: "desc" as const }
        : options.sort === "status"
          ? { learningStatus: "asc" as const }
          : { turkishNormalized: "asc" as const }

  const [items, total, labelRows] = await Promise.all([
    prisma.word.findMany({
      where,
      include: wordInclude,
      orderBy,
      take: options.take ?? 200,
      skip: options.skip ?? 0,
    }),
    prisma.word.count({ where }),
    prisma.tag.findMany({
      where: { words: { some: {} } },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ])

  return { total, items: items.map(serializeWord), labels: labelRows.map((row) => row.name) }
}

export async function previewImport(text: string, filename?: string): Promise<{
  rows: ImportPreviewRow[]
  total: number
  duplicates: number
  missingTranslation: number
}> {
  return previewParsed(markFileDuplicates(parseImport(text, filename)))
}

export async function previewParsed(
  parsed: ReturnType<typeof markFileDuplicates>,
): Promise<{
  rows: ImportPreviewRow[]
  total: number
  duplicates: number
  missingTranslation: number
}> {
  const normalized = parsed.map((row) => row.normalized).filter(Boolean)
  const existing = await prisma.word.findMany({
    where: { turkishNormalized: { in: normalized } },
    include: { meanings: true },
  })
  const existingMap = new Map(existing.map((word) => [word.turkishNormalized, word]))

  const rows: ImportPreviewRow[] = parsed.map((row) => {
    const found = existingMap.get(row.normalized)
    const existingEnglish = found ? primaryEnglish(found.meanings) : undefined
    const existingUserEdited = found?.userEdited ?? found?.meanings.some((m) => m.userEdited) ?? false
    let action: ImportPreviewRow["action"] = "create"
    if (row.duplicateInFile) action = "skip"
    else if (found && existingUserEdited) action = "skip"
    else if (found && row.english && row.english !== existingEnglish) action = "add-meaning"
    else if (found) action = "skip"
    else if (!row.english) action = "needs-translation"

    return {
      ...row,
      existingId: found?.id,
      existingEnglish,
      existingUserEdited,
      action,
    }
  })

  return {
    rows,
    total: rows.length,
    duplicates: rows.filter((row) => row.action === "skip").length,
    missingTranslation: rows.filter((row) => row.action === "needs-translation").length,
  }
}

function emptyCardCreate() {
  const empty = emptySrsCard()
  return {
    due: empty.due,
    stability: empty.stability,
    difficulty: empty.difficulty,
    elapsedDays: empty.elapsed_days,
    scheduledDays: empty.scheduled_days,
    learningSteps: empty.learning_steps,
    reps: empty.reps,
    lapses: empty.lapses,
    state: "New" as const,
  }
}

async function addTags(wordId: string, names: string[] | undefined) {
  const labels = parseLabels(names)
  for (const name of labels) {
    const tag = await prisma.tag.upsert({ where: { name }, update: {}, create: { name } })
    await prisma.wordTag.upsert({
      where: { wordId_tagId: { wordId, tagId: tag.id } },
      update: {},
      create: { wordId, tagId: tag.id },
    })
  }
}

export async function commitImport(rows: ImportPreviewRow[]) {
  let created = 0
  let updated = 0
  let skipped = 0

  for (const row of rows) {
    const labels = row.omitLabels ? [] : row.tags
    if (row.action === "skip" || row.duplicateInFile) {
      if (row.existingId) await addTags(row.existingId, labels)
      skipped += 1
      continue
    }
    const normalized = row.normalized
    const existing = await prisma.word.findUnique({
      where: { turkishNormalized: normalized },
      include: { meanings: true },
    })

    if (existing) {
      await addTags(existing.id, labels)
      if (existing.userEdited || existing.meanings.some((m) => m.userEdited)) {
        skipped += 1
        continue
      }
      if (row.english && !existing.meanings.some((m) => m.english.toLowerCase() === row.english!.toLowerCase())) {
        await prisma.meaning.create({
          data: { wordId: existing.id, english: row.english, isPrimary: existing.meanings.length === 0 },
        })
        updated += 1
      } else {
        skipped += 1
      }
      continue
    }

    const word = await prisma.word.create({
      data: {
        turkish: row.turkish,
        turkishNormalized: normalized,
        dictionaryForm: suggestedDictionaryForm(row),
        dictionaryNormalized: normalizeTurkish(suggestedDictionaryForm(row)),
        partOfSpeech: row.partOfSpeech,
        cefrLevel: row.cefrLevel,
        cefrSource: row.cefrSource ?? (row.cefrLevel ? "user" : null),
        frequencyRank: row.frequencyRank ?? null,
        collocationsJson: row.collocations?.length ? JSON.stringify(row.collocations) : null,
        grammarNotes: row.grammarNotes ?? null,
        notes: row.notes,
        meanings: row.english
          ? {
              create: [
                { english: row.english, isPrimary: true },
                ...(row.extraMeanings ?? []).map((english) => ({ english, isPrimary: false })),
              ],
            }
          : undefined,
        card: { create: emptyCardCreate() },
      },
    })

    await addTags(word.id, labels)
    if (row.context && row.english) {
      await prisma.exampleSentence.create({
        data: {
          wordId: word.id,
          turkish: row.context,
          english: row.english,
          highlight: row.highlightedForm ?? row.turkish,
          source: "photo",
        },
      })
    }
    created += 1
  }

  return { created, updated, skipped }
}

export async function updateWord(
  id: string,
  data: {
    turkish?: string
    english?: string
    meanings?: string[]
    partOfSpeech?: string | null
    cefrLevel?: string | null
    learningStatus?: LearningStatus
    notes?: string | null
    tags?: string[]
  },
) {
  const existing = await prisma.word.findUnique({ where: { id }, include: { meanings: true, tags: true } })
  if (!existing) throw new Error("Word not found")

  const turkish = data.turkish?.trim() ?? existing.turkish
  const normalized = normalizeTurkish(turkish)

  await prisma.$transaction(async (tx) => {
    await tx.word.update({
      where: { id },
      data: {
        turkish,
        turkishNormalized: normalized,
        partOfSpeech: data.partOfSpeech === undefined ? existing.partOfSpeech : data.partOfSpeech,
        cefrLevel: data.cefrLevel === undefined ? existing.cefrLevel : data.cefrLevel,
        learningStatus: data.learningStatus ?? existing.learningStatus,
        notes: data.notes === undefined ? existing.notes : data.notes,
        userEdited: data.english !== undefined || data.meanings !== undefined ? true : existing.userEdited,
      },
    })

    if (data.meanings || data.english) {
      const meanings = data.meanings?.length ? data.meanings : data.english ? [data.english] : []
      await tx.meaning.deleteMany({ where: { wordId: id } })
      if (meanings.length) {
        await tx.meaning.createMany({
          data: meanings.map((english, index) => ({
            wordId: id,
            english,
            isPrimary: index === 0,
            userEdited: true,
          })),
        })
      }
    }

    if (data.tags) {
      await tx.wordTag.deleteMany({ where: { wordId: id } })
      for (const name of parseLabels(data.tags)) {
        const tag = await tx.tag.upsert({ where: { name }, update: {}, create: { name } })
        await tx.wordTag.create({ data: { wordId: id, tagId: tag.id } })
      }
    }
  })

  const word = await prisma.word.findUniqueOrThrow({ where: { id }, include: wordInclude })
  return serializeWord(word)
}

export async function bulkUpdate(ids: string[], data: { learningStatus?: LearningStatus; tags?: string[]; deleteWords?: boolean }) {
  if (data.deleteWords) {
    await prisma.word.deleteMany({ where: { id: { in: ids } } })
    return { deleted: ids.length }
  }
  if (data.learningStatus) {
    await prisma.word.updateMany({ where: { id: { in: ids } }, data: { learningStatus: data.learningStatus } })
  }
  if (data.tags?.length) {
    for (const id of ids) {
      await addTags(id, data.tags)
    }
  }
  return { updated: ids.length }
}

export async function getWordsByIds(ids: string[]) {
  const words = await prisma.word.findMany({
    where: { id: { in: ids } },
    include: { ...wordInclude, card: true, forms: true },
  })
  return words
}
