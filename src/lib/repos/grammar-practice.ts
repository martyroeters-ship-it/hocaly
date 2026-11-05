import { prisma } from "@/lib/prisma"
import { getStructure, GRAMMAR_STRUCTURES, structuresForExactLevel } from "@/lib/grammar"
import {
  buildConjugationDrills,
  buildContextDrills,
  buildDailyBlankTest,
  buildParadigm,
  exampleParadigmsForStructure,
  isQuestionPrompt,
  stripInfinitive,
} from "@/lib/grammar/conjugate"
import {
  buildPracticeExercises,
  practiceModeTitle,
  type PracticeModeId,
} from "@/lib/grammar/practice-exercises"
import { evaluateAgainst, evaluateTurkishTranslation, isPassing } from "@/lib/eval/match"
import { completeJson } from "@/lib/ai/provider"
import { todayKey } from "@/lib/dates"
import { z } from "zod"
import type { CefrLevel } from "@/lib/types"

export type PracticeModePass = {
  day: string
  score: number
  total: number
}

export type PracticeModesState = Partial<
  Record<"conjugation" | "blank" | "error-correction" | "translate" | "transform" | "master", PracticeModePass>
>

export function parsePracticeModesJson(raw: string | null | undefined): PracticeModesState {
  try {
    const parsed = JSON.parse(raw || "{}") as PracticeModesState
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

/** Modes that earned ≥80% today (shown as green checks in the Practice menu). */
export function practiceModesPassedToday(raw: string | null | undefined, today = todayKey()): string[] {
  const state = parsePracticeModesJson(raw)
  return Object.entries(state)
    .filter(([, value]) => {
      if (!value || value.day !== today || value.total <= 0) return false
      return value.score / value.total >= 0.8
    })
    .map(([mode]) => mode)
}

export async function grammarProgressSummary() {
  const skills = await prisma.grammarSkill.findMany()
  const byId = new Map(skills.map((row) => [row.structureId, row]))
  const today = todayKey()
  const items = GRAMMAR_STRUCTURES.map((structure) => {
    const skill = byId.get(structure.id)
    const attempts = skill?.reviewCount ?? 0
    const correct = skill?.correctCount ?? 0
    const accuracy = attempts ? Math.round((correct / attempts) * 100) : null
    const weakness = attempts === 0 ? 0.4 : 1 - correct / Math.max(1, attempts)
    return {
      id: structure.id,
      label: structure.label,
      cefr: structure.cefr,
      category: structure.category,
      section: structure.section,
      attempts,
      correct,
      accuracy,
      focusScore: skill?.focusScore ?? weakness,
      lastReviewedAt: skill?.lastReviewedAt?.toISOString() ?? null,
      perfectToday: skill?.lastPerfectDay === today,
      imperfectToday: skill?.lastImperfectDay === today,
      /** Sticky until a mixed verification quiz is passed (4/4). */
      verifyPending: skill?.lastDiagnosticResult === "verify",
      diagnosticToday:
        skill?.lastDiagnosticDay === today
          ? skill.lastDiagnosticResult === "passed" || skill.lastDiagnosticResult === "attention"
            ? skill.lastDiagnosticResult
            : null
          : null,
      practiceModesPassed: practiceModesPassedToday(skill?.practiceModesJson, today),
    }
  })
  const focus = [...items]
    .filter((item) => item.attempts > 0 && ((item.accuracy ?? 100) < 90 || item.focusScore >= 0.6))
    .sort((a, b) => b.focusScore - a.focusScore || (a.accuracy ?? 100) - (b.accuracy ?? 100))
    .slice(0, 12)
  const known = items.filter((item) => (item.accuracy ?? 0) >= 70 && (item.attempts ?? 0) >= 5).map((item) => item.id)
  return { items, focus, knownCount: known.length, total: items.length }
}

const PRACTICE_MODES = new Set<PracticeModeId>([
  "conjugation",
  "blank",
  "error-correction",
  "translate",
  "transform",
  "master",
])

export async function createGrammarTest(options: {
  level?: CefrLevel | "mix"
  structureIds?: string[]
  mode?:
    | "verb"
    | "context"
    | "mixed"
    | "translate"
    | "blank"
    | "reading"
    | "daily"
    | "conjugation"
    | "error-correction"
    | "transform"
    | "master"
  isolate?: boolean
  count?: number
  verb?: string
}) {
  const mode = options.mode ?? "blank"
  const count = options.count ?? 10

  if (mode === "daily") {
    // 8 topics × 4 questions = 32; prefer Focus/weak structures when available.
    // Simple paradigm blanks only (Ben ______ (gelmek)) — no AI sentences.
    const dailyLevel = options.level ?? "mix"
    const summary = await grammarProgressSummary()
    const preferStructureIds = summary.focus
      .filter((item) => {
        if (!dailyLevel || dailyLevel === "mix") return item.cefr === "A1" || item.cefr === "A2"
        return item.cefr === dailyLevel
      })
      .map((item) => item.id)
    const seeds = buildDailyBlankTest({
      structureCount: 8,
      questionsPerStructure: 4,
      preferStructureIds,
      level: dailyLevel,
    })
    const items = seeds.map(localBlankFallback)
    return {
      mode: "blank" as const,
      structureIds: [...new Set(items.map((item) => item.structureId))],
      items,
      level: dailyLevel,
    }
  }

  let structureIds = options.structureIds?.filter(Boolean) ?? []
  if (!structureIds.length && options.level && options.level !== "mix") {
    structureIds = structuresForExactLevel(options.level).map((item) => item.id)
  }
  if (!structureIds.length) {
    structureIds = ["present-continuous", "simple-past", "future"]
  }
  if (options.isolate && structureIds[0]) {
    structureIds = [structureIds[0]]
  }

  if (PRACTICE_MODES.has(mode as PracticeModeId)) {
    const structureId = structureIds[0]!
    const practiceMode = mode as PracticeModeId
    const items = buildPracticeExercises(
      structureId,
      practiceMode,
      practiceMode === "master" ? 10 : count,
    )
    if (!items.length) throw new Error("No exercises available for this topic yet")
    return {
      mode: practiceMode,
      structureIds: [structureId],
      title: practiceModeTitle(practiceMode),
      items,
    }
  }

  if (mode === "reading") {
    const structure = getStructure(structureIds[0]!)
    if (!structure) throw new Error("Unknown grammar structure")
    const story = await generateReadingStory(structure.id, structure.label, structure.example)
    return {
      mode: "reading" as const,
      structureIds,
      items: story.sentences.map((sentence, index) => ({
        kind: "reading" as const,
        structureId: structure.id,
        structureLabel: structure.label,
        index,
        turkish: sentence.turkish,
        english: sentence.english,
        expected: sentence.english,
        accepted: [sentence.english],
        promptEnglish: sentence.turkish,
        sentenceCue: sentence.turkish,
      })),
      title: story.title,
    }
  }

  const primary = getStructure(structureIds[0]!)
  // Prefer live conjugation when the topic supports it; otherwise use catalog examples.
  // Never fall back to unrelated verb drills for a noun/case topic.
  const useStatic = primary && !primary.conjugable

  if (mode === "blank" || mode === "context") {
    // Simple paradigm prompts only — never call Gemini for fill-in-the-blank.
    const seeds = useStatic
      ? buildStaticExampleDrills(primary!, "blank", count)
      : buildContextDrills(structureIds, count)
    const fallback =
      !seeds.length && primary ? buildStaticExampleDrills(primary, "blank", count) : seeds
    const items = fallback.map(localBlankFallback)
    return {
      mode: "blank" as const,
      structureIds,
      items,
    }
  }

  if (mode === "translate" || mode === "verb") {
    if (useStatic) {
      return { mode: "translate" as const, structureIds, items: buildStaticExampleDrills(primary, "translate", count) }
    }
    const drills = buildConjugationDrills({
      structureIds,
      count,
      kind: "translate",
      verbTurkish: options.verb,
    })
    if (!drills.length && primary) {
      return {
        mode: "translate" as const,
        structureIds,
        items: buildStaticExampleDrills(primary, "translate", count),
      }
    }
    return {
      mode: "translate" as const,
      structureIds,
      verb: drills[0]?.verb,
      verbEnglish: drills[0]?.verbEnglish,
      items: drills.map(({ kind: _kind, ...item }) => ({ ...item, kind: "translate" as const })),
    }
  }

  // mixed legacy
  const verbDrills = buildConjugationDrills({ structureIds, count: Math.floor(count / 2), kind: "translate" })
  const context = buildContextDrills(structureIds, Math.ceil(count / 2))
  return {
    mode: "mixed" as const,
    structureIds,
    items: [
      ...verbDrills.map(({ kind: _kind, ...item }) => ({ ...item, kind: "translate" as const })),
      ...context.map(({ kind: _kind, ...item }) => ({ ...item, kind: "blank" as const })),
    ],
  }
}

function buildStaticExampleDrills(
  structure: NonNullable<ReturnType<typeof getStructure>>,
  kind: "blank" | "translate",
  count: number,
) {
  const paradigms = exampleParadigmsForStructure(structure.id)
  const pool = paradigms.flatMap((example) =>
    example.forms
      // Browse-only sentence examples — never quiz these.
      .filter((form) => form.label.trim().toLowerCase() !== "example")
      .map((form) => ({
        headword: example.headword,
        english: example.english,
        label: form.label,
        turkish: form.turkish,
      })),
  )
  const seed =
    pool.length > 0
      ? pool
      : [{ headword: structure.label, english: structure.hint, label: "example", turkish: structure.example }]

  const unique: typeof seed = []
  const seenAnswers = new Set<string>()
  for (const row of [...seed].sort(() => Math.random() - 0.5)) {
    const answer = row.turkish.replace(/\?$/, "").trim().toLocaleLowerCase("tr-TR")
    if (!answer || seenAnswers.has(answer)) continue
    seenAnswers.add(answer)
    unique.push(row)
  }

  const items = []
  for (const row of unique.slice(0, count)) {
    // Never treat "A / B" catalog notes as one answer — take the first clean form.
    const alternatives = row.turkish
      .split(/\s*\/\s*/)
      .map((part) => part.trim())
      .filter(Boolean)
    const expected = alternatives[0] ?? row.turkish.trim()
    const expectedBare = expected.replace(/[?!]+$/, "")
    const accepted = [
      ...new Set(
        alternatives.flatMap((part) => {
          const bare = part.replace(/[?!]+$/, "")
          return part === bare ? [part] : [part, bare]
        }),
      ),
    ]
    const label =
      row.label.charAt(0).toLocaleUpperCase("tr-TR") + row.label.slice(1)
    const qMark = isQuestionPrompt(structure, expected) ? "?" : ""
    const hint = kind === "blank" ? row.headword : row.english
    const cue = `${label} ______${qMark} (${hint})`
    if (kind === "blank") {
      items.push({
        kind: "blank" as const,
        structureId: structure.id,
        structureLabel: structure.label,
        turkishPrompt: cue,
        sentenceCue: cue,
        expected: expectedBare,
        accepted,
        verb: row.headword,
        verbEnglish: row.english,
      })
    } else {
      items.push({
        kind: "translate" as const,
        structureId: structure.id,
        structureLabel: structure.label,
        turkishPrompt: cue,
        sentenceCue: cue,
        promptEnglish: cue,
        expected: expectedBare,
        accepted,
        verb: row.headword,
      })
    }
  }
  return items
}

const readingSchema = z.object({
  title: z.string(),
  sentences: z
    .array(
      z.object({
        turkish: z.string().min(1),
        english: z.string().min(1),
      }),
    )
    .min(8)
    .max(12),
})

type BlankSeed = {
  structureId: string
  structureLabel: string
  verb?: string
  verbEnglish?: string
  turkishPrompt?: string
  sentenceCue?: string
  expected: string
  accepted?: string[]
  kind?: string
}

type BlankItem = {
  kind: "blank"
  structureId: string
  structureLabel: string
  verb?: string
  verbEnglish?: string
  turkishPrompt: string
  english?: string
  expected: string
  accepted: string[]
  sentenceCue: string
}

/** Ensure ______ is followed by (lemma) so learners know what to conjugate/decline. */
function ensureLemmaAfterBlank(sentence: string, lemma?: string) {
  const hint = lemma?.trim()
  if (!hint) return sentence
  if (/_{3,}\s*\([^)]+\)/.test(sentence)) return sentence
  return sentence.replace(/_{3,}/, (blank) => `${blank} (${hint})`)
}

/** Map a conjugation/static seed into a paradigm blank: `Ben ______ (gelmek)`. */
function localBlankFallback(seed: BlankSeed & { englishPrompt?: string; person?: string }): BlankItem & {
  englishPrompt?: string
} {
  const raw = seed.turkishPrompt ?? seed.sentenceCue ?? `______ (${seed.verb ?? seed.expected})`
  const cue = ensureLemmaAfterBlank(raw, seed.verb)
  return {
    kind: "blank",
    structureId: seed.structureId,
    structureLabel: seed.structureLabel,
    verb: seed.verb,
    verbEnglish: seed.verbEnglish,
    turkishPrompt: cue,
    expected: seed.expected,
    accepted: seed.accepted?.length ? seed.accepted : [seed.expected],
    sentenceCue: cue,
    englishPrompt: seed.englishPrompt,
  }
}

async function generateReadingStory(structureId: string, label: string, example: string) {
  try {
    return await completeJson({
      kind: "grammar-reading",
      schema: readingSchema,
      system: `You write a short A1–A2 Turkish reading for learners.
Return JSON only: { "title": "...", "sentences": [ { "turkish": "...", "english": "..." } ] }.
Exactly 10 sentences. Every sentence must clearly use the target grammar: ${label} (e.g. ${example}).
Keep vocabulary simple. English is a natural translation of each Turkish sentence.`,
      user: JSON.stringify({ structureId, label, example, sentenceCount: 10 }),
      cache: true,
      timeoutMs: 45_000,
    })
  } catch {
    // Deterministic fallback so practice still opens
    const structure = getStructure(structureId)
    const paradigms = exampleParadigmsForStructure(structureId)
    const forms = paradigms[0]?.forms ?? [{ label: "örnek", turkish: example }]
    const sentences = Array.from({ length: 10 }, (_, index) => {
      const form = forms[index % forms.length]!
      return {
        turkish: `${form.turkish}.`,
        english: `(${structure?.label ?? label}) ${form.label}: ${form.turkish}`,
      }
    })
    return { title: label, sentences }
  }
}

export function conjugateCustomVerb(structureId: string, verb: string) {
  const structure = getStructure(structureId)
  if (!structure) throw new Error("Unknown grammar structure")
  const headword = verb.trim()
  if (!headword) throw new Error("Enter a verb or noun")
  const forms = buildParadigm(structureId, headword)
  if (!forms.length) {
    throw new Error("This topic doesn’t support live conjugation for that word yet.")
  }
  return {
    structureId,
    headword,
    stem: stripInfinitive(headword),
    forms: forms.map((form) => ({ label: form.label, turkish: form.turkish, person: form.person })),
  }
}

export function structureBrowsePayload(structureId: string) {
  const structure = getStructure(structureId)
  if (!structure) throw new Error("Unknown grammar structure")
  return {
    structure,
    paradigms: exampleParadigmsForStructure(structureId),
  }
}

export async function gradeGrammarAnswer(options: {
  structureId: string
  prompt: string
  expected: string
  accepted?: string[]
  given: string
  verb?: string
  mode?: string
  requiredForm?: string
}) {
  const accepted = options.accepted?.length ? options.accepted : [options.expected]
  const lang = options.mode === "reading" ? "en" : "tr"
  const translateMode = (options.mode ?? "").includes("translate")
  const { result } = translateMode
    ? evaluateTurkishTranslation(options.given, accepted, options.requiredForm)
    : evaluateAgainst(options.given, accepted, lang)
  const passed = isPassing(result)
  const structure = getStructure(options.structureId)
  // Manual topic Practice must not grant diagnostic clean-pass credit.
  const mode = options.mode?.startsWith("manual")
    ? options.mode
    : options.mode === "blank" ||
        options.mode === "translate" ||
        options.mode === "reading" ||
        options.mode === "verb" ||
        options.mode === "context" ||
        options.mode === "conjugation" ||
        options.mode === "error-correction" ||
        options.mode === "transform" ||
        options.mode === "master"
      ? `manual:${options.mode}`
      : options.mode ?? "manual:blank"

  await prisma.grammarAttempt.create({
    data: {
      structureId: options.structureId,
      verb: options.verb,
      prompt: options.prompt,
      expected: options.expected,
      given: options.given,
      result,
      mode,
    },
  })

  const existing = await prisma.grammarSkill.findUnique({ where: { structureId: options.structureId } })
  const reviewCount = (existing?.reviewCount ?? 0) + 1
  const correctCount = (existing?.correctCount ?? 0) + (passed ? 1 : 0)
  // Incorrect answers go straight into Focus; daily/blank misses get a strong bump.
  const focusScore = passed
    ? Math.max(0, (existing?.focusScore ?? 0.5) - 0.08)
    : Math.min(1, Math.max(existing?.focusScore ?? 0.5, 0.92))

  const { applyStructureOutcome, parseIntervalsJson, classifyMistake, parseCountJson, parseMistakeJson } =
    await import("@/lib/grammar/adaptive")
  const settings = await prisma.grammarSettings.findUnique({ where: { id: "default" } })
  const intervals = parseIntervalsJson(settings?.intervalsJson)
  const byType = parseCountJson(existing?.byTypeJson)
  const kindKey = (options.mode ?? "blank").replace(/^manual:/, "")
  byType[kindKey] = {
    c: (byType[kindKey]?.c ?? 0) + (passed ? 1 : 0),
    t: (byType[kindKey]?.t ?? 0) + 1,
  }
  const mistakes = parseMistakeJson(existing?.mistakeJson)
  if (!passed) {
    const cat = classifyMistake({
      structureId: options.structureId,
      expected: options.expected,
      given: options.given,
    })
    if (cat) mistakes[cat] = (mistakes[cat] ?? 0) + 1
  }

  const outcome = applyStructureOutcome({
    skill: existing
      ? {
          structureId: existing.structureId,
          cefrLevel: existing.cefrLevel,
          masteryStatus: existing.masteryStatus as import("@/lib/grammar/adaptive").MasteryStatus,
          consecutiveCleanPasses: existing.consecutiveCleanPasses,
          nextReviewAt: existing.nextReviewAt,
          lastDiagnosticAt: existing.lastDiagnosticAt,
          lastPracticeAt: existing.lastPracticeAt,
          recentCorrect: existing.recentCorrect,
          recentTotal: existing.recentTotal,
          assessmentDone: existing.assessmentDone,
          reviewCount: existing.reviewCount,
          correctCount: existing.correctCount,
          focusScore: existing.focusScore,
          diagnosticStreakDay: existing.diagnosticStreakDay,
          lastDiagnosticDay: existing.lastDiagnosticDay,
          lastDiagnosticResult:
            existing.lastDiagnosticResult === "passed" ||
            existing.lastDiagnosticResult === "attention" ||
            existing.lastDiagnosticResult === "verify"
              ? existing.lastDiagnosticResult
              : null,
          byTypeJson: existing.byTypeJson,
          mistakeJson: existing.mistakeJson,
        }
      : null,
    structureId: options.structureId,
    cefrLevel: structure?.cefr ?? existing?.cefrLevel ?? "A1",
    correct: passed ? 1 : 0,
    total: 1,
    source: "manual",
    intervals,
    byType,
    mistakes,
  })

  await prisma.grammarSkill.upsert({
    where: { structureId: options.structureId },
    update: {
      reviewCount,
      correctCount,
      lastReviewedAt: new Date(),
      focusScore,
      cefrLevel: structure?.cefr ?? existing?.cefrLevel ?? "A1",
      masteryStatus: outcome.masteryStatus,
      consecutiveCleanPasses: outcome.consecutiveCleanPasses,
      nextReviewAt: outcome.nextReviewAt,
      lastPracticeAt: outcome.lastPracticeAt ?? new Date(),
      recentCorrect: outcome.recentCorrect,
      recentTotal: outcome.recentTotal,
      byTypeJson: outcome.byTypeJson,
      mistakeJson: outcome.mistakeJson,
    },
    create: {
      structureId: options.structureId,
      cefrLevel: structure?.cefr ?? "A1",
      reviewCount: 1,
      correctCount: passed ? 1 : 0,
      lastReviewedAt: new Date(),
      focusScore,
      masteryStatus: outcome.masteryStatus,
      consecutiveCleanPasses: outcome.consecutiveCleanPasses,
      nextReviewAt: outcome.nextReviewAt,
      lastPracticeAt: new Date(),
      recentCorrect: outcome.recentCorrect,
      recentTotal: outcome.recentTotal,
      byTypeJson: outcome.byTypeJson,
      mistakeJson: outcome.mistakeJson,
    },
  })

  return {
    result,
    passed,
    expected: options.expected,
    tip: !passed && structure ? structure.focusTip : null,
  }
}

/** True when the left-rail red X is showing for this topic today. */
function hasAttentionMarkToday(
  skill: {
    lastImperfectDay?: string | null
    lastDiagnosticDay?: string | null
    lastDiagnosticResult?: string | null
  } | null | undefined,
  day: string,
) {
  if (!skill) return false
  if (skill.lastImperfectDay === day) return true
  return skill.lastDiagnosticDay === day && skill.lastDiagnosticResult === "attention"
}

/**
 * Record a finished topic-practice mode (conjugation / blank / … / master).
 * - Dropdown green check: any mode with ≥80% today
 * - Left-rail yellow ball: only master 10/10, and only when converting an existing X
 * Non-master modes never touch the left-rail topic mark.
 */
export async function recordPracticeModeSession(options: {
  structureId: string
  mode: PracticeModeId
  score: number
  total: number
}) {
  const structure = getStructure(options.structureId)
  if (!structure) throw new Error("Unknown grammar structure")
  const day = todayKey()
  const score = Math.max(0, options.score)
  const total = Math.max(1, options.total)
  const ratio = score / total

  await prisma.grammarSkill.upsert({
    where: { structureId: options.structureId },
    update: { cefrLevel: structure.cefr },
    create: {
      structureId: options.structureId,
      cefrLevel: structure.cefr,
    },
  })

  // Ensure column exists on older DBs, then merge JSON.
  try {
    await prisma.$executeRaw`ALTER TABLE GrammarSkill ADD COLUMN practiceModesJson TEXT DEFAULT '{}'`
  } catch {
    // column already present
  }

  const existing = await prisma.grammarSkill.findUnique({ where: { structureId: options.structureId } })
  const prev = parsePracticeModesJson(existing?.practiceModesJson)
  const previous = prev[options.mode]
  // Keep the stronger result for today so a later weaker retry doesn't clear the check.
  const keepPrevious =
    previous?.day === day && previous.total > 0 && previous.score / previous.total > ratio
  const next: PracticeModesState = {
    ...prev,
    [options.mode]: keepPrevious ? previous : { day, score, total },
  }
  const json = JSON.stringify(next)
  await prisma.$executeRaw`
    UPDATE GrammarSkill
    SET practiceModesJson = ${json}
    WHERE structureId = ${options.structureId}
  `

  let topicMark: "verify" | null = null
  // Only master 10/10 may change the left rail — and only X → yellow.
  if (options.mode === "master" && score === total && hasAttentionMarkToday(existing, day)) {
    await prisma.$executeRaw`
      UPDATE GrammarSkill
      SET lastPerfectDay = ${day},
          lastImperfectDay = NULL,
          lastDiagnosticDay = ${day},
          lastDiagnosticResult = 'verify'
      WHERE structureId = ${options.structureId}
    `
    topicMark = "verify"
  }

  return {
    structureId: options.structureId,
    mode: options.mode,
    score,
    total,
    passed: ratio >= 0.8,
    topicMark,
    practiceModesPassed: practiceModesPassedToday(json, day),
  }
}

export async function markGrammarPerfect(structureId: string) {
  const structure = getStructure(structureId)
  if (!structure) throw new Error("Unknown grammar structure")
  const day = todayKey()
  const existing = await prisma.grammarSkill.findUnique({ where: { structureId } })
  // Recovering from a current X (or already yellow) → yellow "needs verification", not a green check yet.
  const recovering =
    existing?.lastDiagnosticResult === "verify" ||
    existing?.lastImperfectDay === day ||
    (existing?.lastDiagnosticDay === day && existing?.lastDiagnosticResult === "attention")
  const mark = recovering ? "verify" : "passed"
  // Keep upsert free of day-mark columns so an older Prisma client still persists the check.
  await prisma.grammarSkill.upsert({
    where: { structureId },
    update: { lastPerfectDay: day, cefrLevel: structure.cefr },
    create: {
      structureId,
      cefrLevel: structure.cefr,
      lastPerfectDay: day,
    },
  })
  await prisma.$executeRaw`
    UPDATE GrammarSkill
    SET lastImperfectDay = NULL,
        lastDiagnosticDay = ${day},
        lastDiagnosticResult = ${mark}
    WHERE structureId = ${structureId}
  `
  return {
    structureId,
    lastPerfectDay: day,
    perfectToday: mark === "passed",
    verifyPending: mark === "verify",
  }
}

export async function markGrammarImperfect(structureId: string) {
  const structure = getStructure(structureId)
  if (!structure) throw new Error("Unknown grammar structure")
  const day = todayKey()
  await prisma.grammarSkill.upsert({
    where: { structureId },
    update: { lastPerfectDay: null, cefrLevel: structure.cefr },
    create: {
      structureId,
      cefrLevel: structure.cefr,
      lastPerfectDay: null,
    },
  })
  await prisma.$executeRaw`
    UPDATE GrammarSkill
    SET lastImperfectDay = ${day},
        lastDiagnosticDay = ${day},
        lastDiagnosticResult = 'attention'
    WHERE structureId = ${structureId}
  `
  return { structureId, lastImperfectDay: day, imperfectToday: true }
}

export async function dailyGrammarTips() {
  const summary = await grammarProgressSummary()
  const tips = summary.focus.slice(0, 5).map((item) => {
    const structure = getStructure(item.id)
    return {
      structureId: item.id,
      label: item.label,
      cefr: item.cefr,
      accuracy: item.accuracy,
      tip: structure?.focusTip ?? "Review the paradigm, then practise with one verb.",
    }
  })
  return tips
}
