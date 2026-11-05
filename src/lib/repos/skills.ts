import type { SrsCard } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { emptySrsCard, fromFsrsCard, schedule, toFsrsCard } from "@/lib/srs/scheduler"
import { ratingFromSkillResult } from "@/lib/speech/compare"
import type { EvalResult, ModalitySkill, Skill, SrsRating, VocabFace } from "@/lib/types"
import { MODALITY_SKILLS, VOCAB_FACES } from "@/lib/types"

const RATING_NUM: Record<SrsRating, number> = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
}

export async function applySkillReview(options: {
  wordId: string
  skill: Skill
  result: EvalResult
  source: string
  rating?: SrsRating
}) {
  const rating = options.rating ?? ratingFromSkillResult(options.result)
  const existing = await prisma.wordSkill.findUnique({
    where: { wordId_skill: { wordId: options.wordId, skill: options.skill } },
  })
  const now = new Date()
  const card = existing
    ? toFsrsCard({
        wordId: options.wordId,
        due: existing.due,
        stability: existing.stability,
        difficulty: existing.difficulty,
        elapsedDays: existing.elapsedDays,
        scheduledDays: existing.scheduledDays,
        learningSteps: existing.learningSteps,
        reps: existing.reps,
        lapses: existing.lapses,
        state: existing.state,
        lastReview: existing.lastReview,
      } as SrsCard)
    : emptySrsCard(now)
  const scheduled = schedule(card, rating, now)
  const stored = fromFsrsCard(options.wordId, scheduled.card)
  const { wordId: _wordId, ...cardFields } = stored
  const passed = options.result === "correct" || options.result === "spelling"

  await prisma.$transaction([
    prisma.wordSkill.upsert({
      where: { wordId_skill: { wordId: options.wordId, skill: options.skill } },
      update: {
        ...cardFields,
        reviewCount: { increment: 1 },
        correctCount: passed ? { increment: 1 } : undefined,
        lastReviewedAt: now,
        nextReviewAt: scheduled.card.due,
      },
      create: {
        wordId: options.wordId,
        skill: options.skill,
        reviewCount: 1,
        correctCount: passed ? 1 : 0,
        lastReviewedAt: now,
        nextReviewAt: scheduled.card.due,
        due: stored.due,
        stability: stored.stability,
        difficulty: stored.difficulty,
        elapsedDays: stored.elapsedDays,
        scheduledDays: stored.scheduledDays,
        learningSteps: stored.learningSteps,
        reps: stored.reps,
        lapses: stored.lapses,
        state: stored.state,
        lastReview: stored.lastReview,
      },
    }),
    prisma.skillLog.create({
      data: {
        wordId: options.wordId,
        skill: options.skill,
        rating: RATING_NUM[rating],
        result: options.result,
        source: options.source,
      },
    }),
  ])
}

async function summarizeSkill(skill: Skill) {
  const now = new Date()
  const [logs, due, totals] = await Promise.all([
    prisma.skillLog.groupBy({
      by: ["result"],
      where: { skill },
      _count: true,
    }),
    prisma.wordSkill.count({ where: { skill, nextReviewAt: { lte: now } } }),
    prisma.wordSkill.aggregate({
      where: { skill },
      _sum: { reviewCount: true, correctCount: true },
    }),
  ])
  const correct = logs
    .filter((row) => row.result === "correct" || row.result === "spelling")
    .reduce((sum, row) => sum + row._count, 0)
  const total = logs.reduce((sum, row) => sum + row._count, 0)
  return {
    skill,
    attempts: total,
    due,
    reviewCount: totals._sum.reviewCount ?? 0,
    correctCount: totals._sum.correctCount ?? 0,
    accuracy: total ? Math.round((correct / total) * 100) : null,
  }
}

export async function skillSummary() {
  return Promise.all((MODALITY_SKILLS as readonly ModalitySkill[]).map((skill) => summarizeSkill(skill)))
}

export async function vocabFaceSummary() {
  return Promise.all((VOCAB_FACES as readonly VocabFace[]).map((skill) => summarizeSkill(skill)))
}
