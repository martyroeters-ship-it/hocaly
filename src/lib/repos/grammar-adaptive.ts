import { prisma } from "@/lib/prisma"
import { getStructure } from "@/lib/grammar"
import {
  applyStructureOutcome,
  assessmentBand,
  assessmentProgressForLevels,
  assessmentStructuresForLevels,
  ASSESSMENT_QUESTIONS_PER,
  ASSESSMENT_STRUCTURE_COUNT,
  DEFAULT_ADAPTIVE_SETTINGS,
  parseIntervalsJson,
  recommendedPracticeStructures,
  scoreStructureSession,
  selectAssessmentStructures,
  selectDiagnosticStructures,
  VERIFY_QUESTIONS_PER,
  type AdaptiveSettings,
  type AdaptiveSkillSnapshot,
  type AssessmentBand,
  type DiagnosticDayResult,
  type MasteryStatus,
  type StructureVerdict,
  classifyMistake,
} from "@/lib/grammar/adaptive"
import {
  buildPracticeMixForStructure,
  type ConjugationPrompt,
} from "@/lib/grammar/conjugate"
import {
  ASSESSMENT_BANK_VERSION,
  buildAssessmentBankItems,
} from "@/lib/grammar/assessment-bank"
import { evaluateAgainst, isPassing } from "@/lib/eval/match"
import { todayKey } from "@/lib/dates"
import type { CefrLevel } from "@/lib/types"

/** Daily diagnostic still uses 8×3; initial assessment is 8×4 (see adaptive constants). */
const DIAGNOSTIC_QUESTIONS_PER_STRUCTURE = 3

export type AdaptiveItem = ConjugationPrompt & {
  id: string
  index: number
  uncertainKey?: boolean
}

export type StructureScore = {
  structureId: string
  label: string
  correct: number
  total: number
  verdict: StructureVerdict
  band?: AssessmentBand
  needsContinue?: boolean
}

type SessionPayload = {
  structureIds: string[]
  items: AdaptiveItem[]
  answers: Array<{
    itemId: string
    structureId: string
    given: string
    expected: string
    result: string
    passed: boolean
    uncertainKey?: boolean
  }>
  structureScores: Record<string, StructureScore>
  recommendedPractice?: string[]
  yesterdayStructureIds?: string[]
  continueRounds?: Record<string, number>
  levels?: string[]
}

function toSnapshot(row: {
  structureId: string
  cefrLevel: string
  masteryStatus: string
  consecutiveCleanPasses: number
  nextReviewAt: Date | null
  lastDiagnosticAt: Date | null
  lastPracticeAt: Date | null
  recentCorrect: number
  recentTotal: number
  assessmentDone: boolean
  reviewCount: number
  correctCount: number
  focusScore: number
  diagnosticStreakDay: string | null
  lastDiagnosticDay: string | null
  lastDiagnosticResult: string | null
  byTypeJson: string
  mistakeJson: string
}): AdaptiveSkillSnapshot {
  return {
    structureId: row.structureId,
    cefrLevel: row.cefrLevel,
    masteryStatus: row.masteryStatus as MasteryStatus,
    consecutiveCleanPasses: row.consecutiveCleanPasses,
    nextReviewAt: row.nextReviewAt,
    lastDiagnosticAt: row.lastDiagnosticAt,
    lastPracticeAt: row.lastPracticeAt,
    recentCorrect: row.recentCorrect,
    recentTotal: row.recentTotal,
    assessmentDone: row.assessmentDone,
    reviewCount: row.reviewCount,
    correctCount: row.correctCount,
    focusScore: row.focusScore,
    diagnosticStreakDay: row.diagnosticStreakDay,
    lastDiagnosticDay: row.lastDiagnosticDay,
    lastDiagnosticResult:
      row.lastDiagnosticResult === "passed" ||
      row.lastDiagnosticResult === "attention" ||
      row.lastDiagnosticResult === "verify"
        ? (row.lastDiagnosticResult as DiagnosticDayResult)
        : null,
    byTypeJson: row.byTypeJson,
    mistakeJson: row.mistakeJson,
  }
}

export async function getAdaptiveSettings(): Promise<AdaptiveSettings> {
  const row = await prisma.grammarSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      intervalsJson: JSON.stringify(DEFAULT_ADAPTIVE_SETTINGS.intervals),
    },
  })
  return {
    diagnosticStructureCount: row.diagnosticStructureCount,
    questionsPerStructure: row.questionsPerStructure,
    practiceStructures: row.practiceStructures,
    practiceQuestionsPer: row.practiceQuestionsPer,
    intervals: parseIntervalsJson(row.intervalsJson),
  }
}

