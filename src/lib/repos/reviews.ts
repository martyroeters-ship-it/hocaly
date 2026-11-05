import { prisma } from "@/lib/prisma"
import { endOfDay, iso, startOfDay, todayKey } from "@/lib/dates"
import { evaluateAgainst, isPassing } from "@/lib/eval/match"
import { suggestVocabFace } from "@/lib/srs/faces"
import {
  derivedStatus,
  emptySrsCard,
  fromFsrsCard,
  isLeech,
  LEECH_LAPSES,
  schedule,
  toFsrsCard,
} from "@/lib/srs/scheduler"
import { serializeWord } from "@/lib/repos/words"
import { applySkillReview } from "@/lib/repos/skills"
import type { SrsRating, VocabFace } from "@/lib/types"

const wordInclude = {
  meanings: { orderBy: { isPrimary: "desc" as const } },
  tags: { include: { tag: true } },
  examples: { orderBy: [{ favorite: "desc" as const }, { createdAt: "desc" as const }] },
  card: true,
  skills: true,
}

const RATING_NUM: Record<SrsRating, number> = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
}

async function bumpStudyDay(passed: boolean, isNew: boolean, seconds = 0) {
  const date = todayKey()
  await prisma.studyDay.upsert({
    where: { date },
    update: {
      reviewsDone: { increment: 1 },
      ...(isNew ? { newLearned: { increment: 1 } } : {}),
      ...(passed ? { correct: { increment: 1 } } : { incorrect: { increment: 1 } }),
      seconds: { increment: seconds },
      minutes: { increment: Math.floor(seconds / 60) },
    },
    create: {
      date,
      reviewsDone: 1,
      newLearned: isNew ? 1 : 0,
      correct: passed ? 1 : 0,
      incorrect: passed ? 0 : 1,
      seconds,
      minutes: Math.floor(seconds / 60),
    },
  })
}

function withSuggestedFace(
  word: Awaited<ReturnType<typeof prisma.word.findUniqueOrThrow>> & {
    skills: {
      skill: string
      nextReviewAt: Date | null
      reviewCount: number
      correctCount: number
      lapses: number
      stability: number
      state: string
    }[]
    card: Parameters<typeof serializeWord>[0]["card"]
    meanings: { english: string; isPrimary: boolean }[]
    tags: { tag: { name: string } }[]
    examples: { id: string; turkish: string; english: string; highlight: string | null; favorite: boolean }[]
  },
) {
  const item = serializeWord(word)
  const faceSkills = word.skills
    .filter((skill) => skill.skill === "recognition" || skill.skill === "production")
    .map((skill) => ({
      skill: skill.skill as VocabFace,
      nextReviewAt: skill.nextReviewAt,
      reviewCount: skill.reviewCount,
      correctCount: skill.correctCount,
      lapses: skill.lapses,
      stability: skill.stability,
      state: skill.state,
    }))
  return { ...item, suggestedFace: suggestVocabFace(faceSkills) }
}

export async function applyReview(
  wordId: string,
  rating: SrsRating,
  source = "review",
  seconds = 0,
  options?: { clientKey?: string; face?: VocabFace },
) {
  const word = await prisma.word.findUnique({
    where: { id: wordId },
    include: { card: true, meanings: true },
  })
  if (!word) throw new Error("Word not found")

  if (options?.clientKey) {
    const existing = await prisma.reviewLog.findUnique({ where: { clientKey: options.clientKey } })
    if (existing) {
      const updated = await prisma.word.findUniqueOrThrow({ where: { id: wordId }, include: wordInclude })
      return withSuggestedFace(updated)
    }
  }

  const now = new Date()
  const wasNew = word.learningStatus === "new" || !word.card || word.card.state === "New"
  const card = word.card ? toFsrsCard(word.card) : emptySrsCard(now)
  const scheduled = schedule(card, rating, now)
  const nextCount = word.reviewCount + 1
  let status = derivedStatus(scheduled.card, nextCount)
  if (word.learningStatus === "mastered" && rating !== "again") status = "mastered"
  const passed = rating !== "again"
  const stored = fromFsrsCard(wordId, scheduled.card)
  const face = options?.face ?? "recognition"

  await prisma.$transaction([
    prisma.srsCard.upsert({
      where: { wordId },
      update: stored,
      create: stored,
    }),
    prisma.reviewLog.create({
      data: {
        wordId,
        rating: RATING_NUM[rating],
        state: stored.state,
        due: stored.due,
        stability: stored.stability,
        difficulty: stored.difficulty,
        elapsedDays: stored.elapsedDays,
        scheduledDays: stored.scheduledDays,
        source,
        face,
        clientKey: options?.clientKey ?? null,
      },
    }),
    prisma.word.update({
      where: { id: wordId },
      data: {
        reviewCount: { increment: 1 },
        correctCount: passed ? { increment: 1 } : undefined,
        lastReviewedAt: now,
        nextReviewAt: scheduled.card.due,
        learningStatus: status,
        introducedOn: word.introducedOn ?? todayKey(now),
      },
    }),
  ])

  await applySkillReview({
    wordId,
    skill: face,
    result: passed ? (rating === "hard" ? "spelling" : "correct") : "incorrect",
    source,
    rating,
  })

  await bumpStudyDay(passed, wasNew, seconds)
  const updated = await prisma.word.findUniqueOrThrow({ where: { id: wordId }, include: wordInclude })
  return withSuggestedFace(updated)
}

