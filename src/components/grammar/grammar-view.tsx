"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Check, ChevronDown, Loader2, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { BlankPrompt, stripBlankLemma } from "@/components/blank-prompt"
import { PageBody, PageHero } from "@/components/layout/page-hero"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/client"
import type { GrammarStructure } from "@/lib/grammar"
import { buildFormulationChain } from "@/lib/grammar/conjugate"
import { explainWrongAnswer } from "@/lib/grammar/explain-wrong"
import { getGrammarLesson } from "@/lib/grammar/lessons"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { CefrLevel } from "@/lib/types"
import { cn } from "@/lib/utils"

type ProgressItem = {
  id: string
  label: string
  cefr: string
  attempts: number
  accuracy: number | null
  focusScore: number
  perfectToday?: boolean
  imperfectToday?: boolean
  verifyPending?: boolean
  diagnosticToday?: "passed" | "attention" | null
  practiceModesPassed?: string[]
}

type AdaptiveProgressItem = {
  id: string
  label: string
  cefr: string
  masteryStatus: string
  due: boolean
  accuracy: number | null
  reviewCount: number
  focusScore: number
  assessmentDone: boolean
  nextReviewAt: string | null
}

type Tip = { structureId: string; label: string; cefr: string; accuracy: number | null; tip: string }

type Paradigm = {
  headword: string
  english: string
  forms: { label: string; turkish: string }[]
}

type DrillItem = {
  id?: string
  kind?:
    | "translate"
    | "blank"
    | "reading"
    | "verb"
    | "context"
    | "sentence"
    | "error-correction"
    | "conjugation"
    | "transform"
  structureId: string
  structureLabel: string
  verb?: string
  verbEnglish?: string
  promptEnglish?: string
  englishPrompt?: string
  sentenceCue?: string
  turkishPrompt?: string
  english?: string
  turkish?: string
  expected: string
  accepted?: string[]
  personLabel?: string
  brokenForm?: string
  uncertainKey?: boolean
  instruction?: string
  sourceSentences?: string[]
  turkishFull?: string
  requiredForm?: string
}

type TopicPracticeMode =
  | "conjugation"
  | "blank"
  | "error-correction"
  | "translate"
  | "transform"
  | "master"

type PracticeMode =
  | TopicPracticeMode
  | "reading"
  | "diagnostic"
  | "assessment"
  | "adaptive-practice"

type StructureScore = {
  structureId: string
  label: string
  correct: number
  total: number
  verdict: "weak" | "uncertain" | "passed"
  band?: "strong" | "review" | "prioritize"
}

type ResultsDashboard = {
  strong?: StructureScore[]
  needsReview?: StructureScore[]
  prioritize?: StructureScore[]
  needsAttention: StructureScore[]
  passedToday: StructureScore[]
  recommendedPractice: { structureId: string; label: string; cefr: string }[]
}

type AttemptReview = {
  prompt: string
  given: string
  expected: string
  passed: boolean
  result: string
  structureId: string
  structureLabel: string
  verb?: string
}

function parseLevelParam(value: string | null): CefrLevel | null {
  if (value === "A1" || value === "A2" || value === "B1" || value === "B2") return value
  return null
}

function isTranslateLike(item: Pick<DrillItem, "kind"> | null | undefined) {
  return item?.kind === "translate" || item?.kind === "sentence" || item?.kind === "transform"
}

const TOPIC_PRACTICE_OPTIONS: {
  mode: TopicPracticeMode
  title: string
  blurb: string
  level: string
}[] = [
  {
    mode: "conjugation",
    title: "Conjugation",
    blurb: "Can you construct the grammatical form?",
    level: "Easy",
  },
  {
    mode: "blank",
    title: "Fill in the Blank",
    blurb: "Can you apply the grammar in context?",
    level: "Medium",
  },
  {
    mode: "error-correction",
    title: "Error Correction",
    blurb: "Can you recognize and fix grammatical mistakes?",
    level: "Medium",
  },
  {
    mode: "translate",
    title: "Translation",
    blurb: "Can you independently construct a sentence?",
    level: "Hard",
  },
  {
    mode: "transform",
    title: "Sentence Transformation",
    blurb: "Can you manipulate grammar you’ve learned?",
    level: "Hard",
  },
  {
    mode: "master",
    title: "Master test",
    blurb: "10 questions · 2 of each exercise type",
    level: "Mixed",
  },
]

/** Review list prompt: English cue + blank underline for translate-style items. */
function reviewPromptFor(item: DrillItem) {
  if (item.kind === "transform" && item.sourceSentences?.length) {
    return `${item.sourceSentences.join(" / ")} ______`
  }
  if (item.kind === "error-correction") {
    return `${item.turkishPrompt ?? item.brokenForm ?? ""} → ______`
  }
  if (item.kind === "conjugation") {
    return `${item.turkishPrompt ?? ""} ______`
  }
  if (isTranslateLike(item)) {
    const english = item.englishPrompt ?? item.promptEnglish ?? ""
    return english ? `${english} ______` : "______"
  }
  return item.turkishPrompt ?? item.sentenceCue ?? item.promptEnglish ?? item.turkish ?? ""
}

