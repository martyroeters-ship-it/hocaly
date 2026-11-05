import { fail, ok, readBody } from "@/lib/api"
import { ensureDb, prisma } from "@/lib/prisma"
import { GRAMMAR_STRUCTURES, getStructure, grammarLevelsPresent, structuresForExactLevel } from "@/lib/grammar"
import {
  conjugateCustomVerb,
  createGrammarTest,
  dailyGrammarTips,
  gradeGrammarAnswer,
  grammarProgressSummary,
  markGrammarImperfect,
  markGrammarPerfect,
  recordPracticeModeSession,
  structureBrowsePayload,
} from "@/lib/repos/grammar-practice"
import {
  adaptiveProgress,
  assessmentIncomplete,
  continueDiagnostic,
  gradeAdaptiveAnswer,
  pendingVerificationTopics,
  resetAssessmentProgress,
  resumeAssessment,
  startAdaptivePractice,
  startAssessment,
  startDiagnostic,
  startVerification,
} from "@/lib/repos/grammar-adaptive"
import type { CefrLevel } from "@/lib/types"
import type { MasteryStatus } from "@/lib/grammar/adaptive"

export async function GET(request: Request) {
  try {
    await ensureDb()
    const url = new URL(request.url)
    const view = url.searchParams.get("view")
    const level = url.searchParams.get("level") as CefrLevel | null
    const structureId = url.searchParams.get("structureId")

    if (view === "progress") return ok(await grammarProgressSummary())
    if (view === "progress/adaptive" || view === "adaptive") {
      const cefr = (url.searchParams.get("cefr") as CefrLevel | "all" | null) ?? "all"
      const mastery = (url.searchParams.get("mastery") as MasteryStatus | "all" | null) ?? "all"
      const dueOnly = url.searchParams.get("due") === "1"
      return ok(await adaptiveProgress({ cefr, mastery, dueOnly }))
    }
    if (view === "assessment") return ok(await assessmentIncomplete())
    if (view === "verify") return ok(await pendingVerificationTopics())
    if (view === "tips") return ok({ tips: await dailyGrammarTips() })
    if (view === "levels") {
      return ok({
        levels: grammarLevelsPresent().map((item) => ({
          level: item,
          count: structuresForExactLevel(item).length,
        })),
      })
    }
    if (view === "browse" && structureId) {
      return ok(structureBrowsePayload(structureId))
    }
    if (level) {
      return ok({ level, structures: structuresForExactLevel(level) })
    }
    if (structureId) {
      const structure = getStructure(structureId)
      if (!structure) throw new Error("Unknown grammar structure")
      return ok({ structure, paradigms: structureBrowsePayload(structureId).paradigms })
    }

    const profile = await prisma.grammarProfile.findUnique({ where: { id: "default" } })
    const assessment = await assessmentIncomplete()
    return ok({
      structures: GRAMMAR_STRUCTURES,
      known: JSON.parse(profile?.knownJson ?? "[]") as string[],
      introduceNew: profile?.introduceNew ?? false,
      levels: grammarLevelsPresent(),
      assessment,
    })
  } catch (error) {
    return fail(error)
  }
}

export async function POST(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{
      action?: string
      known?: string[]
      introduceNew?: boolean
      level?: CefrLevel | "mix"
      levels?: Array<"A1" | "A2">
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
      structureId?: string
      prompt?: string
      expected?: string
      accepted?: string[]
      given?: string
      verb?: string
      sessionId?: string
      itemId?: string
      score?: number
      total?: number
      requiredForm?: string
      practiceMode?:
        | "conjugation"
        | "blank"
        | "error-correction"
        | "translate"
        | "transform"
        | "master"
    }>(request)

    if (body.action === "conjugate") {
      if (!body.structureId || !body.verb) throw new Error("Provide structureId and verb")
      return ok(conjugateCustomVerb(body.structureId, body.verb))
    }

    if (body.action === "assessment/start") {
      return ok(await startAssessment(body.levels ?? ["A1", "A2"]))
    }
    if (body.action === "assessment/resume") {
      const resumed = await resumeAssessment()
      if (!resumed) throw new Error("No active assessment to resume")
      return ok(resumed)
    }
    if (body.action === "assessment/reset" || body.action === "assessment/retake") {
      return ok(await resetAssessmentProgress())
    }
    if (body.action === "diagnostic/start") {
      return ok(await startDiagnostic(body.level ?? "mix"))
    }
    if (body.action === "diagnostic/continue") {
      if (!body.sessionId) throw new Error("Provide sessionId")
      return ok(await continueDiagnostic(body.sessionId))
    }
    if (body.action === "verify/start") {
      return ok(await startVerification())
    }
    if (body.action === "practice/start") {
      return ok(
        await startAdaptivePractice({
          level: body.level,
          structureIds: body.structureIds,
          sessionId: body.sessionId,
        }),
      )
    }
    if (body.action === "assessment/grade" || body.action === "diagnostic/grade" || body.action === "practice/grade" || body.action === "session/grade") {
      if (!body.sessionId || !body.itemId) throw new Error("Provide sessionId and itemId")
      return ok(
        await gradeAdaptiveAnswer({
          sessionId: body.sessionId,
          itemId: body.itemId,
          given: body.given ?? "",
        }),
      )
    }

    if (body.action === "test" || body.action === "daily") {
      return ok(
        await createGrammarTest({
          level: body.level,
          structureIds: body.structureIds,
          mode: body.action === "daily" ? "daily" : body.mode,
          isolate: body.isolate,
          count: body.count ?? (body.action === "daily" ? 32 : 10),
          verb: body.verb,
        }),
      )
    }

    if (body.action === "grade") {
      if (!body.structureId || !body.expected) throw new Error("Missing grade fields")
      return ok(
        await gradeGrammarAnswer({
          structureId: body.structureId,
          prompt: body.prompt ?? "",
          expected: body.expected,
          accepted: body.accepted,
          given: body.given ?? "",
          verb: body.verb,
          mode: body.mode,
          requiredForm: body.requiredForm,
        }),
      )
    }

    if (body.action === "markPerfect") {
      if (!body.structureId) throw new Error("Provide structureId")
      return ok(await markGrammarPerfect(body.structureId))
    }

    if (body.action === "markImperfect") {
      if (!body.structureId) throw new Error("Provide structureId")
      return ok(await markGrammarImperfect(body.structureId))
    }

    if (body.action === "practiceMode/record") {
      if (!body.structureId || !body.practiceMode) {
        throw new Error("Provide structureId and practiceMode")
      }
      return ok(
        await recordPracticeModeSession({
          structureId: body.structureId,
          mode: body.practiceMode,
          score: body.score ?? 0,
          total: body.total ?? 10,
        }),
      )
    }

    await prisma.grammarProfile.upsert({
      where: { id: "default" },
      update: {
        knownJson: JSON.stringify(body.known ?? []),
        introduceNew: Boolean(body.introduceNew),
      },
      create: {
        id: "default",
        knownJson: JSON.stringify(body.known ?? []),
        introduceNew: Boolean(body.introduceNew),
      },
    })
    return ok({ ok: true })
  } catch (error) {
    return fail(error)
  }
}