async function loadSkillSnapshots(): Promise<AdaptiveSkillSnapshot[]> {
  const rows = await prisma.grammarSkill.findMany()
  return rows.map(toSnapshot)
}

function parsePayload(raw: string): SessionPayload {
  try {
    const parsed = JSON.parse(raw || "{}") as Partial<SessionPayload>
    return {
      structureIds: parsed.structureIds ?? [],
      items: parsed.items ?? [],
      answers: parsed.answers ?? [],
      structureScores: parsed.structureScores ?? {},
      recommendedPractice: parsed.recommendedPractice,
      yesterdayStructureIds: parsed.yesterdayStructureIds,
      continueRounds: parsed.continueRounds ?? {},
      levels: parsed.levels,
    }
  } catch {
    return {
      structureIds: [],
      items: [],
      answers: [],
      structureScores: {},
      continueRounds: {},
    }
  }
}

function itemId(structureId: string, index: number) {
  return `${structureId}:${index}`
}

function toAdaptiveItems(seeds: ConjugationPrompt[], startIndex = 0): AdaptiveItem[] {
  return seeds.map((seed, offset) => {
    const index = startIndex + offset
    return {
      ...seed,
      id: itemId(seed.structureId, index),
      index,
      uncertainKey: seed.uncertainKey ?? false,
    }
  })
}