export async function checkProductionAnswer(wordId: string, given: string) {
  const word = await prisma.word.findUnique({
    where: { id: wordId },
    include: { meanings: true },
  })
  if (!word) throw new Error("Word not found")
  const accepted = [word.turkish, word.dictionaryForm].filter(Boolean) as string[]
  const { result, matched } = evaluateAgainst(given, accepted, "tr")
  return { result, matched, expected: word.turkish, passing: isPassing(result) }
}

export async function resetWordProgress(wordId: string) {
  const empty = emptySrsCard()
  const stored = fromFsrsCard(wordId, empty)
  await prisma.$transaction([
    prisma.reviewLog.deleteMany({ where: { wordId } }),
    prisma.skillLog.deleteMany({ where: { wordId, skill: { in: ["recognition", "production"] } } }),
    prisma.wordSkill.deleteMany({ where: { wordId, skill: { in: ["recognition", "production"] } } }),
    prisma.srsCard.upsert({ where: { wordId }, update: stored, create: stored }),
    prisma.word.update({
      where: { id: wordId },
      data: {
        learningStatus: "new",
        reviewCount: 0,
        correctCount: 0,
        lastReviewedAt: null,
        nextReviewAt: null,
        introducedOn: null,
      },
    }),
  ])
}

export async function studyQueue() {
  const now = new Date()
  const settings = await prisma.settings.findUnique({ where: { id: "default" } })
  const newLimit = settings?.newWordsPerDay ?? 10
  const pauseNewWhenOverdue = settings?.pauseNewWhenOverdue ?? 40
  const today = todayKey(now)
  const day = await prisma.studyDay.findUnique({ where: { date: today } })
  const workflow = await prisma.dailyWorkflow.findUnique({ where: { date: today } })
  const newAlready = day?.newLearned ?? 0

  const due = await prisma.word.findMany({
    where: { nextReviewAt: { lte: endOfDay(now) } },
    include: wordInclude,
    orderBy: { nextReviewAt: "asc" },
  })

  const overdue = due.filter((word) => word.nextReviewAt && word.nextReviewAt < startOfDay(now))
  const dueToday = due.filter((word) => word.nextReviewAt && word.nextReviewAt >= startOfDay(now))
  const pauseNew = pauseNewWhenOverdue > 0 && overdue.length >= pauseNewWhenOverdue
  const remainingNew = pauseNew ? 0 : Math.max(0, newLimit - newAlready)
  const news = remainingNew
    ? await prisma.word.findMany({
        where: { learningStatus: "new", nextReviewAt: null },
        include: wordInclude,
        orderBy: [{ frequencyRank: "asc" }, { createdAt: "asc" }],
        take: remainingNew,
      })
    : []

  const difficultRows = await prisma.srsCard.findMany({
    where: {
      OR: [{ lapses: { gte: Math.max(3, LEECH_LAPSES - 4) } }, { difficulty: { gte: 8 } }],
    },
    orderBy: [{ lapses: "desc" }, { difficulty: "desc" }],
    take: 30,
    include: {
      word: { include: wordInclude },
    },
  })
  const dueIds = new Set(due.map((word) => word.id))
  const difficult = difficultRows
    .filter((row) => isLeech(toFsrsCard(row), 4) || row.difficulty >= 8)
    .map((row) => row.word)
    .filter((word) => !dueIds.has(word.id) && word.learningStatus !== "new")
    .slice(0, 12)

  const sentenceCandidates = await prisma.word.findMany({
    where: {
      learningStatus: { in: ["learning", "reviewing", "mastered"] },
      OR: [{ lastReviewedAt: { gte: startOfDay(now) } }, { introducedOn: today }],
    },
    include: wordInclude,
    orderBy: { lastReviewedAt: "desc" },
    take: 20,
  })

  return {
    overdue: overdue.map(withSuggestedFace),
    dueToday: dueToday.map(withSuggestedFace),
    news: news.map(withSuggestedFace),
    difficult: difficult.map(withSuggestedFace),
    sentenceCandidates: sentenceCandidates.map(withSuggestedFace),
    newLimit,
    newAlready,
    pauseNew,
    overdueCount: overdue.length,
    pauseNewWhenOverdue,
    recommendPauseNew: pauseNew,
    workflow: workflow ?? {
      date: today,
      reviewsDone: false,
      newDone: false,
      sentencesDone: false,
      testDone: false,
      storyDone: false,
      pausedJson: null,
    },
    day: day ?? { date: today, minutes: 0, seconds: 0, reviewsDone: 0, newLearned: 0, correct: 0, incorrect: 0 },
  }
}

export async function saveWorkflow(data: {
  reviewsDone?: boolean
  newDone?: boolean
  sentencesDone?: boolean
  testDone?: boolean
  storyDone?: boolean
  pausedJson?: string | null
}) {
  const date = todayKey()
  return prisma.dailyWorkflow.upsert({
    where: { date },
    update: data,
    create: { date, ...data },
  })
}

export async function addStudyTime(seconds: number) {
  const date = todayKey()
  await prisma.studyDay.upsert({
    where: { date },
    update: {
      seconds: { increment: seconds },
      minutes: { increment: Math.floor(seconds / 60) },
    },
    create: { date, seconds, minutes: Math.floor(seconds / 60) },
  })
}

export { iso }