export function GrammarView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [structures, setStructures] = useState<GrammarStructure[]>([])
  const [level, setLevel] = useState<CefrLevel>(() => parseLevelParam(searchParams.get("level")) ?? "A1")
  const [sectionFilter, setSectionFilter] = useState<string | null>(() => searchParams.get("section"))
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("topic"))
  const [urlReady, setUrlReady] = useState(false)
  const [progress, setProgress] = useState<ProgressItem[]>([])
  const [focusItems, setFocusItems] = useState<ProgressItem[]>([])
  const [tips, setTips] = useState<Tip[]>([])
  const [paradigms, setParadigms] = useState<Paradigm[]>([])
  const [customVerb, setCustomVerb] = useState("")
  const [customParadigms, setCustomParadigms] = useState<Paradigm[]>([])
  const [conjugating, setConjugating] = useState(false)
  const [lessonOpen, setLessonOpen] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("blank")
  const [items, setItems] = useState<DrillItem[]>([])
  const [index, setIndex] = useState(0)
  const [given, setGiven] = useState("")
  const [showLemmaTip, setShowLemmaTip] = useState(false)
  const [feedback, setFeedback] = useState<{
    result: string
    expected: string
    tip: string | null
    passed: boolean
  } | null>(null)
  const [attempts, setAttempts] = useState<AttemptReview[]>([])
  const attemptsRef = useRef<AttemptReview[]>([])
  const [reviewOpen, setReviewOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sessionTitle, setSessionTitle] = useState("Practice")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionKind, setSessionKind] = useState<
    "manual" | "diagnostic" | "assessment" | "practice" | "verify"
  >("manual")
  const [verifyCount, setVerifyCount] = useState(0)
  const [assessmentInfo, setAssessmentInfo] = useState<{
    incomplete: boolean
    a1Done: boolean
    a2Done: boolean
    activeSessionId: string | null
    structureCount?: number
    questionsPerStructure?: number
    totalQuestions?: number
    bannerLine?: string
    sessionIndex?: number
    sessionTotal?: number
  } | null>(null)
  const [assessmentTotal, setAssessmentTotal] = useState<number | null>(null)
  const [resultsDashboard, setResultsDashboard] = useState<ResultsDashboard | null>(null)
  const [adaptiveItems, setAdaptiveItems] = useState<AdaptiveProgressItem[]>([])
  const [masteryFilter, setMasteryFilter] = useState<string>("all")
  const [adaptiveCefrFilter, setAdaptiveCefrFilter] = useState<string>("all")
  const [dueOnly, setDueOnly] = useState(false)

  const levelStructures = useMemo(
    () => structures.filter((item) => item.cefr === level),
    [structures, level],
  )
  const visible = useMemo(
    () =>
      sectionFilter
        ? levelStructures.filter((item) => item.section === sectionFilter)
        : levelStructures,
    [levelStructures, sectionFilter],
  )
  const selected = structures.find((item) => item.id === selectedId) ?? visible[0] ?? null
  const current = items[index]
  const coveredProgress = useMemo(
    () =>
      progress
        .filter((item) => item.attempts > 0)
        .sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1)),
    [progress],
  )
  const topicMarkById = useMemo(() => {
    const map = new Map<string, "passed" | "attention" | "perfect" | "verify">()
    for (const item of progress) {
      // Yellow (verify) sticks until a mixed 4/4 verification pass.
      if (item.verifyPending) {
        map.set(item.id, "verify")
      } else if (item.perfectToday || item.diagnosticToday === "passed") {
        map.set(item.id, item.perfectToday ? "perfect" : "passed")
      } else if (item.imperfectToday || item.diagnosticToday === "attention") {
        map.set(item.id, "attention")
      }
    }
    return map
  }, [progress])

  const sections = useMemo(() => {
    const map = new Map<string, GrammarStructure[]>()
    for (const item of visible) {
      const list = map.get(item.section) ?? []
      list.push(item)
      map.set(item.section, list)
    }
    return [...map.entries()]
  }, [visible])

  function selectSection(next: string | null, forLevel: CefrLevel = level) {
    setLevel(forLevel)
    setSectionFilter(next)
    const pool = structures.filter(
      (item) => item.cefr === forLevel && (next ? item.section === next : true),
    )
    if (!pool.some((item) => item.id === selectedId) && pool[0]) {
      setSelectedId(pool[0].id)
    }
  }

  function jumpToStructure(id: string, cefr: string) {
    setLevel(cefr as CefrLevel)
    setSectionFilter(null)
    setSelectedId(id)
  }

  async function refreshProgress() {
    const params = new URLSearchParams()
    params.set("view", "progress/adaptive")
    if (adaptiveCefrFilter !== "all") params.set("cefr", adaptiveCefrFilter)
    if (masteryFilter !== "all") params.set("mastery", masteryFilter)
    if (dueOnly) params.set("due", "1")
    const [progressData, tipsData, adaptiveData, assessmentData, verifyData] = await Promise.all([
      api<{ items: ProgressItem[]; focus: ProgressItem[] }>("/api/grammar?view=progress"),
      api<{ tips: Tip[] }>("/api/grammar?view=tips"),
      api<{
        items: AdaptiveProgressItem[]
        assessment: {
          incomplete: boolean
          a1Done: boolean
          a2Done: boolean
          activeSessionId: string | null
        }
      }>(`/api/grammar?${params.toString()}`),
      api<{
        incomplete: boolean
        a1Done: boolean
        a2Done: boolean
        activeSessionId: string | null
      }>("/api/grammar?view=assessment"),
      api<{ count: number }>("/api/grammar?view=verify"),
    ])
    setProgress(progressData.items)
    setFocusItems(progressData.focus ?? [])
    setTips(tipsData.tips)
    setAdaptiveItems(adaptiveData.items ?? [])
    setAssessmentInfo(assessmentData ?? adaptiveData.assessment ?? null)
    setVerifyCount(verifyData.count ?? 0)
  }

  useEffect(() => {
    api<{
      structures: GrammarStructure[]
      assessment?: {
        incomplete: boolean
        a1Done: boolean
        a2Done: boolean
        activeSessionId: string | null
      }
    }>("/api/grammar")
      .then((data) => {
        setStructures(data.structures)
        if (data.assessment) setAssessmentInfo(data.assessment)
        const topicParam = searchParams.get("topic")
        const levelParam = parseLevelParam(searchParams.get("level"))
        const sectionParam = searchParams.get("section")
        const fromUrl = topicParam
          ? data.structures.find((item) => item.id === topicParam)
          : null
        if (fromUrl) {
          setSelectedId(fromUrl.id)
          setLevel(levelParam ?? (fromUrl.cefr as CefrLevel))
          const sectionOk =
            sectionParam &&
            data.structures.some(
              (item) =>
                item.cefr === (levelParam ?? fromUrl.cefr) && item.section === sectionParam,
            )
          setSectionFilter(sectionOk ? sectionParam : null)
        } else {
          const fallbackLevel = levelParam ?? "A1"
          setLevel(fallbackLevel)
          setSectionFilter(sectionParam)
          const pool = data.structures.filter(
            (item) =>
              item.cefr === fallbackLevel && (sectionParam ? item.section === sectionParam : true),
          )
          const first = pool[0] ?? data.structures.find((item) => item.cefr === "A1") ?? data.structures[0]
          setSelectedId(first?.id ?? null)
        }
        setUrlReady(true)
      })
      .catch((error) => toast.error(error.message))
    refreshProgress().catch(() => undefined)
    // Intentionally once on mount — URL is the restore source, then we write back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!urlReady || !selectedId) return
    const params = new URLSearchParams()
    params.set("topic", selectedId)
    params.set("level", level)
    if (sectionFilter) params.set("section", sectionFilter)
    const next = `${pathname}?${params.toString()}`
    const currentTopic = searchParams.get("topic")
    const currentLevel = searchParams.get("level")
    const currentSection = searchParams.get("section")
    if (
      currentTopic === selectedId &&
      currentLevel === level &&
      (currentSection ?? null) === sectionFilter
    ) {
      return
    }
    router.replace(next, { scroll: false })
  }, [urlReady, selectedId, level, sectionFilter, pathname, router, searchParams])

  useEffect(() => {
    if (!selected) {
      setParadigms([])
      return
    }
    setCustomParadigms([])
    setCustomVerb("")
    setLessonOpen(false)
    api<{ paradigms: Paradigm[] }>(`/api/grammar?view=browse&structureId=${encodeURIComponent(selected.id)}`)
      .then((data) => setParadigms(data.paradigms ?? []))
      .catch(() => setParadigms([]))
  }, [selected?.id])

  useEffect(() => {
    if (!modalOpen || !feedback || reviewOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter") return
      event.preventDefault()
      next()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [modalOpen, feedback, reviewOpen, index, items.length, attempts])

  async function conjugateCustom() {
    if (!selected || !customVerb.trim()) return
    const headword = customVerb.trim()
    setConjugating(true)
    try {
      const data = await api<{
        forms: { label: string; turkish: string }[]
        headword?: string
      }>("/api/grammar", {
        method: "POST",
        body: JSON.stringify({ action: "conjugate", structureId: selected.id, verb: headword }),
      })
      if (!data.forms?.length) throw new Error("No forms generated")
      setCustomParadigms((prev) => {
        const next = prev.filter(
          (item) => item.headword.toLocaleLowerCase("tr-TR") !== headword.toLocaleLowerCase("tr-TR"),
        )
        return [
          ...next,
          {
            headword,
            english: "your word",
            forms: data.forms,
          },
        ]
      })
      setCustomVerb("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not conjugate")
    } finally {
      setConjugating(false)
    }
  }

  async function startPractice(
    mode: PracticeMode | "daily",
    structureIds?: string[],
    dailyLevel?: CefrLevel | "mix",
  ) {
    setBusy(true)
    setFeedback(null)
    setGiven("")
    setShowLemmaTip(false)
    setIndex(0)
    setItems([])
    replaceAttempts([])
    setReviewOpen(false)
    setResultsDashboard(null)
    setSessionId(null)
    setSessionKind("manual")
    setPracticeMode(mode === "daily" ? "diagnostic" : mode)
    const dailyLabel =
      dailyLevel === "A1" ? "A1" : dailyLevel === "A2" ? "A2" : dailyLevel === "mix" ? "Mix" : null
    setSessionTitle(
      mode === "daily"
        ? dailyLabel
          ? `Daily diagnostic · ${dailyLabel}`
          : "Daily diagnostic"
        : TOPIC_PRACTICE_OPTIONS.find((item) => item.mode === mode)?.title ??
            (mode === "reading" ? "Reading" : "Practice"),
    )
    setModalOpen(true)
    try {
      if (mode === "daily") {
        const data = await api<{
          sessionId: string
          items: DrillItem[]
        }>("/api/grammar", {
          method: "POST",
          body: JSON.stringify({
            action: "diagnostic/start",
            level: dailyLevel ?? "mix",
          }),
        })
        if (!data.items?.length) throw new Error("No diagnostic items available")
        setSessionId(data.sessionId)
        setSessionKind("diagnostic")
        setPracticeMode("diagnostic")
        setItems(data.items)
        return
      }

      const data = await api<{ items: DrillItem[]; verb?: string; title?: string; aiWarning?: string }>(
        "/api/grammar",
        {
          method: "POST",
          body: JSON.stringify({
            action: "test",
            mode,
            isolate: true,
            structureIds: structureIds ?? (selected ? [selected.id] : []),
            count: 10,
          }),
        },
      )
      if (!data.items?.length) throw new Error("No exercises available for this topic yet")
      setItems(data.items)
      if (data.title) setSessionTitle(data.title)
      if (data.verb) toast.message(`Using “${data.verb}”`)
      if (data.aiWarning) toast.message(data.aiWarning)
    } catch (error) {
      setModalOpen(false)
      setItems([])
      toast.error(error instanceof Error ? error.message : "Could not start practice")
    } finally {
      setBusy(false)
    }
  }

  async function retakeAssessment() {
    setBusy(true)
    try {
      await api("/api/grammar", {
        method: "POST",
        body: JSON.stringify({ action: "assessment/retake" }),
      })
      await refreshProgress()
      toast.success("Assessment progress cleared — start again when ready")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset assessment")
    } finally {
      setBusy(false)
    }
  }

  async function startAssessmentSession(levels: Array<"A1" | "A2">, resume = false) {
    setBusy(true)
    setFeedback(null)
    setGiven("")
    setIndex(0)
    setItems([])
    replaceAttempts([])
    setReviewOpen(false)
    setResultsDashboard(null)
    setAssessmentTotal(null)
    setPracticeMode("assessment")
    setSessionKind("assessment")
    setSessionTitle("Initial assessment")
    setModalOpen(true)
    try {
      const data = await api<{
        sessionId: string
        batch?: DrillItem[]
        items?: DrillItem[]
        total: number
        answered?: number
        levelScope?: string
        bannerLine?: string
        sessionIndex?: number
        sessionTotal?: number
      }>("/api/grammar", {
        method: "POST",
        body: JSON.stringify(
          resume ? { action: "assessment/resume" } : { action: "assessment/start", levels },
        ),
      })
      const items = data.items ?? data.batch ?? []
      if (!items.length) throw new Error("No assessment items")
      setSessionId(data.sessionId)
      setAssessmentTotal(data.total)
      setItems(items)
      if (data.sessionIndex && data.sessionTotal) {
        setSessionTitle(`Initial assessment session ${data.sessionIndex} of ${data.sessionTotal}`)
      }
      // Resume mid-sitting: remaining items only; progress still uses overall total
      if (resume && typeof data.answered === "number" && data.answered > 0) {
        setIndex(0)
      }
    } catch (error) {
      setModalOpen(false)
      toast.error(error instanceof Error ? error.message : "Could not start assessment")
    } finally {
      setBusy(false)
    }
  }

  async function startVerificationSession() {
    setBusy(true)
    setFeedback(null)
    setGiven("")
    setShowLemmaTip(false)
    setIndex(0)
    setItems([])
    replaceAttempts([])
    setReviewOpen(false)
    setResultsDashboard(null)
    setSessionId(null)
    setAssessmentTotal(null)
    setPracticeMode("blank")
    setSessionKind("verify")
    setSessionTitle("Verification")
    setModalOpen(true)
    try {
      const data = await api<{ sessionId: string; items: DrillItem[]; total: number }>(
        "/api/grammar",
        {
          method: "POST",
          body: JSON.stringify({ action: "verify/start" }),
        },
      )
      if (!data.items?.length) throw new Error("No verification questions available")
      setSessionId(data.sessionId)
      setItems(data.items)
      setAssessmentTotal(data.total)
    } catch (error) {
      setModalOpen(false)
      toast.error(error instanceof Error ? error.message : "Could not start verification")
    } finally {
      setBusy(false)
    }
  }

  async function startTodayPractice(fromSessionId?: string) {
    setBusy(true)
    setFeedback(null)
    setGiven("")
    setIndex(0)
    setItems([])
    replaceAttempts([])
    setReviewOpen(false)
    setResultsDashboard(null)
    setPracticeMode("adaptive-practice")
    setSessionKind("practice")
    setSessionTitle("Today’s practice")
    setModalOpen(true)
    try {
      const data = await api<{ sessionId: string; items: DrillItem[]; structureIds: string[] }>(
        "/api/grammar",
        {
          method: "POST",
          body: JSON.stringify({
            action: "practice/start",
            level: level === "A1" || level === "A2" ? level : "mix",
            sessionId: fromSessionId ?? sessionId ?? undefined,
          }),
        },
      )
      if (!data.items?.length) throw new Error("No practice items")
      setSessionId(data.sessionId)
      setItems(data.items)
    } catch (error) {
      setModalOpen(false)
      toast.error(error instanceof Error ? error.message : "Could not start practice")
    } finally {
      setBusy(false)
    }
  }

  async function check() {
    if (!current || busy) return
    setBusy(true)
    try {
      if (sessionId && sessionKind !== "manual") {
        const data = await api<{
          result: string
          expected: string
          tip: string | null
          passed: boolean
          completed?: boolean
          continueItems?: DrillItem[]
          resultsDashboard?: ResultsDashboard | null
        }>("/api/grammar", {
          method: "POST",
          body: JSON.stringify({
            action: "session/grade",
            sessionId,
            itemId: current.id,
            given,
          }),
        })
        setFeedback({ result: data.result, expected: data.expected, tip: data.tip, passed: data.passed })
        const review: AttemptReview = {
          prompt: reviewPromptFor(current),
          given: given.trim(),
          expected: data.expected,
          passed: data.passed,
          result: data.result,
          structureId: current.structureId,
          structureLabel: current.structureLabel,
          verb: current.verb,
        }
        replaceAttempts([...attemptsRef.current, review])
        if (data.continueItems?.length) {
          setItems((prev) => [...prev, ...data.continueItems!])
        }
        if (data.completed && data.resultsDashboard) {
          setResultsDashboard(data.resultsDashboard)
        }
        await refreshProgress()
        return
      }

      const data = await api<{ result: string; expected: string; tip: string | null; passed: boolean }>("/api/grammar", {
        method: "POST",
        body: JSON.stringify({
          action: "grade",
          structureId: current.structureId,
          prompt: current.sentenceCue ?? current.turkishPrompt ?? current.promptEnglish ?? current.turkish,
          expected: current.expected,
          accepted: current.accepted,
          given,
          verb: current.verb,
          mode: `manual:${current.kind ?? practiceMode}`,
          requiredForm: current.requiredForm,
        }),
      })
      setFeedback({ result: data.result, expected: data.expected, tip: data.tip, passed: data.passed })
      const review: AttemptReview = {
        prompt: reviewPromptFor(current),
        given: given.trim(),
        expected: data.expected,
        passed: data.passed,
        result: data.result,
        structureId: current.structureId,
        structureLabel: current.structureLabel,
        verb: current.verb,
      }
      const nextAttempts = [...attemptsRef.current, review]
      replaceAttempts(nextAttempts)
      if (nextAttempts.length >= items.length) {
        await finalizeManualTopicIfComplete(nextAttempts)
      }
      await refreshProgress()
      if (!data.passed) {
        pushMissesToFocus([review])
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not grade")
    } finally {
      setBusy(false)
    }
  }

  function pushMissesToFocus(sessionAttempts: AttemptReview[]) {
    const missed = sessionAttempts.filter((item) => !item.passed)
    if (!missed.length) return
    setFocusItems((prev) => {
      const byId = new Map<string, ProgressItem>()
      for (const item of prev) byId.set(item.id, item)
      for (const miss of missed) {
        const structure = structures.find((row) => row.id === miss.structureId)
        byId.set(miss.structureId, {
          id: miss.structureId,
          label: miss.structureLabel,
          cefr: structure?.cefr ?? progress.find((row) => row.id === miss.structureId)?.cefr ?? "A1",
          attempts: (byId.get(miss.structureId)?.attempts ?? 0) + 1,
          accuracy: byId.get(miss.structureId)?.accuracy ?? 0,
          focusScore: 1,
        })
      }
      return [...byId.values()].sort((a, b) => b.focusScore - a.focusScore).slice(0, 12)
    })
  }

  function replaceAttempts(nextAttempts: AttemptReview[]) {
    attemptsRef.current = nextAttempts
    setAttempts(nextAttempts)
  }

  async function maybeMarkTopicResult(sessionAttempts: AttemptReview[]) {
    if (sessionKind !== "manual") return
    const total = sessionAttempts.length
    if (total === 0) return
    const structureIds = [...new Set(sessionAttempts.map((item) => item.structureId))]
    if (structureIds.length !== 1 || !structureIds[0]) return
    const correct = sessionAttempts.filter((item) => item.passed).length
    const topicPracticeModes: TopicPracticeMode[] = [
      "conjugation",
      "blank",
      "error-correction",
      "translate",
      "transform",
      "master",
    ]
    // Practice dropdown modes: ≥8/10 → green check in the menu.
    // Left-rail X → yellow only when Master is a perfect 10/10.
    if (topicPracticeModes.includes(practiceMode as TopicPracticeMode)) {
      await api("/api/grammar", {
        method: "POST",
        body: JSON.stringify({
          action: "practiceMode/record",
          structureId: structureIds[0],
          practiceMode,
          score: correct,
          total,
        }),
      })
      return
    }
    // Legacy non-dropdown practice paths (if any) keep old marking.
    const action = correct === total ? "markPerfect" : "markImperfect"
    await api("/api/grammar", {
      method: "POST",
      body: JSON.stringify({ action, structureId: structureIds[0] }),
    })
  }

  async function finalizeManualTopicIfComplete(sessionAttempts: AttemptReview[]) {
    if (sessionKind !== "manual") return
    if (sessionAttempts.length === 0 || sessionAttempts.length < items.length) return
    try {
      await maybeMarkTopicResult(sessionAttempts)
      await refreshProgress()
      const correct = sessionAttempts.filter((item) => item.passed).length
      if (correct <= 8 || sessionAttempts.some((item) => !item.passed)) {
        pushMissesToFocus(sessionAttempts)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save topic result")
    }
  }

  function next() {
    setFeedback(null)
    setGiven("")
    setShowLemmaTip(false)
    if (index + 1 >= items.length) {
      const sessionAttempts = attemptsRef.current
      setReviewOpen(true)
      void finalizeManualTopicIfComplete(sessionAttempts)
      return
    }
    setIndex((value) => value + 1)
  }

  function closePractice() {
    setModalOpen(false)
    setItems([])
    setFeedback(null)
    setGiven("")
    setShowLemmaTip(false)
    replaceAttempts([])
    setReviewOpen(false)
    setIndex(0)
    setSessionId(null)
    setSessionKind("manual")
    setAssessmentTotal(null)
    void refreshProgress().catch(() => undefined)
  }

  const filteredAdaptive = useMemo(() => {
    return adaptiveItems
      .filter((item) => (adaptiveCefrFilter === "all" ? true : item.cefr === adaptiveCefrFilter))
      .filter((item) => (masteryFilter === "all" ? true : item.masteryStatus === masteryFilter))
      .filter((item) => (dueOnly ? item.due : true))
  }, [adaptiveItems, adaptiveCefrFilter, masteryFilter, dueOnly])

  const currentKind = current?.kind
  const usesInlineBlank = Boolean(
    current &&
      (currentKind === "blank" ||
        ((currentKind == null || currentKind === "context" || currentKind === "verb") &&
          (practiceMode === "blank" ||
            practiceMode === "diagnostic" ||
            practiceMode === "assessment")) ||
        (practiceMode === "adaptive-practice" &&
          currentKind !== "translate" &&
          currentKind !== "sentence" &&
          currentKind !== "reading" &&
          currentKind !== "conjugation" &&
          currentKind !== "transform" &&
          currentKind !== "error-correction")),
  )

  const promptText =
    current?.kind === "error-correction"
      ? current.turkishPrompt ?? current.brokenForm ?? ""
      : current?.kind === "conjugation"
        ? current.turkishPrompt ?? ""
        : current?.kind === "transform"
          ? current.sourceSentences?.join("\n") ?? current.turkishPrompt ?? ""
          : current?.kind === "sentence" || current?.kind === "translate"
            ? current.englishPrompt ?? current.promptEnglish ?? current.turkishPrompt ?? ""
            : current?.turkishPrompt ?? current?.sentenceCue ?? current?.promptEnglish ?? ""

  const showTranslateTip =
    Boolean(current?.verb) &&
    (current?.kind === "translate" ||
      current?.kind === "transform" ||
      current?.kind === "sentence")
  const blankLemma =
    currentKind === "blank" || practiceMode === "diagnostic" || practiceMode === "assessment"
      ? current?.verb?.trim() || undefined
      : undefined
  const blankPromptText =
    blankLemma && usesInlineBlank ? stripBlankLemma(promptText) : promptText
  const selectedLesson = selected ? getGrammarLesson(selected.id) : null

  const tipLemma = blankLemma || (showTranslateTip ? current?.verb?.trim() : undefined)

  useEffect(() => {
    if (!modalOpen || feedback || reviewOpen || !tipLemma || showLemmaTip) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return
      event.preventDefault()
      setShowLemmaTip(true)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [modalOpen, feedback, reviewOpen, tipLemma, showLemmaTip])

  useEffect(() => {
    void refreshProgress().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masteryFilter, adaptiveCefrFilter, dueOnly])

  const sessionScore = useMemo(() => {
    const correct = attempts.filter((item) => item.passed).length
    return { correct, total: attempts.length }
  }, [attempts])

  const knownCount = progress.filter((item) => (item.accuracy ?? 0) >= 70 && item.attempts >= 5).length
  const totalStructures = progress.length || structures.length

  return (
    <div>
      <PageHero
        title="Grammar"
        subtitle="Browse A1–A2 structures, study full paradigms, then practise in a focused modal."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button disabled={busy} />}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Daily diagnostic
              <ChevronDown className="size-4 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onClick={() => void startPractice("daily", undefined, "A1")}>
                A1
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void startPractice("daily", undefined, "A2")}>
                A2
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void startPractice("daily", undefined, "mix")}>
                Mix
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busy || verifyCount === 0}
                onClick={() => void startVerificationSession()}
              >
                Verify{verifyCount > 0 ? ` (${verifyCount})` : ""}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <PageBody className="space-y-6">
      {assessmentInfo?.incomplete ? (
        <Card className="border-0 bg-accent/40 shadow-none ring-1 ring-black/8">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0 space-y-1">
              <p className="font-medium">
                {assessmentInfo.bannerLine
                  ? assessmentInfo.bannerLine.replace(/^[^:]+:\s*/, "")
                  : "Initial assessment"}
              </p>
              <p className="text-sm text-muted-foreground">
                Discover which grammar topics you’ve mastered and which need more practice
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {assessmentInfo.activeSessionId ? (
                <Button variant="outline" className="bg-white" disabled={busy} onClick={() => void startAssessmentSession(["A1", "A2"], true)}>
                  Resume
                </Button>
              ) : null}
              <Button variant="outline" className="bg-white" disabled={busy} onClick={() => void startAssessmentSession(["A1"])}>
                A1
              </Button>
              <Button variant="outline" className="bg-white" disabled={busy} onClick={() => void startAssessmentSession(["A2"])}>
                A2
              </Button>
              <Button variant="outline" className="bg-white" disabled={busy} onClick={() => void startAssessmentSession(["A1", "A2"])}>
                Both
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => void retakeAssessment()}>
                Retake
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : assessmentInfo && !assessmentInfo.incomplete ? (
        <Card className="border-0 bg-muted/40 shadow-none ring-1 ring-black/8">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="font-medium">
              {assessmentInfo.bannerLine?.replace(/^[^:]+:\s*/, "") ?? "Assessment complete"}
            </p>
            <Button variant="outline" className="bg-white" disabled={busy} onClick={() => void retakeAssessment()}>
              Retake
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["A1", "A2"] as CefrLevel[]).map((item) => {
          const levelSections = [
            ...new Set(structures.filter((row) => row.cefr === item).map((row) => row.section)),
          ]
          const active = level === item
          return (
            <DropdownMenu key={item}>
              <DropdownMenuTrigger
                render={
                  <Button size="sm" variant={active ? "default" : "outline"} />
                }
              >
                {item}
                {active && sectionFilter ? (
                  <span className="ml-1 max-w-40 truncate text-xs opacity-80">{sectionFilter}</span>
                ) : (
                  <span className="ml-1 text-xs opacity-70">
                    ({structures.filter((row) => row.cefr === item).length})
                  </span>
                )}
                <ChevronDown className="size-3.5 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-56">
                <DropdownMenuItem
                  onClick={() => selectSection(null, item)}
                  className={cn(active && !sectionFilter && "bg-accent")}
                >
                  All topics
                </DropdownMenuItem>
                {levelSections.map((section) => (
                  <DropdownMenuItem
                    key={section}
                    onClick={() => selectSection(section, item)}
                    className={cn(active && sectionFilter === section && "bg-accent")}
                  >
                    {section}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card className="border-0 shadow-none ring-1 ring-black/8">
          <CardHeader>
            <CardTitle className="text-base">Topics</CardTitle>
            <CardDescription>
              {sectionFilter
                ? `${visible.length} in ${sectionFilter}`
                : `${visible.length} structures`}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[40rem] space-y-4 overflow-auto">
            {sections.map(([section, rows]) => (
              <div key={section}>
                <p className="mb-1.5 px-1 text-sm font-medium text-black underline decoration-2 underline-offset-4">
                  {section}
                </p>
                <div className="space-y-0.5">
                  {rows.map((item) => {
                    const mark = topicMarkById.get(item.id)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                          selected?.id === item.id ? "bg-accent font-medium" : "hover:bg-muted",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block">{item.label}</span>
                          <span className="text-xs text-muted-foreground">{item.hint}</span>
                        </span>
                        {mark === "passed" || mark === "perfect" ? (
                          <Check
                            className="size-4 shrink-0 text-emerald-600"
                            aria-label={
                              mark === "passed" ? "Passed diagnostic today" : "Perfect score today"
                            }
                          />
                        ) : mark === "verify" ? (
                          <span
                            className="size-2.5 shrink-0 rounded-full bg-amber-400"
                            aria-label="Needs verification"
                            title="Needs verification"
                          />
                        ) : mark === "attention" ? (
                          <X
                            className="size-4 shrink-0 text-rose-500/80"
                            aria-label="Needs attention"
                          />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {selected ? (
            <Card className="border-0 shadow-none ring-1 ring-black/8">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="min-w-0 space-y-1.5">
                  <CardTitle className="text-xl">{selected.label}</CardTitle>
                  <CardDescription>
                    {selected.cefr}
                    {sectionFilter ? ` · ${sectionFilter}` : ""} · {selected.hint}
                    {selected.example ? ` · ${selected.example}` : ""}
                  </CardDescription>
                  {selected.focusTip && selected.focusTip !== selected.hint ? (
                    <p className="text-sm italic text-muted-foreground">{selected.focusTip}</p>
                  ) : null}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button disabled={busy} />}>
                    Practice
                    <ChevronDown className="size-4 opacity-70" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-80 w-max">
                    {TOPIC_PRACTICE_OPTIONS.map((option) => {
                      const modePassed = Boolean(
                        selected &&
                          progress
                            .find((item) => item.id === selected.id)
                            ?.practiceModesPassed?.includes(option.mode),
                      )
                      return (
                        <DropdownMenuItem
                          key={option.mode}
                          className={cn(
                            "items-start gap-3 whitespace-normal py-2.5",
                            option.mode === "master" && "mt-1 border-t border-border",
                          )}
                          onClick={() => void startPractice(option.mode)}
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="font-medium leading-none">{option.title}</p>
                            <p className="text-xs text-muted-foreground">{option.blurb}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {modePassed ? (
                              <Check
                                className="size-4 text-emerald-600"
                                aria-label={`${option.title} passed today`}
                              />
                            ) : null}
                            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              {option.level}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  {paradigms.map((example) => (
                    <div
                      key={`base-${example.headword}-${example.english}`}
                      className="w-full rounded-xl bg-muted/50 p-3 sm:max-w-none"
                    >
                      <p className="font-medium">
                        {example.headword}{" "}
                        <span className="text-sm font-normal text-muted-foreground">· {example.english}</span>
                      </p>
                      <ul className="mt-2 space-y-1 text-sm">
                        {example.forms.map((form, formIndex) => {
                          const isExample = form.label.trim().toLowerCase() === "example"
                          const prevIsExample =
                            example.forms[formIndex - 1]?.label.trim().toLowerCase() === "example"
                          const chain =
                            !isExample && selected
                              ? buildFormulationChain(selected.id, example.headword, form.turkish)
                              : null
                          return (
                            <li
                              key={`${form.label}-${form.turkish}`}
                              className={cn(
                                "flex justify-between gap-2",
                                isExample && !prevIsExample && "mt-2 border-t border-black/8 pt-2",
                              )}
                            >
                              <span className="text-muted-foreground">{form.label}</span>
                              {chain ? (
                                <Tooltip>
                                  <TooltipTrigger
                                    delay={200}
                                    className="cursor-help font-medium underline decoration-dotted decoration-muted-foreground/50 underline-offset-2"
                                    render={<span />}
                                  >
                                    {form.turkish}
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-sm font-mono text-xs">
                                    {chain}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="font-medium">{form.turkish}</span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                  {customParadigms.map((example) => (
                    <div
                      key={`custom-${example.headword}`}
                      className="w-full rounded-xl bg-muted/50 p-3 sm:max-w-none"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">
                          {example.headword}{" "}
                          <span className="text-sm font-normal text-muted-foreground">· {example.english}</span>
                        </p>
                        <button
                          type="button"
                          aria-label={`Remove ${example.headword}`}
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
                          onClick={() =>
                            setCustomParadigms((prev) =>
                              prev.filter((item) => item.headword !== example.headword),
                            )
                          }
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <ul className="mt-2 space-y-1 text-sm">
                        {example.forms.map((form) => {
                          const chain = selected
                            ? buildFormulationChain(selected.id, example.headword, form.turkish)
                            : null
                          return (
                            <li key={`${form.label}-${form.turkish}`} className="flex justify-between gap-2">
                              <span className="text-muted-foreground">{form.label}</span>
                              {chain ? (
                                <Tooltip>
                                  <TooltipTrigger
                                    delay={200}
                                    className="cursor-help font-medium underline decoration-dotted decoration-muted-foreground/50 underline-offset-2"
                                    render={<span />}
                                  >
                                    {form.turkish}
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-sm font-mono text-xs">
                                    {chain}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="font-medium">{form.turkish}</span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                  {!paradigms.length && !customParadigms.length ? (
                    <p className="text-sm text-muted-foreground sm:col-span-2">Examples coming soon for this topic.</p>
                  ) : null}
                </div>

                {selected.conjugable ? (
                  <div className="space-y-3 rounded-xl ring-1 ring-black/8 p-4">
                    <p className="text-sm font-medium">Try your own word</p>
                    <p className="text-sm text-muted-foreground">
                      {selected.category === "verb"
                        ? "Enter a Turkish verb (…mek/…mak) — we’ll add it as a card above."
                        : "Enter a Turkish noun — we’ll add it as a card above."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        value={customVerb}
                        onChange={(event) => setCustomVerb(event.target.value)}
                        placeholder={selected.category === "verb" ? "e.g. konuşmak" : "e.g. okul"}
                        className="max-w-xs"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            void conjugateCustom()
                          }
                        }}
                      />
                      <Button variant="outline" onClick={() => void conjugateCustom()} disabled={conjugating || !customVerb.trim()}>
                        {conjugating ? <Loader2 className="animate-spin" /> : null}
                        Generate
                      </Button>
                    </div>
                  </div>
                ) : null}

                {selectedLesson ? (
                  <div className="rounded-xl ring-1 ring-black/8">
                    <button
                      type="button"
                      aria-expanded={lessonOpen}
                      className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/40"
                      onClick={() => setLessonOpen((open) => !open)}
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="text-sm font-medium">Construction</p>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {selectedLesson.construction}
                        </p>
                      </div>
                      <ChevronDown
                        className={cn(
                          "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                          lessonOpen && "rotate-180",
                        )}
                      />
                    </button>
                    {lessonOpen ? (
                      <div className="space-y-5 border-t border-black/8 px-4 pb-4 pt-4">
                        <div className="space-y-1.5">
                          <p className="text-sm font-medium">Meaning</p>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {selectedLesson.meaning}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Examples</p>
                          <ul className="space-y-2.5">
                            {selectedLesson.sentences.map((sentence) => (
                              <li key={sentence.turkish} className="text-sm leading-relaxed">
                                <p className="font-medium">{sentence.turkish}</p>
                                <p className="text-muted-foreground">{sentence.english}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 pt-10">
        <h2 className="text-xl font-semibold tracking-tight">Your statistics</h2>
        <div className="flex flex-wrap gap-2">
          {(["all", "A1", "A2", "B1", "B2"] as const).map((item) => (
            <Button
              key={item}
              size="sm"
              variant={adaptiveCefrFilter === item ? "default" : "outline"}
              onClick={() => setAdaptiveCefrFilter(item)}
            >
              {item === "all" ? "All CEFR" : item}
            </Button>
          ))}
          <Button
            size="sm"
            variant={dueOnly ? "default" : "outline"}
            onClick={() => setDueOnly((value) => !value)}
          >
            Due only
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "unseen", "weak", "learning", "familiar", "strong", "mastered"] as const).map((item) => (
            <Button
              key={item}
              size="sm"
              variant={masteryFilter === item ? "default" : "outline"}
              onClick={() => setMasteryFilter(item)}
            >
              {item}
            </Button>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-0 shadow-none ring-1 ring-black/8">
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <CardDescription>
              {knownCount}/{totalStructures} structures looking solid · mastery + SRS
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-auto">
            {filteredAdaptive.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  className="truncate text-left hover:underline"
                  onClick={() => jumpToStructure(item.id, item.cefr)}
                >
                  {item.label}
                  <span className="ml-1 font-normal text-muted-foreground">
                    · {item.cefr} · {item.masteryStatus}
                    {item.due ? " · due" : ""}
                  </span>
                </button>
                <span className="shrink-0 text-muted-foreground">
                  {item.accuracy != null ? `${item.accuracy}%` : "—"}
                  <span className="ml-1 opacity-70">· {item.reviewCount}</span>
                </span>
              </div>
            ))}
            {!filteredAdaptive.length ? (
              <p className="text-sm text-muted-foreground">
                No matching structures. Take the daily diagnostic or initial assessment to start tracking.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-none ring-1 ring-black/8">
          <CardHeader>
            <CardTitle>Focus</CardTitle>
            <CardDescription>Forms you’ve been missing — practise these first.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(focusItems.length ? focusItems : tips.map((tip) => ({
              id: tip.structureId,
              label: tip.label,
              cefr: tip.cefr,
              attempts: 0,
              accuracy: tip.accuracy,
              focusScore: 1,
            }))).length === 0 ? (
              <p className="text-sm text-muted-foreground">No weak forms yet. Take the daily diagnostic to fill this list.</p>
            ) : (
              (focusItems.length
                ? focusItems
                : tips.map((tip) => ({
                    id: tip.structureId,
                    label: tip.label,
                    cefr: tip.cefr,
                    attempts: 0,
                    accuracy: tip.accuracy,
                    focusScore: 1,
                  }))
              ).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2">
                  <button
                    type="button"
                    className="text-left text-sm font-medium hover:underline"
                    onClick={() => jumpToStructure(item.id, item.cefr)}
                  >
                    {item.label}
                    <span className="ml-1 font-normal text-muted-foreground">· {item.cefr}</span>
                  </button>
                  <Button size="sm" variant="outline" onClick={() => void startPractice("blank", [item.id])}>
                    Practice
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        </div>
      </div>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) closePractice()
          else setModalOpen(true)
        }}
      >
        <DialogContent
          className={cn(
            "sm:max-w-lg",
            reviewOpen
              ? "flex max-h-[90vh] flex-col gap-3 overflow-hidden"
              : "max-h-[90vh] overflow-y-auto",
          )}
          showCloseButton
        >
          <DialogHeader className={reviewOpen ? "shrink-0" : undefined}>
            <DialogTitle>{reviewOpen ? "Results" : sessionTitle}</DialogTitle>
            <DialogDescription>
              {reviewOpen
                ? `${sessionScore.correct}/${sessionScore.total} correct`
                : current
                  ? sessionKind === "assessment" && assessmentTotal
                    ? `${(assessmentTotal - items.length) + index + 1}/${assessmentTotal}`
                    : `${index + 1}/${items.length}`
                  : "Loading…"}
            </DialogDescription>
          </DialogHeader>

          {reviewOpen ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {resultsDashboard ? (
                <div className="shrink-0 space-y-3 rounded-xl bg-muted/40 p-3 ring-1 ring-black/8">
                  {sessionKind === "assessment" ? (
                    <>
                      {(
                        [
                          ["Strong", resultsDashboard.strong ?? resultsDashboard.passedToday],
                          ["Needs review", resultsDashboard.needsReview ?? []],
                          [
                            "Prioritize practice",
                            resultsDashboard.prioritize ?? resultsDashboard.needsAttention,
                          ],
                        ] as const
                      ).map(([title, rows]) => (
                        <div key={title}>
                          <p className="text-sm font-medium">{title}</p>
                          <p className="text-sm text-muted-foreground">
                            {rows.length
                              ? rows
                                  .map((row) => `${row.label} (${row.correct}/${row.total})`)
                                  .join(", ")
                              : "None"}
                          </p>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm font-medium">Needs attention</p>
                        <p className="text-sm text-muted-foreground">
                          {resultsDashboard.needsAttention.length
                            ? resultsDashboard.needsAttention.map((row) => row.label).join(", ")
                            : "None — nice work"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Passed today</p>
                        <p className="text-sm text-muted-foreground">
                          {resultsDashboard.passedToday.length
                            ? resultsDashboard.passedToday.map((row) => row.label).join(", ")
                            : "None yet"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Recommended practice</p>
                        <p className="text-sm text-muted-foreground">
                          {resultsDashboard.recommendedPractice.length
                            ? resultsDashboard.recommendedPractice.map((row) => row.label).join(", ")
                            : "Keep reviewing weak topics"}
                        </p>
                      </div>
                    </>
                  )}
                  {sessionKind === "diagnostic" ? (
                    <Button
                      className="w-full"
                      onClick={() => {
                        setReviewOpen(false)
                        void startTodayPractice(sessionId ?? undefined)
                      }}
                    >
                      Start today’s practice
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
                {attempts.map((attempt, attemptIndex) => {
                  const wrongWhy = !attempt.passed
                    ? explainWrongAnswer(attempt.given, attempt.expected, attempt.structureId)
                    : null
                  return (
                    <div
                      key={`${attempt.prompt}-${attemptIndex}`}
                      className={cn(
                        "rounded-lg px-2.5 ring-1 ring-black/8",
                        attempt.passed
                          ? "bg-muted/40 py-1 text-sm"
                          : "bg-destructive/5 py-1.5 text-sm",
                      )}
                    >
                      <p className="font-medium leading-snug">
                        {wrongWhy ? (
                          <span className="inline leading-normal">
                            {(() => {
                              const parts = attempt.prompt.split(/_{3,}/)
                              const wrongAnswer = (
                                <Tooltip>
                                  <TooltipTrigger
                                    delay={150}
                                    className="mx-1 inline-block min-w-[6rem] cursor-help border-0 border-b-2 border-red-600 align-baseline font-semibold leading-none text-red-700"
                                    render={<span />}
                                  >
                                    {attempt.given || "—"}
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    className="max-w-xs border border-amber-300 bg-amber-200 text-sm font-normal text-amber-950 shadow-md"
                                  >
                                    {wrongWhy}
                                  </TooltipContent>
                                </Tooltip>
                              )
                              if (parts.length === 1) {
                                return (
                                  <>
                                    <span>{attempt.prompt} </span>
                                    {wrongAnswer}
                                  </>
                                )
                              }
                              return parts.map((part, partIndex) => (
                                <span key={`${part}-${partIndex}`}>
                                  {part}
                                  {partIndex < parts.length - 1 ? wrongAnswer : null}
                                </span>
                              ))
                            })()}
                          </span>
                        ) : (
                          <BlankPrompt
                            text={attempt.prompt}
                            lemma={
                              practiceMode === "blank" ||
                              practiceMode === "diagnostic" ||
                              practiceMode === "assessment"
                                ? attempt.verb
                                : undefined
                            }
                            fill={attempt.given || "—"}
                            tone="correct"
                          />
                        )}
                      </p>
                      {!attempt.passed ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Right answer:{" "}
                          <span className="font-medium text-foreground">{attempt.expected}</span>
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
              <Button className="shrink-0" onClick={closePractice}>
                Done
              </Button>
            </div>
          ) : current ? (
            <div className="space-y-3 py-2">
              {practiceMode === "reading" || current.kind === "reading" ? (
                <p className="text-lg leading-relaxed">{current.turkish ?? current.sentenceCue}</p>
              ) : current.kind === "transform" ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {current.instruction?.trim() ||
                      "Combine these two sentences into one."}
                  </p>
                  <div className="space-y-1.5 text-2xl font-medium leading-relaxed">
                    {(current.sourceSentences?.length
                      ? current.sourceSentences
                      : promptText.split("\n").filter(Boolean)
                    ).map((sentence) => (
                      <p key={sentence}>{sentence}</p>
                    ))}
                  </div>
                  <p className="text-2xl font-medium leading-[1.6]">
                    <BlankPrompt
                      text="______"
                      editable={!feedback}
                      value={given}
                      onValueChange={setGiven}
                      onSubmit={() => void check()}
                      autoFocus={!feedback}
                      fill={
                        feedback
                          ? !feedback.passed
                            ? given.trim() || "—"
                            : feedback.result === "spelling"
                              ? feedback.expected
                              : given.trim() || feedback.expected
                          : undefined
                      }
                      tone={feedback ? (feedback.passed ? "correct" : "incorrect") : undefined}
                    />
                  </p>
                </div>
              ) : current.kind === "error-correction" ? (
                <div className="space-y-3">
                  <p className="text-2xl font-medium leading-relaxed text-red-700/90">
                    {promptText}
                  </p>
                  <p className="text-2xl font-medium leading-[1.6]">
                    <BlankPrompt
                      text="______"
                      editable={!feedback}
                      value={given}
                      onValueChange={setGiven}
                      onSubmit={() => void check()}
                      autoFocus={!feedback}
                      fill={
                        feedback
                          ? !feedback.passed
                            ? given.trim() || "—"
                            : feedback.result === "spelling"
                              ? feedback.expected
                              : given.trim() || feedback.expected
                          : undefined
                      }
                      tone={feedback ? (feedback.passed ? "correct" : "incorrect") : undefined}
                    />
                  </p>
                  {current.englishPrompt ? (
                    <p className="text-sm text-muted-foreground">{current.englishPrompt}</p>
                  ) : null}
                </div>
              ) : current.kind === "conjugation" ||
                isTranslateLike(current) ||
                practiceMode === "translate" ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-2xl font-medium leading-relaxed">
                      <span>{current.kind === "translate" ? `“${promptText}”` : promptText}</span>
                      {current.kind !== "translate" &&
                      showLemmaTip &&
                      current.verb &&
                      current.kind !== "conjugation" ? (
                        <span className="text-base font-normal text-muted-foreground">
                          ({current.verb})
                        </span>
                      ) : null}
                    </p>
                    {current.kind === "translate" && showLemmaTip && current.verb ? (
                      <p className="text-sm text-muted-foreground">Use {current.verb}</p>
                    ) : null}
                  </div>
                  <p className="text-2xl font-medium leading-[1.6]">
                    <BlankPrompt
                      text="______"
                      editable={!feedback}
                      value={given}
                      onValueChange={setGiven}
                      onSubmit={() => void check()}
                      onRevealLemma={
                        tipLemma && !showLemmaTip ? () => setShowLemmaTip(true) : undefined
                      }
                      autoFocus={!feedback}
                      fill={
                        feedback
                          ? !feedback.passed
                            ? given.trim() || "—"
                            : feedback.result === "spelling"
                              ? feedback.expected
                              : given.trim() || feedback.expected
                          : undefined
                      }
                      tone={feedback ? (feedback.passed ? "correct" : "incorrect") : undefined}
                    />
                  </p>
                </div>
              ) : usesInlineBlank ? (
                <div className="space-y-2">
                  {current.englishPrompt &&
                  (practiceMode === "diagnostic" ||
                    practiceMode === "assessment" ||
                    current.kind === "blank") ? (
                    <p className="text-sm text-muted-foreground">{current.englishPrompt}</p>
                  ) : null}
                  <p className="text-2xl font-medium leading-[1.6]">
                    <BlankPrompt
                      text={blankPromptText}
                      hideEmbeddedLemma={Boolean(blankLemma)}
                      lemma={showLemmaTip ? blankLemma : undefined}
                      editable={!feedback}
                      value={given}
                      onValueChange={setGiven}
                      onSubmit={() => void check()}
                      onRevealLemma={
                        blankLemma && !showLemmaTip ? () => setShowLemmaTip(true) : undefined
                      }
                      autoFocus={!feedback}
                      fill={
                        feedback
                          ? !feedback.passed
                            ? given.trim() || "—"
                            : feedback.result === "spelling"
                              ? feedback.expected
                              : given.trim() || feedback.expected
                          : undefined
                      }
                      tone={feedback ? (feedback.passed ? "correct" : "incorrect") : undefined}
                    />
                  </p>
                </div>
              ) : (
                <p className="text-lg font-medium leading-relaxed">{promptText}</p>
              )}

              {feedback &&
              !feedback.passed &&
              (practiceMode === "reading" || current.kind === "reading") ? (
                <p className="text-lg font-semibold text-red-600">{given.trim() || "—"}</p>
              ) : null}
              <p className="min-h-5 text-sm text-muted-foreground">
                {feedback && !feedback.passed ? (
                  <>
                    Right answer:{" "}
                    <span className="font-medium text-foreground">{feedback.expected}</span>
                  </>
                ) : feedback?.result === "spelling" ? (
                  <>
                    Correct spelling:{" "}
                    <span className="font-medium text-foreground">{feedback.expected}</span>
                  </>
                ) : null}
              </p>

              {!feedback ? (
                <div className="space-y-3">
                  {practiceMode === "reading" || current.kind === "reading" ? (
                    <Input
                      autoFocus
                      value={given}
                      placeholder="Type the English meaning"
                      onChange={(event) => setGiven(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          void check()
                        }
                      }}
                    />
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={() => void check()} disabled={busy || !given.trim()}>
                      Check
                    </Button>
                    {showTranslateTip ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowLemmaTip((value) => !value)}
                      >
                        Tip
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Button autoFocus onClick={next}>
                    {index + 1 >= items.length ? "See results" : "Continue"}
                  </Button>
                  {showTranslateTip ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowLemmaTip((value) => !value)}
                    >
                      Tip
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="animate-spin" />
              Generating questions…
            </div>
          )}
        </DialogContent>
      </Dialog>
      </PageBody>
    </div>
  )
}
