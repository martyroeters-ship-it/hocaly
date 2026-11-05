import { addDays, todayKey } from "@/lib/dates"
import { GRAMMAR_STRUCTURES, getStructure, structuresForExactLevel } from "@/lib/grammar"
import { hasAssessmentBank } from "@/lib/grammar/assessment-bank"
import type { CefrLevel } from "@/lib/types"

export type MasteryStatus = "unseen" | "weak" | "learning" | "familiar" | "strong" | "mastered"

export type StructureVerdict = "weak" | "uncertain" | "passed"

/** Placement-test band for initial assessment (8 topics × 4 questions). */
export type AssessmentBand = "strong" | "review" | "prioritize"

/** passed = check · attention = red X · verify = yellow (needs mixed re-test) */
export type DiagnosticDayResult = "passed" | "attention" | "verify"

/** Mixed verification quiz: 4 questions per yellow-ball topic. */
export const VERIFY_QUESTIONS_PER = 4

/** Initial assessment: 8 topics × 4 questions = 32 (single sitting; resume OK). */
export const ASSESSMENT_STRUCTURE_COUNT = 8
export const ASSESSMENT_QUESTIONS_PER = 4

export type AdaptiveSkillSnapshot = {
  structureId: string
  cefrLevel: string
  masteryStatus: MasteryStatus
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
  lastDiagnosticDay?: string | null
  lastDiagnosticResult?: DiagnosticDayResult | null
  byTypeJson?: string
  mistakeJson?: string
}

export type AdaptiveSettings = {
  diagnosticStructureCount: number
  questionsPerStructure: number
  practiceStructures: number
  practiceQuestionsPer: number
  intervals: number[]
}

export const DEFAULT_INTERVALS = [1, 2, 3, 7, 14, 30] as const

export const DEFAULT_ADAPTIVE_SETTINGS: AdaptiveSettings = {
  diagnosticStructureCount: 8,
  questionsPerStructure: 3,
  practiceStructures: 3,
  practiceQuestionsPer: 10,
  intervals: [...DEFAULT_INTERVALS],
}

export function parseIntervalsJson(raw: string | null | undefined): number[] {
  try {
    const parsed = JSON.parse(raw || "[]") as unknown
    if (!Array.isArray(parsed)) return [...DEFAULT_INTERVALS]
    const days = parsed.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    return days.length ? days : [...DEFAULT_INTERVALS]
  } catch {
    return [...DEFAULT_INTERVALS]
  }
}

export function parseCountJson(raw: string | null | undefined): Record<string, { c: number; t: number }> {
  try {
    const parsed = JSON.parse(raw || "{}") as Record<string, { c?: number; t?: number }>
    const out: Record<string, { c: number; t: number }> = {}
    for (const [key, value] of Object.entries(parsed ?? {})) {
      out[key] = { c: Number(value?.c) || 0, t: Number(value?.t) || 0 }
    }
    return out
  } catch {
    return {}
  }
}

export function parseMistakeJson(raw: string | null | undefined): Record<string, number> {
  try {
    const parsed = JSON.parse(raw || "{}") as Record<string, number>
    const out: Record<string, number> = {}
    for (const [key, value] of Object.entries(parsed ?? {})) {
      out[key] = Number(value) || 0
    }
    return out
  } catch {
    return {}
  }
}

/** Score a per-structure mini-session (diagnostic typically 3; assessment 4). */
export function scoreStructureSession(correct: number, total: number): StructureVerdict {
  if (total <= 0) return "uncertain"
  if (correct === total && total >= 2) return "passed"
  if (total >= 3 && correct === total - 1) return "uncertain"
  if (total === 2 && correct === 1) return "uncertain"
  return "weak"
}

/** Map assessment 4-question scores → UI bands. */
export function assessmentBand(correct: number, total: number): AssessmentBand {
  if (total > 0 && correct === total) return "strong"
  if (total >= 4 && correct === total - 1) return "review"
  if (total === 3 && correct === 2) return "review"
  return "prioritize"
}

/**
 * Soft mastery: a single diagnostic pass never jumps to mastered.
 * Transitions rely on multi-session evidence + consecutive clean diagnostic passes.
 */
