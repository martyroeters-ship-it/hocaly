"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { PageBody, PageHero } from "@/components/layout/page-hero"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/status-badge"
import { api } from "@/lib/client"
import {
  dailyStudyHref,
  dailyStudyPrefsFromQuery,
  filterWordsByPrefs,
  focusLabel,
  skillLabel,
  wordCountForMinutes,
  type DailyStudyPrefs,
} from "@/lib/daily-study"
import { speakTurkish } from "@/lib/tts"
import type { EvalResult, SrsRating, VocabFace, WordListItem } from "@/lib/types"

type Queue = {
  overdue: WordListItem[]
  dueToday: WordListItem[]
  news: WordListItem[]
  difficult: WordListItem[]
  sentenceCandidates: WordListItem[]
  newLimit: number
  newAlready: number
  pauseNew?: boolean
  overdueCount?: number
  recommendPauseNew?: boolean
  workflow: {
    reviewsDone: boolean
    newDone: boolean
    sentencesDone: boolean
    testDone: boolean
    storyDone: boolean
    pausedJson: string | null
  }
}

type Phase = "review" | "new" | "difficult" | "sentences" | "done"

const RATINGS: { id: SrsRating; label: string; key: string }[] = [
  { id: "again", label: "Again", key: "1" },
  { id: "hard", label: "Hard", key: "2" },
  { id: "good", label: "Good", key: "3" },
  { id: "easy", label: "Easy", key: "4" },
]

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${rest.toString().padStart(2, "0")}`
}

function applySessionFilter(items: WordListItem[], session: DailyStudyPrefs | null) {
  if (!session) return items
  return filterWordsByPrefs(items, { focus: "mixed", cefr: session.cefr, label: session.label })
}

function newClientKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `review-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function StudyToday() {
  const params = useSearchParams()
  const sessionKey = params.toString()
  const session = useMemo(() => dailyStudyPrefsFromQuery(new URLSearchParams(sessionKey)), [sessionKey])
  const practiceWords = !session || session.skills.includes("words")
  const cap = session ? wordCountForMinutes(session.minutes) : Number.POSITIVE_INFINITY

  const [queue, setQueue] = useState<Queue | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [phase, setPhase] = useState<Phase>("review")
  const [ready, setReady] = useState(false)
  const [remaining, setRemaining] = useState(() => (session?.minutes ?? 0) * 60)
  const [timedOut, setTimedOut] = useState(false)
  const [face, setFace] = useState<VocabFace>("recognition")
  const [typed, setTyped] = useState("")
  const [checkResult, setCheckResult] = useState<{
    result: EvalResult
    expected: string
    passing: boolean
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function load(resume = true) {
    const data = await api<Queue>("/api/study")
    setQueue(data)
    if (resume && !session && data.workflow.pausedJson) {
      const paused = JSON.parse(data.workflow.pausedJson) as { index: number; phase: Phase }
      setIndex(paused.index)
      setPhase(paused.phase)
    } else if (session) {
      setIndex(0)
    }
  }

  useEffect(() => {
    load().catch((error) => toast.error(error.message))
  }, [])

  useEffect(() => {
    if (!session) return
    const started = Date.now()
    const total = session.minutes * 60
    setRemaining(total)
    setTimedOut(false)
    const id = window.setInterval(() => {
      const left = Math.max(0, total - Math.round((Date.now() - started) / 1000))
      setRemaining(left)
      if (left === 0) setTimedOut(true)
    }, 1000)
    return () => window.clearInterval(id)
  }, [session, sessionKey])

  useEffect(() => {
    if (timedOut) toast.message("Time’s up — wrap up when you’re ready.")
  }, [timedOut])

  const reviews = useMemo(() => {
    const all = applySessionFilter(queue ? [...queue.overdue, ...queue.dueToday] : [], session)
    return Number.isFinite(cap) ? all.slice(0, cap) : all
  }, [queue, session, cap])

  const news = useMemo(() => {
    const all = applySessionFilter(queue?.news ?? [], session)
    const slots = Number.isFinite(cap) ? Math.max(0, cap - reviews.length) : all.length
    return all.slice(0, slots)
  }, [queue, session, cap, reviews.length])

  const difficult = useMemo(() => {
    const all = applySessionFilter(queue?.difficult ?? [], session)
    return all.slice(0, 8)
  }, [queue, session])

  useEffect(() => {
    if (!queue || ready) return
    if (reviews.length > 0) setPhase("review")
    else if (news.length > 0) setPhase("new")
    else if (difficult.length > 0) setPhase("difficult")
    else setPhase("sentences")
    setReady(true)
  }, [queue, ready, reviews.length, news.length, difficult.length])

  const list =
    phase === "review" ? reviews : phase === "new" ? news : phase === "difficult" ? difficult : []
  const current = practiceWords && phase !== "sentences" && phase !== "done" ? list[index] : undefined

  useEffect(() => {
    if (!current) return
    const nextFace = phase === "new" ? "recognition" : (current.suggestedFace ?? "recognition")
    setFace(nextFace)
    setRevealed(false)
    setTyped("")
    setCheckResult(null)
  }, [current?.id, phase])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!current || phase === "sentences" || phase === "done") return
      if (face === "production" && !checkResult) return
      if ((event.key === " " || event.key === "Enter") && face === "recognition" && !revealed) {
        event.preventDefault()
        setRevealed(true)
      }
      const rating = RATINGS.find((item) => item.key === event.key)
      if (rating && (revealed || checkResult)) {
        event.preventDefault()
        void grade(rating.id)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  async function persist(nextIndex: number, nextPhase: Phase, extra?: Partial<Queue["workflow"]>) {
    await api("/api/study", {
      method: "POST",
      body: JSON.stringify({
        workflow: {
          ...extra,
          pausedJson:
            nextPhase === "done" || nextPhase === "sentences"
              ? null
              : JSON.stringify({ index: nextIndex, phase: nextPhase }),
        },
      }),
    })
  }

  async function advanceAfterGrade() {
    const nextIndex = index + 1
    if (nextIndex < list.length) {
      setIndex(nextIndex)
      await persist(nextIndex, phase)
      return
    }
    if (phase === "review") {
      if (news.length) {
        setPhase("new")
        setIndex(0)
        await persist(0, "new", { reviewsDone: true })
      } else if (difficult.length) {
        setPhase("difficult")
        setIndex(0)
        await persist(0, "difficult", { reviewsDone: true, newDone: true })
      } else {
        setPhase("sentences")
        await persist(0, "sentences", { reviewsDone: true, newDone: true })
      }
    } else if (phase === "new") {
      if (difficult.length) {
        setPhase("difficult")
        setIndex(0)
        await persist(0, "difficult", { reviewsDone: true, newDone: true })
      } else {
        setPhase("sentences")
        await persist(0, "sentences", { reviewsDone: true, newDone: true })
      }
    } else if (phase === "difficult") {
      setPhase("sentences")
      await persist(0, "sentences", { reviewsDone: true, newDone: true })
    }
    await load(false)
  }

  async function grade(rating: SrsRating) {
    if (!current || submitting) return
    setSubmitting(true)
    try {
      await api("/api/reviews", {
        method: "POST",
        body: JSON.stringify({
          wordId: current.id,
          rating,
          source: phase === "difficult" ? "difficult" : "review",
          face,
          clientKey: newClientKey(),
        }),
      })
      await advanceAfterGrade()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save review")
    } finally {
      setSubmitting(false)
    }
  }

  async function checkProduction() {
    if (!current || submitting) return
    setSubmitting(true)
    try {
      const result = await api<{ result: EvalResult; expected: string; passing: boolean }>("/api/reviews", {
        method: "POST",
        body: JSON.stringify({ wordId: current.id, checkOnly: true, given: typed }),
      })
      setCheckResult(result)
      setRevealed(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check answer")
    } finally {
      setSubmitting(false)
    }
  }

  if (!queue || !ready) {
    return (
      <PageBody>
        <p className="text-muted-foreground">Loading today’s queue…</p>
      </PageBody>
    )
  }

  if (phase === "sentences") {
    return (
      <div>
        <Header queue={queue} session={session} remaining={remaining} phase={phase} />
        <PageBody className="space-y-6">
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Sentence practice</CardTitle>
            <CardDescription>
              Translate short sentences with words you studied today. Grammar stays at your profile CEFR.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              nativeButton={false}
              render={
                <Link
                  href={`/tests/study?mode=sentence&ids=${queue.sentenceCandidates
                    .slice(0, 10)
                    .map((item) => item.id)
                    .join(",")}`}
                />
              }
            >
              Practice sentences
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                setPhase("done")
                await persist(0, "done", { sentencesDone: true, pausedJson: null })
                toast.success("Daily study complete")
              }}
            >
              Skip for today
            </Button>
          </CardContent>
        </Card>
        </PageBody>
      </div>
    )
  }

  if (phase === "done" || (!current && !session)) {
    return (
      <div>
        <Header queue={queue} session={session} remaining={remaining} phase={phase} />
        <PageBody className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>You are caught up</CardTitle>
            <CardDescription>Due reviews come first. New words wait when the backlog is heavy.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button nativeButton={false} render={<Link href="/tests/study?mode=sentence" />}>
              Practice sentences
            </Button>
            <Button nativeButton={false} variant="outline" render={<Link href="/vocabulary" />}>
              Open vocabulary
            </Button>
          </CardContent>
        </Card>
        </PageBody>
      </div>
    )
  }

  return (
    <div>
      <Header queue={queue} session={session} remaining={remaining} phase={phase} />
      <PageBody className="space-y-6">
      {queue.recommendPauseNew ? (
        <p className="text-sm text-muted-foreground">
          Overdue backlog is large ({queue.overdueCount}). New words are paused until reviews catch up.
        </p>
      ) : null}
      {session ? <SkillPlan session={session} remaining={remaining} /> : null}
      {current ? (
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardDescription>
              {phase === "review" ? "Review" : phase === "new" ? "New word" : "Difficult word"} ·{" "}
              {face === "recognition" ? "Recognition" : "Active recall"} · {index + 1} / {list.length}
            </CardDescription>
            <CardTitle className="font-serif text-4xl">
              {face === "recognition" ? current.turkish : current.english || "No translation yet"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={current.learningStatus} />
              {current.partOfSpeech && <span className="text-sm text-muted-foreground">{current.partOfSpeech}</span>}
              {current.cefrLevel && <span className="text-sm text-muted-foreground">{current.cefrLevel}</span>}
              {face === "recognition" && (
                <Button size="sm" variant="ghost" onClick={() => speakTurkish(current.turkish)}>
                  Listen
                </Button>
              )}
            </div>

            {face === "production" && !checkResult ? (
              <div className="space-y-3">
                <Input
                  autoFocus
                  value={typed}
                  placeholder="Type the Turkish word"
                  onChange={(event) => setTyped(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      void checkProduction()
                    }
                  }}
                />
                <Button onClick={() => void checkProduction()} disabled={submitting || !typed.trim()}>
                  Check
                </Button>
                <p className="text-xs text-muted-foreground">Type from memory — no choices. Enter to check.</p>
              </div>
            ) : null}

            {face === "recognition" && !revealed ? (
              <Button onClick={() => setRevealed(true)}>Reveal English</Button>
            ) : null}

            {(face === "recognition" && revealed) || checkResult ? (
              <div className="space-y-3">
                {face === "recognition" ? (
                  <p className="text-xl">{current.english || "No translation yet"}</p>
                ) : (
                  <div className="space-y-1">
                    <p className="font-medium capitalize">{checkResult?.passing ? "Correct" : checkResult?.result}</p>
                    <p className="text-xl">{current.turkish}</p>
                    {checkResult && !checkResult.passing ? (
                      <p className="text-sm text-muted-foreground">Expected: {checkResult.expected}</p>
                    ) : null}
                  </div>
                )}
                {current.example && (
                  <div className="rounded-lg bg-muted/60 p-3">
                    <p>{current.example.turkish}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{current.example.english}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {RATINGS.map((item) => (
                    <Button
                      key={item.id}
                      disabled={submitting}
                      variant={item.id === "again" ? "destructive" : item.id === "good" ? "default" : "outline"}
                      onClick={() => void grade(item.id)}
                    >
                      {item.key} {item.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {face === "recognition"
                    ? "Keyboard: space to reveal, 1–4 to rate."
                    : "Keyboard: 1–4 to rate after checking."}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      </PageBody>
    </div>
  )
}

function Header({
  queue,
  session,
  remaining,
  phase,
}: {
  queue: Queue
  session: DailyStudyPrefs | null
  remaining: number
  phase: Phase
}) {
  return (
    <PageHero
      title="Study Today"
      subtitle={`${queue.overdue.length} overdue · ${queue.dueToday.length} due · ${queue.news.length} new of ${queue.newLimit}${
        queue.difficult?.length ? ` · ${queue.difficult.length} difficult` : ""
      }${phase !== "review" && phase !== "new" ? ` · ${phase}` : ""}${
        session
          ? ` · ${session.minutes} min · ${session.skills.map(skillLabel).join(", ")}${
              remaining > 0 ? ` · ${formatClock(remaining)} left` : " · time’s up"
            }`
          : ""
      }`}
    />
  )
}

function SkillPlan({ session, remaining }: { session: DailyStudyPrefs; remaining: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Continue this session</CardTitle>
        <CardDescription>
          {session.minutes} min · {focusLabel(session.focus)}
          {session.cefr !== "any" ? ` · ${session.cefr}` : ""}
          {session.label ? ` · ${session.label}` : ""}
          {remaining > 0 ? ` · ${formatClock(remaining)} left` : " · time’s up"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {session.skills.map((skill) => (
          <Button
            key={skill}
            nativeButton={false}
            variant={skill === session.skills[0] ? "default" : "outline"}
            render={<Link href={dailyStudyHref({ ...session, skills: [skill] })} />}
          >
            {skillLabel(skill)}
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}
