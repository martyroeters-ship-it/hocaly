"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { PageBody, PageHero } from "@/components/layout/page-hero"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/client"
import { evaluateAgainst, isPassing } from "@/lib/eval/match"
import { selectTranscriptQuizItems } from "@/lib/transcripts/quiz"
import { normalizeTurkish } from "@/lib/turkish"
import { shufflePick } from "@/lib/vocab/groups"
import { cn } from "@/lib/utils"

type TranscriptListItem = {
  id: string
  title: string
  cefrLevel: string | null
  sentenceCount: number
  targetCount: number
  createdAt: string
}

type QuizItem = {
  targetId: string
  sentence: string
  start: number
  end: number
  turkish: string
  english: string
}

type PrepareStage = "idle" | "extracting" | "translating" | "building" | "ready"

const STAGE_COPY: Record<Exclude<PrepareStage, "idle" | "ready">, { title: string; detail: string }> = {
  extracting: {
    title: "Extracting sentences",
    detail: "Finding words to quiz from your transcript…",
  },
  translating: {
    title: "Preparing meanings",
    detail: "Looking up English glosses for each target word…",
  },
  building: {
    title: "Building your quiz",
    detail: "Almost ready — setting up the first question…",
  },
}

export function TranscriptsView() {
  const [items, setItems] = useState<TranscriptListItem[]>([])
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [stage, setStage] = useState<PrepareStage>("idle")
  const [quiz, setQuiz] = useState<QuizItem[]>([])
  const [index, setIndex] = useState(0)
  const [given, setGiven] = useState("")
  const [hint, setHint] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [quizLoadingId, setQuizLoadingId] = useState<string | null>(null)
  const lastQuizKeysRef = useRef<Map<string, string[]>>(new Map())

  const busy = stage !== "idle" && stage !== "ready"
  const current = quiz[index]
  const stageMeta = busy ? STAGE_COPY[stage as Exclude<PrepareStage, "idle" | "ready">] : null

  const choices = useMemo(() => {
    if (!current) return []
    const distractors = shufflePick(
      quiz.map((item) => item.english).filter((item) => item && item !== current.english),
      3,
    )
    while (distractors.length < 3) distractors.push(`option ${distractors.length + 1}`)
    return shufflePick([current.english, ...distractors.slice(0, 3)], 4)
  }, [current, quiz])

  async function load() {
    const data = await api<{ items: TranscriptListItem[] }>("/api/transcripts")
    setItems(data.items)
  }

  useEffect(() => {
    load().catch((error) => toast.error(error.message))
  }, [])

  function beginQuiz(quizItems: QuizItem[], transcriptId?: string) {
    if (!quizItems.length) {
      toast.message("No vocabulary targets found in that transcript")
      setStage("idle")
      return
    }
    const avoidKeys = transcriptId ? lastQuizKeysRef.current.get(transcriptId) : undefined
    // API already samples; still dedupe + diversify + avoid the previous run's targets.
    const selected = selectTranscriptQuizItems(quizItems, Math.min(12, quizItems.length), { avoidKeys })
    if (transcriptId) {
      lastQuizKeysRef.current.set(
        transcriptId,
        selected.map((item) => normalizeTurkish(item.turkish)),
      )
    }
    setQuiz(selected)
    setIndex(0)
    setGiven("")
    setHint(false)
    setFeedback(null)
    setStage("ready")
  }

  async function upload() {
    setQuiz([])
    setStage("extracting")
    try {
      // Let the preparing UI paint before the long request.
      await new Promise((resolve) => setTimeout(resolve, 80))
      setStage("translating")
      const result = await api<{
        id: string
        sentenceCount: number
        targetCount: number
        quizItems?: QuizItem[]
      }>("/api/transcripts", {
        method: "POST",
        body: JSON.stringify({ title, text }),
      })
      setStage("building")
      toast.success(`${result.sentenceCount} sentences · ${result.targetCount} target words`)
      setText("")
      await load()
      if (result.quizItems?.length) {
        beginQuiz(result.quizItems, result.id)
      } else {
        await startQuiz(result.id)
      }
    } catch (error) {
      setStage("idle")
      toast.error(error instanceof Error ? error.message : "Could not parse transcript")
    }
  }

  async function startQuiz(transcriptId: string) {
    setQuiz([])
    setQuizLoadingId(transcriptId)
    setStage("building")
    try {
      const data = await api<{ items: QuizItem[] }>("/api/transcripts", {
        method: "POST",
        body: JSON.stringify({ action: "quiz", transcriptId }),
      })
      beginQuiz(data.items, transcriptId)
    } catch (error) {
      setStage("idle")
      toast.error(error instanceof Error ? error.message : "Could not start quiz")
    } finally {
      setQuizLoadingId(null)
    }
  }

  function checkTyped() {
    if (!current) return
    const { result } = evaluateAgainst(given, [current.english], "en")
    setFeedback(isPassing(result) ? "correct" : `incorrect · ${current.english}`)
  }

  function pickChoice(choice: string) {
    if (!current) return
    setGiven(choice)
    setFeedback(choice === current.english ? "correct" : `incorrect · ${current.english}`)
  }

  async function saveWord() {
    if (!current) return
    try {
      await api("/api/transcripts", {
        method: "POST",
        body: JSON.stringify({ action: "save-target", targetId: current.targetId }),
      })
      toast.success(`Saved “${current.turkish}” to vocabulary`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save word")
    }
  }

  function next() {
    setGiven("")
    setHint(false)
    setFeedback(null)
    if (index + 1 >= quiz.length) {
      toast.success("Transcript quiz complete")
      setQuiz([])
      setStage("idle")
      return
    }
    setIndex((value) => value + 1)
  }

  useEffect(() => {
    if (!feedback) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.repeat || event.isComposing) return
      event.preventDefault()
      next()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback, index, quiz.length])

  const parts = current
    ? {
        before: current.sentence.slice(0, current.start),
        target: current.sentence.slice(current.start, current.end) || current.turkish,
        after: current.sentence.slice(current.end || current.turkish.length),
      }
    : null

  return (
    <div>
      <PageHero
        title="Transcripts"
        subtitle="Paste a video transcript. We extract sentences and quiz vocabulary in context — type the meaning, or open a multiple-choice hint."
      />

      <PageBody className="space-y-6">
      {busy ? (
        <Card className="border-0 shadow-none ring-1 ring-black/8">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="relative flex size-16 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent/70" />
              <span className="relative flex size-14 items-center justify-center rounded-full bg-accent">
                <Loader2 className="size-7 animate-spin text-foreground" />
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-medium">{stageMeta?.title ?? "Preparing…"}</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {stageMeta?.detail ?? "Working on your transcript…"}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              {(["extracting", "translating", "building"] as const).map((step, i) => {
                const order = { extracting: 0, translating: 1, building: 2 } as const
                const currentOrder = order[stage as keyof typeof order] ?? 0
                const done = currentOrder > i
                const active = currentOrder === i
                return (
                  <span
                    key={step}
                    className={cn(
                      "size-2 rounded-full transition-colors",
                      done || active ? "bg-foreground" : "bg-muted-foreground/30",
                      active && "animate-pulse",
                    )}
                  />
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-none ring-1 ring-black/8">
          <CardHeader>
            <CardTitle>Upload transcript</CardTitle>
            <CardDescription>From the levelled videos you watch each day.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Title (optional)"
            />
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Paste Turkish transcript text…"
              className="min-h-40"
            />
            <Button onClick={() => void upload()} disabled={!text.trim()}>
              Extract & start quiz
            </Button>
          </CardContent>
        </Card>
      )}

      {current && parts && !busy ? (
        <Card className="border-0 shadow-none ring-1 ring-black/8">
          <CardHeader>
            <CardTitle>What does the highlighted word mean?</CardTitle>
            <CardDescription>
              {index + 1} / {quiz.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xl leading-relaxed">
              {parts.before}
              <span className="font-bold underline decoration-2 underline-offset-4">{parts.target}</span>
              {parts.after}
            </p>
            {!feedback ? (
              <>
                <Input
                  autoFocus
                  value={given}
                  placeholder="Type the English meaning"
                  onChange={(event) => setGiven(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      checkTyped()
                    }
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={checkTyped} disabled={!given.trim()}>
                    Check
                  </Button>
                  <Button variant="outline" onClick={() => setHint(true)}>
                    Hint (A B C D)
                  </Button>
                  <Button variant="ghost" onClick={() => void saveWord()}>
                    Save word
                  </Button>
                </div>
                {hint ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {choices.map((choice, i) => (
                      <Button key={choice} variant="outline" className="justify-start" onClick={() => pickChoice(choice)}>
                        {String.fromCharCode(65 + i)}. {choice}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="space-y-2">
                <p className="font-medium capitalize">{feedback}</p>
                <div className="flex flex-wrap gap-2">
                  <Button autoFocus onClick={next}>
                    Continue
                  </Button>
                  <Button variant="outline" onClick={() => void saveWord()}>
                    Save to vocabulary
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!busy ? (
        <Card className="border-0 shadow-none ring-1 ring-black/8">
          <CardHeader>
            <CardTitle>Recent transcripts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transcripts yet.</p>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.sentenceCount} sentences · {item.targetCount} words
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={quizLoadingId === item.id}
                    onClick={() => void startQuiz(item.id)}
                  >
                    {quizLoadingId === item.id ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Preparing
                      </>
                    ) : (
                      "Quiz"
                    )}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
      </PageBody>
    </div>
  )
}