export function nextMasteryStatus(options: {
  current: MasteryStatus
  verdict: StructureVerdict
  consecutiveCleanPasses: number
  recentCorrect: number
  recentTotal: number
  source: "diagnostic" | "practice" | "assessment" | "manual"
}): MasteryStatus {
  const { current, verdict, consecutiveCleanPasses, recentCorrect, recentTotal, source } = options
  const accuracy = recentTotal > 0 ? recentCorrect / recentTotal : 0

  if (verdict === "weak") {
    if (current === "unseen") return "weak"
    if (current === "mastered" || current === "strong") return "learning"
    if (current === "familiar") return "learning"
    return "weak"
  }

  if (verdict === "uncertain") {
    if (current === "unseen") return "learning"
    if (current === "weak") return "learning"
    if (current === "mastered") return "strong"
    return current === "strong" ? "familiar" : current
  }

  // passed
  if (source === "manual") {
    // Manual topic practice updates history but never grants diagnostic clean-pass mastery jumps.
    if (current === "unseen") return "learning"
    if (current === "weak" && accuracy >= 0.7) return "learning"
    return current
  }

  if (source === "practice") {
    if (current === "unseen" || current === "weak") return "learning"
    if (current === "learning" && accuracy >= 0.8) return "familiar"
    return current
  }

  // Initial assessment placement: map bands directly onto mastery
  if (source === "assessment") {
    if (verdict === "passed") return "strong"
    if (verdict === "uncertain") return "learning"
    return "weak"
  }

  // diagnostic
  if (consecutiveCleanPasses >= 4 && accuracy >= 0.9) return "mastered"
  if (consecutiveCleanPasses >= 3) return "strong"
  if (consecutiveCleanPasses >= 2) return "familiar"
  if (consecutiveCleanPasses >= 1) {
    if (current === "unseen" || current === "weak") return "learning"
    return current === "learning" ? "familiar" : current
  }
  if (current === "unseen") return "learning"
  return current
}

/**
 * SRS intervals from settings:
 * failed → intervals[0] (1d)
 * after practice → intervals[1] (2d)
 * 1st clean → intervals[2] (3d)
 * 2nd → intervals[3] (7d)
 * 3rd → intervals[4] (14d)
 * 4th+ → intervals[5] (30d)
 */
export function scheduleNextReview(options: {
  intervals: number[]
  verdict: StructureVerdict
  consecutiveCleanPasses: number
  source: "diagnostic" | "practice" | "assessment" | "manual"
  from?: Date
}): Date {
  const intervals = options.intervals.length ? options.intervals : [...DEFAULT_INTERVALS]
  const from = options.from ?? new Date()
  let days = intervals[0] ?? 1

  if (options.verdict === "weak") {
    days = intervals[0] ?? 1
  } else if (options.verdict === "uncertain") {
    days = intervals[1] ?? intervals[0] ?? 2
  } else if (options.source === "practice" || options.source === "manual") {
    days = intervals[1] ?? 2
  } else {
    const clean = Math.max(1, options.consecutiveCleanPasses)
    const index = Math.min(intervals.length - 1, clean + 1) // 1st clean → index 2
    days = intervals[index] ?? intervals[intervals.length - 1] ?? 3
  }

  return addDays(from, days)
}

export function bumpRecentWindow(
  recentCorrect: number,
  recentTotal: number,
  passed: boolean,
  windowSize = 20,
) {
  let correct = recentCorrect + (passed ? 1 : 0)
  let total = recentTotal + 1
  if (total > windowSize) {
    // Decay older evidence proportionally so the window stays bounded.
    const scale = windowSize / total
    correct = Math.round(correct * scale)
    total = windowSize
  }
  return { recentCorrect: correct, recentTotal: total }
}