async function yesterdayDiagnosticStructureIds(): Promise<string[]> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const start = new Date(yesterday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(yesterday)
  end.setHours(23, 59, 59, 999)
  const sessions = await prisma.grammarSession.findMany({
    where: {
      kind: "diagnostic",
      createdAt: { gte: start, lte: end },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  })
  const ids = new Set<string>()
  for (const session of sessions) {
    const payload = parsePayload(session.payloadJson)
    for (const id of payload.structureIds) ids.add(id)
  }
  return [...ids]
}

function levelScopeCovers(scope: string, level: "A1" | "A2") {
  if (scope === "mix" || scope === "A1+A2") return true
  return scope.split("+").includes(level)
}

async function assessedStructureIds(): Promise<Set<string>> {
  const skills = await loadSkillSnapshots()
  return new Set(skills.filter((row) => row.assessmentDone).map((row) => row.structureId))
}

/**
 * Wipe assessment-derived placement so the curated bank can be retaken cleanly.
 * Softens focusScore and clears assessmentDone; cancels active assessment sessions.
 */
export async function resetAssessmentProgress() {
  await prisma.grammarSession.updateMany({
    where: { kind: "assessment", status: "active" },
    data: { status: "abandoned" },
  })
  const assessed = await prisma.grammarSkill.findMany({
    where: { assessmentDone: true },
    select: { structureId: true },
  })
  await prisma.grammarSkill.updateMany({
    where: { assessmentDone: true },
    data: {
      assessmentDone: false,
      masteryStatus: "unseen",
      consecutiveCleanPasses: 0,
      focusScore: 0.5,
      recentCorrect: 0,
      recentTotal: 0,
    },
  })
  for (const row of assessed) {
    await prisma.$executeRaw`
      UPDATE GrammarSkill
      SET lastDiagnosticResult = NULL, lastDiagnosticDay = NULL
      WHERE structureId = ${row.structureId}
    `
  }
  try {
    await prisma.grammarSettings.upsert({
      where: { id: "default" },
      update: { assessmentBankVersion: ASSESSMENT_BANK_VERSION },
      create: {
        id: "default",
        intervalsJson: "[1,2,3,7,14,30]",
        assessmentBankVersion: ASSESSMENT_BANK_VERSION,
      },
    })
  } catch {
    // Client may predate assessmentBankVersion — still reset skills/sessions above.
  }
  return { ok: true as const, bankVersion: ASSESSMENT_BANK_VERSION }
}

/** One-shot: if bank version advanced, clear stale assessment mastery. */
export async function ensureAssessmentBankVersion() {
  try {
    const row = await prisma.grammarSettings.upsert({
      where: { id: "default" },
      update: {},
      create: {
        id: "default",
        intervalsJson: "[1,2,3,7,14,30]",
        assessmentBankVersion: 0,
      },
    })
    const current = Number(
      (row as { assessmentBankVersion?: number }).assessmentBankVersion ?? 0,
    )
    if (current < ASSESSMENT_BANK_VERSION) {
      await resetAssessmentProgress()
      return { reset: true as const, bankVersion: ASSESSMENT_BANK_VERSION }
    }
  } catch {
    // Missing column / client — skip auto-reset; Retake still works via action.
  }
  return { reset: false as const, bankVersion: ASSESSMENT_BANK_VERSION }
}

export async function assessmentIncomplete() {
  await ensureAssessmentBankVersion()
  const doneIds = await assessedStructureIds()
  const progressA1 = assessmentProgressForLevels(["A1"], doneIds)
  const progressA2 = assessmentProgressForLevels(["A2"], doneIds)
  const progressBoth = assessmentProgressForLevels(["A1", "A2"], doneIds)
  const active = await prisma.grammarSession.findFirst({
    where: { kind: "assessment", status: "active" },
    orderBy: { updatedAt: "desc" },
  })
  return {
    incomplete: !progressA1.complete || !progressA2.complete,
    a1Done: progressA1.complete,
    a2Done: progressA2.complete,
    activeSessionId: active?.id ?? null,
    structureCount: ASSESSMENT_STRUCTURE_COUNT,
    questionsPerStructure: ASSESSMENT_QUESTIONS_PER,
    totalQuestions: ASSESSMENT_STRUCTURE_COUNT * ASSESSMENT_QUESTIONS_PER,
    /** Compact progress line only — no explanatory blurb. */
    bannerLine: progressBoth.bannerLine,
    sessionIndex: progressBoth.sessionIndex,
    sessionTotal: progressBoth.sessionTotal,
    assessedTopics: progressBoth.assessedTopics,
    totalTopics: progressBoth.totalTopics,
    bankVersion: ASSESSMENT_BANK_VERSION,
  }
}

export async function startAssessment(levels: Array<"A1" | "A2"> = ["A1", "A2"]) {
  const uniqueLevels = [...new Set(levels.length ? levels : (["A1", "A2"] as const))] as Array<
    "A1" | "A2"
  >
  const doneIds = await assessedStructureIds()
  const structureIds = selectAssessmentStructures(uniqueLevels, doneIds)
  if (!structureIds.length) {
    const progress = assessmentProgressForLevels(uniqueLevels, doneIds)
    return {
      sessionId: null as string | null,
      kind: "assessment" as const,
      levelScope: uniqueLevels.sort().join("+"),
      cursor: 0,
      total: 0,
      structureIds: [] as string[],
      structureCount: 0,
      questionsPerStructure: ASSESSMENT_QUESTIONS_PER,
      items: [] as AdaptiveItem[],
      batch: [] as AdaptiveItem[],
      hasMore: false,
      complete: true,
      progress,
      bannerLine: progress.bannerLine,
    }
  }
  const allItems = toAdaptiveItems(
    buildAssessmentBankItems(structureIds, ASSESSMENT_QUESTIONS_PER),
  )
  if (!allItems.length) {
    throw new Error("No validated assessment bank items for selected topics")
  }
  const levelScope = uniqueLevels.sort().join("+")
  const progress = assessmentProgressForLevels(uniqueLevels, doneIds)
  const session = await prisma.grammarSession.create({
    data: {
      kind: "assessment",
      levelScope,
      status: "active",
      cursor: 0,
      payloadJson: JSON.stringify({
        structureIds,
        items: allItems,
        answers: [],
        structureScores: {},
        levels: uniqueLevels,
      } satisfies SessionPayload),
    },
  })
  return {
    sessionId: session.id,
    kind: "assessment" as const,
    levelScope,
    cursor: 0,
    total: allItems.length,
    structureIds,
    structureCount: structureIds.length,
    questionsPerStructure: ASSESSMENT_QUESTIONS_PER,
    /** Curated bank: up to 8×4=32 validated sentence blanks. */
    items: allItems,
    batch: allItems,
    hasMore: false,
    complete: false,
    progress,
    bannerLine: progress.bannerLine,
    sessionIndex: progress.sessionIndex,
    sessionTotal: progress.sessionTotal,
  }
}

export async function resumeAssessment() {
  const session = await prisma.grammarSession.findFirst({
    where: { kind: "assessment", status: "active" },
    orderBy: { updatedAt: "desc" },
  })
  if (!session) return null
  const payload = parsePayload(session.payloadJson)
  const answered = new Set(payload.answers.map((a) => a.itemId))
  const remaining = payload.items.filter((item) => !answered.has(item.id))
  const levels = (payload.levels?.length ? payload.levels : ["A1", "A2"]) as Array<"A1" | "A2">
  const doneIds = await assessedStructureIds()
  const progress = assessmentProgressForLevels(levels, doneIds)
  return {
    sessionId: session.id,
    kind: "assessment" as const,
    levelScope: session.levelScope,
    cursor: session.cursor,
    total: payload.items.length,
    answered: payload.answers.length,
    structureIds: payload.structureIds,
    structureCount: payload.structureIds.length,
    questionsPerStructure: ASSESSMENT_QUESTIONS_PER,
    items: remaining,
    batch: remaining,
    hasMore: false,
    structureScores: payload.structureScores,
    progress,
    bannerLine: progress.bannerLine,
    sessionIndex: progress.sessionIndex,
    sessionTotal: progress.sessionTotal,
  }
}

export async function startDiagnostic(level: CefrLevel | "mix" = "mix") {
  const settings = await getAdaptiveSettings()
  const skills = await loadSkillSnapshots()
  const exclude = await yesterdayDiagnosticStructureIds()
  const structureIds = selectDiagnosticStructures({
    level,
    skills,
    count: settings.diagnosticStructureCount,
    excludeYesterdayIds: exclude,
  })
  const items = toAdaptiveItems(
    buildAssessmentBankItems(structureIds, settings.questionsPerStructure),
  )
  if (!items.length) {
    throw new Error("No validated diagnostic bank items for selected topics")
  }
  const session = await prisma.grammarSession.create({
    data: {
      kind: "diagnostic",
      levelScope: level,
      status: "active",
      cursor: 0,
      payloadJson: JSON.stringify({
        structureIds,
        items,
        answers: [],
        structureScores: {},
        yesterdayStructureIds: exclude,
        continueRounds: {},
      } satisfies SessionPayload),
    },
  })
  return {
    sessionId: session.id,
    kind: "diagnostic" as const,
    levelScope: level,
    structureIds,
    items,
    total: items.length,
  }
}

/** Topics waiting for a mixed verification quiz (yellow ball). */
export async function pendingVerificationTopics() {
  const skills = await loadSkillSnapshots()
  const pending = skills.filter((row) => row.lastDiagnosticResult === "verify")
  return {
    count: pending.length,
    structureIds: pending.map((row) => row.structureId),
    items: pending.map((row) => ({
      structureId: row.structureId,
      label: getStructure(row.structureId)?.label ?? row.structureId,
      cefr: getStructure(row.structureId)?.cefr ?? row.cefrLevel,
    })),
  }
}

/**
 * Mixed re-test for yellow-ball topics: 4 bank questions each, shuffled,
 * no topic labels exposed to the learner during the sitting.
 */
export async function startVerification() {
  const pending = await pendingVerificationTopics()
  if (!pending.structureIds.length) {
    throw new Error("No topics need verification")
  }
  const seeded = buildAssessmentBankItems(pending.structureIds, VERIFY_QUESTIONS_PER)
  // Hide grammar-topic labels in the quiz UI.
  const items = toAdaptiveItems(
    seeded.map((item) => ({
      ...item,
      structureLabel: "",
    })),
  )
  if (!items.length) {
    throw new Error("No verification questions available for pending topics")
  }
  const session = await prisma.grammarSession.create({
    data: {
      kind: "verify",
      levelScope: "mix",
      status: "active",
      cursor: 0,
      payloadJson: JSON.stringify({
        structureIds: pending.structureIds,
        items,
        answers: [],
        structureScores: {},
        continueRounds: {},
      } satisfies SessionPayload),
    },
  })
  return {
    sessionId: session.id,
    kind: "verify" as const,
    levelScope: "mix" as const,
    structureIds: pending.structureIds,
    structureCount: pending.structureIds.length,
    questionsPerStructure: VERIFY_QUESTIONS_PER,
    items,
    total: items.length,
  }
}

export async function startAdaptivePractice(options?: {
  level?: CefrLevel | "mix"
  structureIds?: string[]
  sessionId?: string
}) {
  const settings = await getAdaptiveSettings()
  const skills = await loadSkillSnapshots()
  let prefer: string[] = options?.structureIds ?? []
  if (!prefer.length && options?.sessionId) {
    const prior = await prisma.grammarSession.findUnique({ where: { id: options.sessionId } })
    if (prior) {
      const payload = parsePayload(prior.payloadJson)
      prefer =
        payload.recommendedPractice ??
        Object.values(payload.structureScores)
          .filter((s) => s.verdict === "weak" || s.verdict === "uncertain")
          .map((s) => s.structureId)
    }
  }
  const structureIds = recommendedPracticeStructures({
    skills,
    level: options?.level ?? "mix",
    limit: settings.practiceStructures,
    preferIds: prefer,
  })
  const items = toAdaptiveItems(
    structureIds.flatMap((id) => buildPracticeMixForStructure(id, settings.practiceQuestionsPer)),
  )
  const session = await prisma.grammarSession.create({
    data: {
      kind: "practice",
      levelScope: options?.level ?? "mix",
      status: "active",
      cursor: 0,
      payloadJson: JSON.stringify({
        structureIds,
        items,
        answers: [],
        structureScores: {},
        recommendedPractice: structureIds,
      } satisfies SessionPayload),
    },
  })
  return {
    sessionId: session.id,
    kind: "practice" as const,
    levelScope: options?.level ?? "mix",
    structureIds,
    items,
    total: items.length,
  }
}

async function upsertSkillFromOutcome(options: {
  structureId: string
  correct: number
  total: number
  source: "diagnostic" | "practice" | "assessment" | "manual"
  byType?: Record<string, { c: number; t: number }>
  mistakes?: Record<string, number>
  uncertainOnly?: boolean
}) {
  const settings = await getAdaptiveSettings()
  const structure = getStructure(options.structureId)
  const existing = await prisma.grammarSkill.findUnique({ where: { structureId: options.structureId } })
  const outcome = applyStructureOutcome({
    skill: existing ? toSnapshot(existing) : null,
    structureId: options.structureId,
    cefrLevel: structure?.cefr ?? existing?.cefrLevel ?? "A1",
    correct: options.correct,
    total: options.total,
    source: options.source,
    intervals: settings.intervals,
    byType: options.byType,
    mistakes: options.mistakes,
    uncertainOnly: options.uncertainOnly,
  })

  // Keep Prisma upsert on long-lived fields only. Day-mark columns may lag behind
  // a hot-reloaded client; apply those via SQL so diagnostic finalize never 500s.
  await prisma.grammarSkill.upsert({
    where: { structureId: options.structureId },
    update: {
      cefrLevel: structure?.cefr ?? existing?.cefrLevel ?? "A1",
      reviewCount: outcome.reviewCount,
      correctCount: outcome.correctCount,
      lastReviewedAt: new Date(),
      focusScore: outcome.focusScore,
      masteryStatus: outcome.masteryStatus,
      consecutiveCleanPasses: outcome.consecutiveCleanPasses,
      nextReviewAt: outcome.nextReviewAt,
      lastDiagnosticAt: outcome.lastDiagnosticAt ?? undefined,
      lastPracticeAt: outcome.lastPracticeAt ?? undefined,
      recentCorrect: outcome.recentCorrect,
      recentTotal: outcome.recentTotal,
      byTypeJson: outcome.byTypeJson,
      mistakeJson: outcome.mistakeJson,
      diagnosticStreakDay: outcome.diagnosticStreakDay,
      assessmentDone: outcome.assessmentDone,
      ...(outcome.lastPerfectDay ? { lastPerfectDay: outcome.lastPerfectDay } : {}),
    },
    create: {
      structureId: options.structureId,
      cefrLevel: structure?.cefr ?? "A1",
      reviewCount: outcome.reviewCount,
      correctCount: outcome.correctCount,
      lastReviewedAt: new Date(),
      focusScore: outcome.focusScore,
      masteryStatus: outcome.masteryStatus,
      consecutiveCleanPasses: outcome.consecutiveCleanPasses,
      nextReviewAt: outcome.nextReviewAt,
      lastDiagnosticAt: outcome.lastDiagnosticAt,
      lastPracticeAt: outcome.lastPracticeAt,
      recentCorrect: outcome.recentCorrect,
      recentTotal: outcome.recentTotal,
      byTypeJson: outcome.byTypeJson,
      mistakeJson: outcome.mistakeJson,
      diagnosticStreakDay: outcome.diagnosticStreakDay,
      assessmentDone: outcome.assessmentDone,
      lastPerfectDay: outcome.lastPerfectDay ?? undefined,
    },
  })

  if (outcome.lastPerfectDay) {
    await prisma.$executeRaw`UPDATE GrammarSkill SET lastImperfectDay = NULL WHERE structureId = ${options.structureId}`
  }
  if (outcome.lastDiagnosticDay != null) {
    await prisma.$executeRaw`
      UPDATE GrammarSkill
      SET lastDiagnosticDay = ${outcome.lastDiagnosticDay},
          lastDiagnosticResult = ${outcome.lastDiagnosticResult ?? null}
      WHERE structureId = ${options.structureId}
    `
  }
  return outcome
}

function recomputeStructureScores(payload: SessionPayload): Record<string, StructureScore> {
  const byStructure = new Map<string, { correct: number; total: number; uncertain: number }>()
  for (const answer of payload.answers) {
    const row = byStructure.get(answer.structureId) ?? { correct: 0, total: 0, uncertain: 0 }
    if (answer.uncertainKey) {
      row.uncertain += 1
    } else {
      row.total += 1
      if (answer.passed) row.correct += 1
    }
    byStructure.set(answer.structureId, row)
  }
  const scores: Record<string, StructureScore> = {}
  for (const [structureId, row] of byStructure) {
    const verdict = scoreStructureSession(row.correct, row.total)
    scores[structureId] = {
      structureId,
      label: getStructure(structureId)?.label ?? structureId,
      correct: row.correct,
      total: row.total,
      verdict,
      band: assessmentBand(row.correct, row.total),
      needsContinue: verdict === "uncertain",
    }
  }
  return scores
}

export async function gradeAdaptiveAnswer(options: {
  sessionId: string
  itemId: string
  given: string
}) {
  const session = await prisma.grammarSession.findUnique({ where: { id: options.sessionId } })
  if (!session) throw new Error("Session not found")
  if (session.status !== "active") throw new Error("Session already completed")

  const payload = parsePayload(session.payloadJson)
  const item = payload.items.find((row) => row.id === options.itemId)
  if (!item) throw new Error("Item not found in session")

  const { result, matched } = evaluateAgainst(
    options.given,
    item.accepted?.length ? item.accepted : [item.expected],
    "tr",
  )
  const passed = isPassing(result)
  const uncertainKey = Boolean(item.uncertainKey)
  // Always surface canonical orthography (geleceğim), even on diacritic spelling passes.
  const expectedDisplay = matched?.trim() || item.expected

  await prisma.grammarAttempt.create({
    data: {
      structureId: item.structureId,
      verb: item.verb,
      prompt: item.turkishPrompt ?? item.sentenceCue,
      expected: item.expected,
      given: options.given,
      result: uncertainKey && !passed ? "uncertain" : result,
      mode: session.kind,
    },
  })

  payload.answers = payload.answers.filter((row) => row.itemId !== options.itemId)
  payload.answers.push({
    itemId: item.id,
    structureId: item.structureId,
    given: options.given,
    expected: item.expected,
    result,
    passed,
    // uncertainKey answers are excluded from structure scores / mastery in recompute + finalize.
    uncertainKey,
  })
  payload.structureScores = recomputeStructureScores(payload)

  const answeredIds = new Set(payload.answers.map((a) => a.itemId))
  const remaining = payload.items.filter((row) => !answeredIds.has(row.id))
  const nextCursor = session.cursor + 1

  // Mastery / reviewCount updates happen once per structure at session finalize
  // (avoids double-counting with finalizeSessionOutcomes).

  let completed = remaining.length === 0
  let continueItems: AdaptiveItem[] = []

  if (completed && session.kind === "diagnostic") {
    // 2/3 uncertain → +3 questions for those structures (once)
    const needsContinue = Object.values(payload.structureScores).filter(
      (score) => score.needsContinue && (payload.continueRounds?.[score.structureId] ?? 0) < 1,
    )
    if (needsContinue.length) {
      completed = false
      const extraSeeds = buildAssessmentBankItems(
        needsContinue.map((s) => s.structureId),
        DIAGNOSTIC_QUESTIONS_PER_STRUCTURE,
      )
      continueItems = toAdaptiveItems(extraSeeds, payload.items.length)
      payload.items = [...payload.items, ...continueItems]
      for (const score of needsContinue) {
        payload.continueRounds = {
          ...(payload.continueRounds ?? {}),
          [score.structureId]: (payload.continueRounds?.[score.structureId] ?? 0) + 1,
        }
      }
    }
  }

  if (completed) {
    await finalizeSessionOutcomes(
      session.kind as "assessment" | "diagnostic" | "practice" | "verify",
      payload,
    )
    payload.recommendedPractice = recommendedPracticeStructures({
      skills: await loadSkillSnapshots(),
      level: session.levelScope === "A1" || session.levelScope === "A2" ? session.levelScope : "mix",
      preferIds: Object.values(payload.structureScores)
        // Skip structures that only had uncertain/unreliable items.
        .filter((s) => s.total > 0 && s.verdict !== "passed")
        .map((s) => s.structureId),
    })
  }

  await prisma.grammarSession.update({
    where: { id: session.id },
    data: {
      cursor: nextCursor,
      status: completed ? "completed" : "active",
      payloadJson: JSON.stringify(payload),
    },
  })

  return {
    result,
    passed,
    // Canonical Turkish orthography for the blank / "Right answer" line.
    expected: expectedDisplay,
    tip: !passed && !uncertainKey ? getStructure(item.structureId)?.focusTip ?? null : null,
    uncertainKey,
    masteryIgnored: uncertainKey,
    completed,
    structureScores: payload.structureScores,
    recommendedPractice: payload.recommendedPractice ?? [],
    continueItems,
    resultsDashboard: completed ? buildResultsDashboard(payload) : null,
  }
}

async function finalizeSessionOutcomes(
  kind: "assessment" | "diagnostic" | "practice" | "verify",
  payload: SessionPayload,
) {
  const day = todayKey()
  const scoredIds = new Set(payload.answers.map((a) => a.structureId))
  const structureIds =
    kind === "assessment" ? [...new Set([...payload.structureIds, ...scoredIds])] : [...scoredIds]

  if (kind === "verify") {
    for (const structureId of structureIds) {
      const answers = payload.answers.filter((a) => a.structureId === structureId && !a.uncertainKey)
      const correct = answers.filter((a) => a.passed).length
      const total = answers.length
      // 4/4 → green check; otherwise stay yellow for another verification pass.
      if (total > 0 && correct === total) {
        await prisma.$executeRaw`
          UPDATE GrammarSkill
          SET lastImperfectDay = NULL,
              lastPerfectDay = ${day},
              lastDiagnosticDay = ${day},
              lastDiagnosticResult = 'passed'
          WHERE structureId = ${structureId}
        `
      }
    }
    return
  }

  const source = kind === "practice" ? "practice" : kind
  for (const structureId of structureIds) {
    const answers = payload.answers.filter((a) => a.structureId === structureId && !a.uncertainKey)
    const correct = answers.filter((a) => a.passed).length
    const total = answers.length
    const byType: Record<string, { c: number; t: number }> = {}
    const mistakes: Record<string, number> = {}
    for (const answer of answers) {
      const item = payload.items.find((row) => row.id === answer.itemId)
      const key = item?.kind ?? "blank"
      byType[key] = {
        c: (byType[key]?.c ?? 0) + (answer.passed ? 1 : 0),
        t: (byType[key]?.t ?? 0) + 1,
      }
      if (!answer.passed) {
        const cat = classifyMistake({
          structureId,
          expected: answer.expected,
          given: answer.given,
        })
        if (cat) mistakes[cat] = (mistakes[cat] ?? 0) + 1
      }
    }

    if (total === 0) {
      if (kind === "assessment") {
        await upsertSkillFromOutcome({
          structureId,
          correct: 0,
          total: 0,
          source: "assessment",
          uncertainOnly: true,
        })
      }
      continue
    }
    await upsertSkillFromOutcome({
      structureId,
      correct,
      total,
      source,
      byType,
      mistakes,
    })
  }
}

function buildResultsDashboard(payload: SessionPayload) {
  const scores = Object.values(payload.structureScores).map((score) => ({
    ...score,
    band: score.band ?? assessmentBand(score.correct, score.total),
  }))
  const strong = scores.filter((s) => s.band === "strong")
  const needsReview = scores.filter((s) => s.band === "review")
  const prioritize = scores.filter((s) => s.band === "prioritize")
  // Legacy fields kept for diagnostic/practice result screens
  const needsAttention = scores.filter((s) => s.verdict === "weak" || s.verdict === "uncertain")
  const passedToday = scores.filter((s) => s.verdict === "passed")
  return {
    strong,
    needsReview,
    prioritize,
    needsAttention,
    passedToday,
    recommendedPractice: (payload.recommendedPractice ?? []).map((id) => ({
      structureId: id,
      label: getStructure(id)?.label ?? id,
      cefr: getStructure(id)?.cefr ?? "A1",
    })),
  }
}

export async function continueDiagnostic(sessionId: string) {
  const session = await prisma.grammarSession.findUnique({ where: { id: sessionId } })
  if (!session) throw new Error("Session not found")
  const payload = parsePayload(session.payloadJson)
  const needs = Object.values(payload.structureScores).filter((s) => s.needsContinue)
  if (!needs.length) {
    return { items: [] as AdaptiveItem[], message: "No structures need continuation" }
  }
  const already = payload.continueRounds ?? {}
  const todo = needs.filter((s) => (already[s.structureId] ?? 0) < 1)
  if (!todo.length) return { items: [] as AdaptiveItem[], message: "Continue round already used" }

  const extra = toAdaptiveItems(
    buildAssessmentBankItems(
      todo.map((s) => s.structureId),
      DIAGNOSTIC_QUESTIONS_PER_STRUCTURE,
    ),
    payload.items.length,
  )
  payload.items = [...payload.items, ...extra]
  for (const score of todo) {
    already[score.structureId] = (already[score.structureId] ?? 0) + 1
  }
  payload.continueRounds = already
  await prisma.grammarSession.update({
    where: { id: sessionId },
    data: {
      status: "active",
      payloadJson: JSON.stringify(payload),
    },
  })
  return { items: extra, structureIds: todo.map((s) => s.structureId) }
}

export async function adaptiveProgress(options?: {
  cefr?: CefrLevel | "all"
  mastery?: MasteryStatus | "all"
  dueOnly?: boolean
}) {
  const skills = await loadSkillSnapshots()
  const byId = new Map(skills.map((s) => [s.structureId, s]))
  const now = new Date()
  const { GRAMMAR_STRUCTURES } = await import("@/lib/grammar")
  const items = GRAMMAR_STRUCTURES.map((structure) => {
    const skill = byId.get(structure.id)
    const mastery = (skill?.masteryStatus as MasteryStatus) ?? "unseen"
    const due =
      skill?.nextReviewAt != null && skill.nextReviewAt.getTime() <= now.getTime()
    return {
      id: structure.id,
      label: structure.label,
      cefr: structure.cefr,
      category: structure.category,
      section: structure.section,
      masteryStatus: mastery,
      consecutiveCleanPasses: skill?.consecutiveCleanPasses ?? 0,
      nextReviewAt: skill?.nextReviewAt?.toISOString() ?? null,
      due,
      assessmentDone: skill?.assessmentDone ?? false,
      reviewCount: skill?.reviewCount ?? 0,
      correctCount: skill?.correctCount ?? 0,
      accuracy: skill?.reviewCount
        ? Math.round((skill.correctCount / skill.reviewCount) * 100)
        : null,
      focusScore: skill?.focusScore ?? 0,
      recentCorrect: skill?.recentCorrect ?? 0,
      recentTotal: skill?.recentTotal ?? 0,
      diagnosticStreakDay: skill?.diagnosticStreakDay ?? null,
      perfectToday: skill?.diagnosticStreakDay === todayKey() || false,
      verifyPending: skill?.lastDiagnosticResult === "verify",
      diagnosticToday:
        skill?.lastDiagnosticDay === todayKey()
          ? skill.lastDiagnosticResult === "passed" || skill.lastDiagnosticResult === "attention"
            ? skill.lastDiagnosticResult
            : null
          : null,
    }
  })

  let filtered = items
  if (options?.cefr && options.cefr !== "all") {
    filtered = filtered.filter((item) => item.cefr === options.cefr)
  }
  if (options?.mastery && options.mastery !== "all") {
    filtered = filtered.filter((item) => item.masteryStatus === options.mastery)
  }
  if (options?.dueOnly) {
    filtered = filtered.filter((item) => item.due)
  }

  const needsAttention = items
    .filter((item) => item.masteryStatus === "weak" || item.masteryStatus === "learning" || item.due)
    .sort((a, b) => b.focusScore - a.focusScore)
  const dueReviews = items.filter((item) => item.due)
  const assessment = await assessmentIncomplete()

  return {
    items: filtered,
    needsAttention: needsAttention.slice(0, 12),
    dueReviews,
    assessment,
    counts: {
      unseen: items.filter((i) => i.masteryStatus === "unseen").length,
      weak: items.filter((i) => i.masteryStatus === "weak").length,
      learning: items.filter((i) => i.masteryStatus === "learning").length,
      familiar: items.filter((i) => i.masteryStatus === "familiar").length,
      strong: items.filter((i) => i.masteryStatus === "strong").length,
      mastered: items.filter((i) => i.masteryStatus === "mastered").length,
      due: dueReviews.length,
    },
  }
}
