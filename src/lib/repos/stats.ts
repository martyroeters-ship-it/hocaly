import { prisma } from "@/lib/prisma"
import { addDays, startOfDay, todayKey } from "@/lib/dates"
import { skillSummary, vocabFaceSummary } from "@/lib/repos/skills"
import { State } from "ts-fsrs"
import { isMature, MATURE_INTERVAL_DAYS, retrievability, toFsrsCard } from "@/lib/srs/scheduler"

const CEFR_TARGETS: Record<string, number> = {
  A1: 500,
  A2: 1000,
  B1: 2000,
  B2: 4000,
  C1: 8000,
  C2: 16000,
}

export async function dashboardStats() {
  const now = new Date()
  const today = todayKey(now)
  const weekAgo = addDays(startOfDay(now), -7)
  const yearAgo = addDays(startOfDay(now), -120)

  const [
    total,
    byStatus,
    due,
    overdue,
    weekWords,
    day,
    usage,
    speechUsage,
    cefrGroups,
    heat,
    cards,
    newAvailable,
    settings,
  ] = await Promise.all([
    prisma.word.count(),
    prisma.word.groupBy({ by: ["learningStatus"], _count: true }),
    prisma.word.count({ where: { nextReviewAt: { lte: now } } }),
    prisma.word.count({ where: { nextReviewAt: { lt: startOfDay(now) } } }),
    prisma.word.count({
      where: { introducedOn: { not: null }, lastReviewedAt: { gte: weekAgo } },
    }),
    prisma.studyDay.findUnique({ where: { date: today } }),
    prisma.tokenUsage.aggregate({
      _sum: { estimatedUsd: true, inputTokens: true, outputTokens: true },
    }),
    prisma.speechUsage.aggregate({
      _sum: { estimatedUsd: true, units: true },
    }),
    prisma.word.groupBy({ by: ["cefrLevel"], _count: true }),
    prisma.studyDay.findMany({
      where: { date: { gte: todayKey(yearAgo) } },
      orderBy: { date: "asc" },
    }),
    prisma.srsCard.findMany(),
    prisma.word.count({ where: { learningStatus: "new", nextReviewAt: null } }),
    prisma.settings.findUnique({ where: { id: "default" } }),
  ])

  const statusCount = Object.fromEntries(byStatus.map((row) => [row.learningStatus, row._count]))
  const recentDays = await prisma.studyDay.findMany({
    where: { date: { lte: today } },
    orderBy: { date: "desc" },
    take: 60,
  })
  let streak = 0
  for (const row of recentDays) {
    if (row.reviewsDone + row.newLearned <= 0) break
    streak += 1
  }

  const reviewed = (statusCount.learning ?? 0) + (statusCount.reviewing ?? 0) + (statusCount.mastered ?? 0)
  const accuracy =
    day && day.correct + day.incorrect > 0
      ? Math.round((day.correct / (day.correct + day.incorrect)) * 100)
      : null

  const cefrCoverage = Object.entries(CEFR_TARGETS).map(([level, target]) => {
    const known = cefrGroups
      .filter((row) => row.cefrLevel && ["A1", "A2", "B1", "B2", "C1", "C2"].indexOf(row.cefrLevel) >= 0)
      .filter(
        (row) =>
          ["A1", "A2", "B1", "B2", "C1", "C2"].indexOf(row.cefrLevel!) <=
          ["A1", "A2", "B1", "B2", "C1", "C2"].indexOf(level),
      )
      .reduce((sum, row) => sum + row._count, 0)
    return {
      level,
      target,
      known,
      ratio: Math.min(1, known / target),
    }
  })

  let mature = 0
  let learningCards = 0
  let reviewingCards = 0
  let difficult = 0
  let retentionSum = 0
  let retentionCount = 0
  for (const row of cards) {
    const card = toFsrsCard(row)
    if (isMature(card)) mature += 1
    else if (card.state === State.Learning || card.state === State.Relearning) learningCards += 1
    else if (card.state === State.Review) reviewingCards += 1
    if (row.lapses >= 4) difficult += 1
    const R = retrievability(card, now)
    if (R != null) {
      retentionSum += R
      retentionCount += 1
    }
  }

  const newLimit = settings?.newWordsPerDay ?? 10
  const newAlready = day?.newLearned ?? 0
  const pauseNewWhenOverdue = settings?.pauseNewWhenOverdue ?? 40
  const pauseNew = pauseNewWhenOverdue > 0 && overdue >= pauseNewWhenOverdue
  const newWordsToday = pauseNew ? 0 : Math.max(0, Math.min(newLimit - newAlready, newAvailable))

  const faces = await vocabFaceSummary()
  const recognition = faces.find((item) => item.skill === "recognition")
  const production = faces.find((item) => item.skill === "production")

  return {
    total,
    newWords: statusCount.new ?? 0,
    learning: statusCount.learning ?? 0,
    reviewing: statusCount.reviewing ?? 0,
    mastered: statusCount.mastered ?? 0,
    mature,
    learningCards,
    reviewingCards,
    notIntroduced: statusCount.new ?? 0,
    due,
    overdue,
    difficult,
    newWordsToday,
    newLimit,
    newAvailable,
    pauseNew,
    estimatedRetention:
      retentionCount > 0 ? Math.round((retentionSum / retentionCount) * 100) : null,
    matureIntervalDays: MATURE_INTERVAL_DAYS,
    recognition: recognition
      ? { accuracy: recognition.accuracy, attempts: recognition.attempts, due: recognition.due }
      : { accuracy: null, attempts: 0, due: 0 },
    production: production
      ? { accuracy: production.accuracy, attempts: production.attempts, due: production.due }
      : { accuracy: null, attempts: 0, due: 0 },
    streak,
    accuracy,
    wordsThisWeek: weekWords,
    studySeconds: day?.seconds ?? 0,
    reviewsToday: day?.reviewsDone ?? 0,
    cefrCoverage,
    heatmap: heat,
    tokenUsage: {
      input: usage._sum.inputTokens ?? 0,
      output: usage._sum.outputTokens ?? 0,
      estimatedUsd: usage._sum.estimatedUsd ?? 0,
    },
    speechUsage: {
      units: speechUsage._sum.units ?? 0,
      estimatedUsd: speechUsage._sum.estimatedUsd ?? 0,
    },
    skills: await skillSummary(),
    faces,
    reviewed,
  }
}