export function classifyMistake(options: {
  structureId: string
  expected: string
  given: string
}): string | null {
  const expected = options.expected.trim().toLocaleLowerCase("tr-TR")
  const given = options.given.trim().toLocaleLowerCase("tr-TR")
  if (!given || given === expected) return null

  if (options.structureId.includes("future") || /aca[gk]|ece[gk]|acağ|eceğ/.test(expected)) {
    if (given.includes("k") && expected.includes("ğ") && given.replaceAll("ğ", "k") === expected.replaceAll("ğ", "k")) {
      return "soft-g"
    }
    if (!/acak|ecek|acağ|eceğ/.test(given)) return "future-tense"
  }
  if (options.structureId.includes("accusative") || options.structureId === "accusative") {
    return "accusative"
  }
  if (options.structureId.includes("negation") || /m[ae]/.test(expected)) {
    if (!/m[ae]/.test(given) && /m[ae]/.test(expected)) return "negation"
  }
  // Person ending mismatch heuristic
  const personEndings = /(im|ın|in|um|üm|sin|sun|sün|iz|ız|uz|üz|siniz|sunuz|sünüz|ler|lar|m|n|k)$/
  if (personEndings.test(expected) && personEndings.test(given)) {
    const stemE = expected.replace(personEndings, "")
    const stemG = given.replace(personEndings, "")
    if (stemE === stemG) return "person-ending"
  }
  return "form"
}

export function matchesLevelScope(cefr: string, levelScope: string) {
  if (levelScope === "mix" || levelScope === "A1+A2") return cefr === "A1" || cefr === "A2"
  return cefr === levelScope
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

function isDue(skill: AdaptiveSkillSnapshot | undefined, now: Date) {
  if (!skill?.nextReviewAt) return false
  return skill.nextReviewAt.getTime() <= now.getTime()
}

function isWeak(skill: AdaptiveSkillSnapshot | undefined) {
  if (!skill) return false
  if (skill.masteryStatus === "weak") return true
  if (skill.focusScore >= 0.75 && skill.reviewCount > 0) return true
  if (skill.recentTotal >= 3 && skill.recentCorrect / skill.recentTotal < 0.5) return true
  return false
}

function isNewOrUndertested(skill: AdaptiveSkillSnapshot | undefined) {
  if (!skill) return true
  if (skill.masteryStatus === "unseen") return true
  if (!skill.assessmentDone && skill.reviewCount < 3) return true
  if (skill.recentTotal < 3) return true
  return false
}

/**
 * Pick diagnostic structures: 3 weak + 3 due SRS + 2 new/undertested.
 * Avoids repeating yesterday's set unless the topic is still weak.
 */
export function selectDiagnosticStructures(options: {
  level: CefrLevel | "mix"
  skills: AdaptiveSkillSnapshot[]
  count?: number
  excludeYesterdayIds?: string[]
  now?: Date
}): string[] {
  const count = options.count ?? 8
  const now = options.now ?? new Date()
  const yesterdayIds = new Set(options.excludeYesterdayIds ?? [])
  const byId = new Map(options.skills.map((row) => [row.structureId, row]))

  const pool = GRAMMAR_STRUCTURES.filter((structure) => {
    if (!matchesLevelScope(structure.cefr, options.level)) return false
    // Diagnostic uses the same curated sentence bank as assessment.
    return hasAssessmentBank(structure.id)
  })

  const weak: string[] = []
  const due: string[] = []
  const fresh: string[] = []
  const rest: string[] = []

  for (const structure of shuffle(pool)) {
    const skill = byId.get(structure.id)
    const yesterday = yesterdayIds.has(structure.id)
    if (isWeak(skill)) {
      weak.push(structure.id)
      continue
    }
    if (yesterday) {
      // Skip non-weak repeats from yesterday
      rest.push(structure.id)
      continue
    }
    if (isDue(skill, now)) {
      due.push(structure.id)
      continue
    }
    if (isNewOrUndertested(skill)) {
      fresh.push(structure.id)
      continue
    }
    rest.push(structure.id)
  }

  const picked: string[] = []
  const take = (source: string[], n: number) => {
    for (const id of source) {
      if (picked.length >= count) break
      if (picked.includes(id)) continue
      if (n <= 0) break
      picked.push(id)
      n -= 1
    }
  }

  take(weak, 3)
  take(due, 3)
  take(fresh, 2)
  // Fill remaining slots from leftovers (prefer fresh → due → weak → rest)
  take(fresh, count)
  take(due, count)
  take(weak, count)
  take(rest, count)
  // Absolute fallback: any level structure
  if (picked.length < count) {
    const fallback = structuresForExactLevel(
      options.level === "mix" ? "A1" : options.level,
    )
    for (const structure of fallback) {
      if (picked.length >= count) break
      if (!picked.includes(structure.id)) picked.push(structure.id)
    }
    if (options.level === "mix" || options.level === "A2") {
      for (const structure of structuresForExactLevel("A2")) {
        if (picked.length >= count) break
        if (!picked.includes(structure.id)) picked.push(structure.id)
      }
    }
  }

  return shuffle(picked).slice(0, count)
}

export function recommendedPracticeStructures(options: {
  skills: AdaptiveSkillSnapshot[]
  level?: CefrLevel | "mix"
  limit?: number
  preferIds?: string[]
}): string[] {
  const limit = options.limit ?? 3
  const level = options.level ?? "mix"
  const byId = new Map(options.skills.map((row) => [row.structureId, row]))
  const prefer = options.preferIds ?? []

  const ranked = GRAMMAR_STRUCTURES.filter((structure) => matchesLevelScope(structure.cefr, level))
    .map((structure) => {
      const skill = byId.get(structure.id)
      let score = 0
      if (prefer.includes(structure.id)) score += 100
      if (skill?.masteryStatus === "weak") score += 50
      else if (skill?.masteryStatus === "learning") score += 30
      else if (skill?.masteryStatus === "unseen") score += 20
      if (skill && isDue(skill, new Date())) score += 25
      score += (skill?.focusScore ?? 0.3) * 10
      return { id: structure.id, score }
    })
    .sort((a, b) => b.score - a.score)

  const out: string[] = []
  for (const row of ranked) {
    if (out.length >= limit) break
    out.push(row.id)
  }
  return out
}

/** A1/A2 topics that have curated assessment-bank templates (progress + selection). */
export function assessmentStructuresForLevels(levels: Array<"A1" | "A2">) {
  const wanted = new Set(levels)
  return GRAMMAR_STRUCTURES.filter(
    (structure) =>
      wanted.has(structure.cefr as "A1" | "A2") && hasAssessmentBank(structure.id),
  ).map((structure) => structure.id)
}

function isAssessmentDrillable(structure: (typeof GRAMMAR_STRUCTURES)[number]) {
  // Assessment/diagnostic only quiz structures with validated curated banks.
  return hasAssessmentBank(structure.id)
}

/** Round-robin across sections from an id pool. */
function pickSpreadFromPool(poolIds: string[], count: number): string[] {
  const byId = new Map(GRAMMAR_STRUCTURES.map((s) => [s.id, s]))
  const pool = shuffle(poolIds.map((id) => byId.get(id)).filter(Boolean) as typeof GRAMMAR_STRUCTURES)
  const bySection = new Map<string, string[]>()
  for (const structure of pool) {
    const list = bySection.get(structure.section) ?? []
    list.push(structure.id)
    bySection.set(structure.section, list)
  }
  const queues = shuffle([...bySection.values()])
  const picked: string[] = []
  let guard = 0
  while (picked.length < count && queues.length && guard < count * 20) {
    guard += 1
    for (const queue of queues) {
      if (picked.length >= count) break
      const next = queue.shift()
      if (next && !picked.includes(next)) picked.push(next)
    }
    for (let i = queues.length - 1; i >= 0; i -= 1) {
      if (!queues[i]?.length) queues.splice(i, 1)
    }
  }
  return picked.slice(0, count)
}

export type AssessmentProgressSnapshot = {
  levelLabel: string
  totalTopics: number
  assessedTopics: number
  remainingTopics: number
  sessionIndex: number
  sessionTotal: number
  complete: boolean
  bannerLine: string
}

/** Progress counters for a level scope (A1, A2, or Both). */
export function assessmentProgressForLevels(
  levels: Array<"A1" | "A2">,
  doneIds: Set<string>,
): AssessmentProgressSnapshot {
  const unique = [...new Set(levels)] as Array<"A1" | "A2">
  const pool = assessmentStructuresForLevels(unique)
  const totalTopics = pool.length
  const assessedTopics = pool.filter((id) => doneIds.has(id)).length
  const remainingTopics = Math.max(0, totalTopics - assessedTopics)
  const sessionTotal = Math.max(1, Math.ceil(totalTopics / ASSESSMENT_STRUCTURE_COUNT))
  const sessionIndex = Math.min(
    sessionTotal,
    Math.floor(assessedTopics / ASSESSMENT_STRUCTURE_COUNT) + (remainingTopics > 0 ? 1 : 0),
  )
  const complete = remainingTopics === 0 && totalTopics > 0
  const levelLabel =
    unique.length >= 2 ? "A1+A2" : unique[0] === "A2" ? "A2" : "A1"
  const nextSession = complete
    ? sessionTotal
    : Math.floor(assessedTopics / ASSESSMENT_STRUCTURE_COUNT) + 1
  const bannerLine = complete
    ? `${levelLabel}: Initial assessment complete`
    : `${levelLabel}: Initial assessment session ${nextSession} of ${sessionTotal}`
  return {
    levelLabel,
    totalTopics,
    assessedTopics,
    remainingTopics,
    sessionIndex: nextSession,
    sessionTotal,
    complete,
    bannerLine,
  }
}

/**
 * Next sitting: up to 8 unassessed structures for the chosen level(s).
 * Both → fill from remaining A1+A2 (prefer mix when both still have leftovers).
 */
export function selectAssessmentStructures(
  levels: Array<"A1" | "A2">,
  alreadyDoneIds: Iterable<string> = [],
): string[] {
  const done = new Set(alreadyDoneIds)
  const unique = [...new Set(levels.length ? levels : (["A1", "A2"] as const))] as Array<"A1" | "A2">

  const remainingFor = (level: "A1" | "A2") =>
    assessmentStructuresForLevels([level]).filter((id) => {
      if (done.has(id)) return false
      const structure = getStructure(id)
      return structure ? isAssessmentDrillable(structure) : false
    })

  if (unique.length >= 2) {
    const a1 = remainingFor("A1")
    const a2 = remainingFor("A2")
    if (!a1.length && !a2.length) return []
    if (!a1.length) return pickSpreadFromPool(a2, ASSESSMENT_STRUCTURE_COUNT)
    if (!a2.length) return pickSpreadFromPool(a1, ASSESSMENT_STRUCTURE_COUNT)
    const half = Math.ceil(ASSESSMENT_STRUCTURE_COUNT / 2)
    const fromA1 = pickSpreadFromPool(a1, half)
    const fromA2 = pickSpreadFromPool(a2, ASSESSMENT_STRUCTURE_COUNT - fromA1.length)
    // Top up if one side ran short
    const picked = [...fromA1, ...fromA2]
    if (picked.length < ASSESSMENT_STRUCTURE_COUNT) {
      const leftover = [...a1, ...a2].filter((id) => !picked.includes(id))
      picked.push(...pickSpreadFromPool(leftover, ASSESSMENT_STRUCTURE_COUNT - picked.length))
    }
    return shuffle(picked).slice(0, ASSESSMENT_STRUCTURE_COUNT)
  }

  return shuffle(pickSpreadFromPool(remainingFor(unique[0]!), ASSESSMENT_STRUCTURE_COUNT))
}

export function applyStructureOutcome(options: {
  skill: AdaptiveSkillSnapshot | null
  structureId: string
  cefrLevel: string
  correct: number
  total: number
  source: "diagnostic" | "practice" | "assessment" | "manual"
  intervals: number[]
  byType?: Record<string, { c: number; t: number }>
  mistakes?: Record<string, number>
  uncertainOnly?: boolean
}): {
  masteryStatus: MasteryStatus
  consecutiveCleanPasses: number
  nextReviewAt: Date
  recentCorrect: number
  recentTotal: number
  focusScore: number
  assessmentDone: boolean
  diagnosticStreakDay: string | null
  lastDiagnosticAt: Date | null
  lastPracticeAt: Date | null
  byTypeJson: string
  mistakeJson: string
  reviewCount: number
  correctCount: number
  lastPerfectDay?: string | null
  lastDiagnosticDay?: string | null
  lastDiagnosticResult?: DiagnosticDayResult | null
} {
  const existing = options.skill
  const verdict = options.uncertainOnly
    ? "uncertain"
    : scoreStructureSession(options.correct, options.total)

  let consecutive = existing?.consecutiveCleanPasses ?? 0
  let diagnosticStreakDay = existing?.diagnosticStreakDay ?? null
  let lastDiagnosticDay = existing?.lastDiagnosticDay ?? null
  let lastDiagnosticResult = existing?.lastDiagnosticResult ?? null
  const today = todayKey()

  if (options.source === "diagnostic" || options.source === "assessment") {
    lastDiagnosticDay = today
    lastDiagnosticResult = verdict === "passed" ? "passed" : "attention"
    if (verdict === "passed") {
      consecutive += 1
      diagnosticStreakDay = today
    } else if (verdict === "weak") {
      consecutive = 0
    }
    // uncertain: keep streak count but don't increment
  }

  let recentCorrect = existing?.recentCorrect ?? 0
  let recentTotal = existing?.recentTotal ?? 0
  for (let i = 0; i < options.total; i += 1) {
    const passed = i < options.correct
    const next = bumpRecentWindow(recentCorrect, recentTotal, passed)
    recentCorrect = next.recentCorrect
    recentTotal = next.recentTotal
  }

  const masteryStatus = nextMasteryStatus({
    current: (existing?.masteryStatus as MasteryStatus) ?? "unseen",
    verdict,
    consecutiveCleanPasses: consecutive,
    recentCorrect,
    recentTotal,
    source: options.source,
  })

  const nextReviewAt = scheduleNextReview({
    intervals: options.intervals,
    verdict,
    consecutiveCleanPasses: consecutive,
    source: options.source,
  })

  const accuracy = options.total ? options.correct / options.total : 0
  let focusScore = existing?.focusScore ?? 0.5
  if (verdict === "weak") focusScore = Math.min(1, Math.max(focusScore, 0.92))
  else if (verdict === "uncertain") focusScore = Math.min(1, Math.max(0.55, focusScore))
  else focusScore = Math.max(0, focusScore - (options.source === "manual" ? 0.05 : 0.12))

  const byType = { ...parseCountJson(existing?.byTypeJson), ...(options.byType ?? {}) }
  const mistakes = { ...parseMistakeJson(existing?.mistakeJson) }
  if (options.mistakes) {
    for (const [key, value] of Object.entries(options.mistakes)) {
      mistakes[key] = (mistakes[key] ?? 0) + value
    }
  }

  const reviewCount = (existing?.reviewCount ?? 0) + options.total
  const correctCount = (existing?.correctCount ?? 0) + options.correct
  const now = new Date()

  return {
    masteryStatus,
    consecutiveCleanPasses: consecutive,
    nextReviewAt,
    recentCorrect,
    recentTotal,
    focusScore,
    assessmentDone: options.uncertainOnly
      ? (existing?.assessmentDone ?? false)
      : options.source === "assessment"
        ? true
        : (existing?.assessmentDone ?? false),
    diagnosticStreakDay,
    lastDiagnosticAt:
      options.source === "diagnostic" || options.source === "assessment"
        ? now
        : (existing?.lastDiagnosticAt ?? null),
    lastPracticeAt:
      options.source === "practice" || options.source === "manual"
        ? now
        : (existing?.lastPracticeAt ?? null),
    byTypeJson: JSON.stringify(byType),
    mistakeJson: JSON.stringify(mistakes),
    reviewCount,
    correctCount,
    lastPerfectDay:
      options.source === "manual" && accuracy === 1 && options.total >= 5
        ? today
        : existing
          ? undefined
          : null,
    lastDiagnosticDay,
    lastDiagnosticResult,
  }
}

export function structureLabel(structureId: string) {
  return getStructure(structureId)?.label ?? structureId
}
