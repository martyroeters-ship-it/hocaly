"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { Volume2 } from "lucide-react"
import { toast } from "sonner"
import { BlankPrompt } from "@/components/blank-prompt"
import { PageBody, PageHero } from "@/components/layout/page-hero"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/client"
import { isPassing } from "@/lib/eval/match"
import { playTurkishAudio } from "@/lib/speech/client-audio"
import { speakTurkish } from "@/lib/tts"
import type { EvalResult, TestMode, WordListItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  focusLabel,
  pickDailyStudyWords,
  wordCountForMinutes,
  type DailyStudyPrefs,
} from "@/lib/daily-study"
import { foldDiacritics } from "@/lib/turkish"
import { ClearSelectionButton, WordChipPicker } from "@/components/vocab/word-chip-picker"
import { localGroups, shufflePick, toLearnIds, type VocabGroup } from "@/lib/vocab/groups"

const COUNTS = [6, 8, 12, 16, 20]

const MODES: { id: TestMode; label: string; help: string }[] = [
  { id: "tr-en", label: "Turkish → English", help: "Type the meaning." },
  { id: "en-tr", label: "English → Turkish", help: "Recall the Turkish word." },
  { id: "cloze", label: "Fill in the blank", help: "Use the form the sentence needs." },
  { id: "multiple-choice", label: "Multiple choice", help: "Pick the best translation." },
  { id: "sentence", label: "Sentence translation", help: "Translate the English sentence." },
  { id: "listening", label: "Listening", help: "Identify the word you hear." },
]

type Item = {
  wordId: string
  mode: TestMode
  prompt: string
  expected: string
  extra?: string[]
  contextTurkish?: string
  contextEnglish?: string
}

function promptContext(item: Item) {
  if (item.mode === "cloze" || item.mode === "sentence") return null
  if (item.mode === "en-tr") return item.contextEnglish || null
  return item.contextTurkish || null
}

function contextSubject(item: Item) {
  if (item.mode === "en-tr") return item.prompt
  return item.prompt
}

const SUBJECT_SKIP = new Set(["to", "a", "an", "the", "of", "mek", "mak", "etmek", "olmak"])

function subjectNeedles(subject: string) {
  const parts = subject
    .split(/[,;/]+/)
    .flatMap((chunk) => chunk.trim().split(/\s+/))
    .map((part) => foldDiacritics(part.replace(/mek$|mak$/, "")))
    .filter((part) => part.length >= 2 && !SUBJECT_SKIP.has(part))
  return parts.length ? parts : [foldDiacritics(subject)].filter(Boolean)
}

function tokenHitsSubject(token: string, needles: string[]) {
  const folded = foldDiacritics(token)
  if (folded.length < 2) return false
  return needles.some((needle) => {
    if (needle.length < 2) return false
    if (folded === needle || folded.startsWith(needle)) return true
    return needle.length >= 4 && needle.startsWith(folded)
  })
}

function ContextSentence({
  sentence,
  subject,
  className,
  speak = true,
}: {
  sentence: string
  subject: string
  className?: string
  speak?: boolean
}) {
  const needles = subjectNeedles(subject)
  const pieces = sentence.split(/([\p{L}]+(?:['’][\p{L}]+)?)/u)
  const [playing, setPlaying] = useState(false)
  const highlighted = pieces.map((piece, index) => {
    if (!piece || !/[\p{L}]/u.test(piece) || !tokenHitsSubject(piece, needles)) return <Fragment key={index}>{piece}</Fragment>
    return (
      <span key={index} className="underline decoration-dotted decoration-neutral-400 underline-offset-[3px]">
        {piece}
      </span>
    )
  })

  async function playSentence() {
    if (playing) return
    setPlaying(true)
    try {
      await playTurkishAudio(sentence)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not play audio")
    } finally {
      setPlaying(false)
    }
  }

  if (!speak) {
    return <p className={className}>{highlighted}</p>
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <p className="min-w-0 flex-1">{highlighted}</p>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="shrink-0 text-muted-foreground"
        disabled={playing}
        aria-label={playing ? "Playing sentence" : "Listen"}
        aria-busy={playing}
        onClick={() => void playSentence()}
      >
        <Volume2 />
      </Button>
    </div>
  )
}

type Outcome = {
  item: Item
  turkish: string
  english: string
  given: string
  result: EvalResult
}

function foldLabel(value: string) {
  return value.trim().toLocaleLowerCase()
}

function showCorrectAnswer(result: EvalResult) {
  return result !== "correct"
}

function missedTypedForm(outcome: Outcome) {
  const expected = outcome.item.expected.trim()
  if (!expected) return null
  const answer = foldLabel(expected)
  if (answer === foldLabel(outcome.turkish) || answer === foldLabel(outcome.english)) return null
  return expected
}

function TestCompleteHeader({
  celebrate,
  passedCount,
  missedCount,
  total,
}: {
  celebrate: boolean
  passedCount: number
  missedCount: number
  total: number
}) {
  return (
    <PageHero
      title={
        <span className="inline-flex items-end gap-2.5 leading-none">
          <span>Test complete</span>
          <img
            src="/party-popper.png"
            alt=""
            width={60}
            height={53}
            className="h-[2em] w-[2em] shrink-0 object-contain object-bottom dark:invert"
            aria-hidden="true"
          />
        </span>
      }
      subtitle={
        <>
          {celebrate
            ? "Nice work — you’re getting these."
            : "You did a good job. Some words still need practice."}
          <span className="mt-1 block">
            {passedCount} of {total} correct
            {missedCount ? ` · ${missedCount} to try again` : ""}
          </span>
        </>
      }
    />
  )
}

export function TestsView({
  initialIds,
  initialMode,
  session,
  autoStart,
}: {
  initialIds?: string[]
  initialMode?: TestMode
  session?: DailyStudyPrefs | null
  autoStart?: boolean
}) {
  const [words, setWords] = useState<WordListItem[]>([])
  const [selected, setSelected] = useState<string[]>(initialIds ?? [])
  const [mode, setMode] = useState<TestMode>(initialMode ?? "tr-en")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [index, setIndex] = useState(0)
  const [given, setGiven] = useState("")
  const [feedback, setFeedback] = useState<{ result: EvalResult; explanation: string | null } | null>(null)
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [finished, setFinished] = useState(false)
  const submittingRef = useRef(false)
  const autoStarted = useRef(false)
  const [count, setCount] = useState(session ? wordCountForMinutes(session.minutes) : 12)
  const [groups, setGroups] = useState<VocabGroup[]>([])
  const [topic, setTopic] = useState("")
  const [topicBusy, setTopicBusy] = useState(false)
  const [pickLabel, setPickLabel] = useState("Random · still to learn")

  useEffect(() => {
    api<{ items: WordListItem[] }>("/api/words?take=400")
      .then((data) => {
        setWords(data.items)
        setGroups(localGroups(data.items))
        if (initialIds?.length) {
          setPickLabel("From library")
          if (autoStart && !autoStarted.current) {
            autoStarted.current = true
            void startTest(initialIds)
          }
          return
        }
        if (session) {
          const nextCount = wordCountForMinutes(session.minutes)
          setCount(nextCount)
          const picked = pickDailyStudyWords(data.items, session, nextCount)
          setSelected(picked)
          setPickLabel(focusLabel(session.focus))
          if (autoStart && picked.length && !autoStarted.current) {
            autoStarted.current = true
            void startTest(picked)
          }
          return
        }
        setSelected(shufflePick(toLearnIds(data.items), 12))
        setPickLabel("Random · still to learn")
      })
      .catch((error) => toast.error(error.message))
    api<{ groups: VocabGroup[] }>("/api/words/groups")
      .then((data) => setGroups(data.groups))
      .catch(() => undefined)
  }, [initialIds, autoStart, session])

  const current = items[index]
  const choices = current?.mode === "multiple-choice" ? current.extra ?? [] : []
  const passed = outcomes.filter((item) => isPassing(item.result))
  const missed = outcomes.filter((item) => !isPassing(item.result))
  const celebrate = outcomes.length > 0 && passed.length / outcomes.length > 0.6

  function applyIds(ids: string[], label: string) {
    const next = ids.length <= count ? shufflePick(ids, ids.length) : shufflePick(ids, count)
    setSelected(next)
    setPickLabel(label)
  }

  function randomFrom(pool: "all" | "to-learn" | "known") {
    const ids =
      pool === "known"
        ? words.filter((word) => word.correctCount > 0).map((word) => word.id)
        : pool === "to-learn"
          ? toLearnIds(words)
          : words.map((word) => word.id)
    if (!ids.length) {
      toast.message("No words in that set yet.")
      return
    }
    applyIds(
      ids,
      pool === "all" ? "Random mix" : pool === "to-learn" ? "Random · still to learn" : "Random · known",
    )
  }

  async function findTopic() {
    const query = topic.trim()
    if (query.length < 2) {
      toast.error("Type a subject, for example Holiday")
      return
    }
    setTopicBusy(true)
    try {
      const data = await api<{ wordIds: string[]; note?: string }>("/api/words/topic", {
        method: "POST",
        body: JSON.stringify({ topic: query, count }),
      })
      if (!data.wordIds.length) {
        toast.message(data.note || "Nothing in your list fits that subject yet.")
        return
      }
      setSelected(data.wordIds)
      setPickLabel(query)
      if (data.note) toast.message(data.note)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not find those words")
    } finally {
      setTopicBusy(false)
    }
  }

  async function startTest(wordIds: string[]) {
    if (!wordIds.length) return
    try {
      const data = await api<{ sessionId: string; items: Item[] }>("/api/tests", {
        method: "POST",
        body: JSON.stringify({ mode, wordIds }),
      })
      setSessionId(data.sessionId)
      setItems(data.items)
      setIndex(0)
      setGiven("")
      setFeedback(null)
      setOutcomes([])
      setFinished(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start test")
    }
  }

  async function start(wordIds = shufflePick(selected, Math.min(count, selected.length))) {
    await startTest(wordIds)
  }

  async function submit(answer = given, override?: EvalResult) {
    if (!sessionId || !current || submittingRef.current) return null
    submittingRef.current = true
    try {
      const data = await api<{ result: EvalResult; explanation: string | null }>("/api/tests", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          wordId: current.wordId,
          mode: current.mode,
          prompt: current.prompt,
          expected: current.expected,
          extra: current.extra,
          given: answer,
          override,
        }),
      })
      const word = words.find((item) => item.id === current.wordId)
      setFeedback(data)
      setOutcomes((prev) => {
        const next = [...prev]
        next[index] = {
          item: current,
          turkish: word?.turkish ?? current.expected,
          english: word?.english ?? "",
          given: answer,
          result: data.result,
        }
        return next
      })
      return data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check the answer")
      return null
    } finally {
      submittingRef.current = false
    }
  }

  async function checkAndContinue(answer = given) {
    if (!current || finished) return
    if (feedback) {
      continueNext()
      return
    }
    if (choices.length) return
    const data = await submit(answer)
    if (data && !showCorrectAnswer(data.result)) continueNext()
  }

  function continueNext() {
    setFeedback(null)
    setGiven("")
    if (index + 1 >= items.length) {
      setFinished(true)
      return
    }
    setIndex(index + 1)
  }

  function redoMissed() {
    const retry = missed.map((item) => item.item)
    if (!retry.length) return
    setItems(retry)
    setIndex(0)
    setGiven("")
    setFeedback(null)
    setOutcomes([])
    setFinished(false)
  }

  function backToSetup() {
    setFinished(false)
    setItems([])
    setSessionId(null)
    setOutcomes([])
    setFeedback(null)
    setGiven("")
    setIndex(0)
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.repeat || event.isComposing || event.keyCode === 229) return
      if (!current || finished) return
      event.preventDefault()
      void checkAndContinue()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const summary = useMemo(
    () => selected.map((id) => words.find((word) => word.id === id)).filter((word): word is WordListItem => Boolean(word)),
    [words, selected],
  )

  if (finished) {
    return (
      <div>
        <TestCompleteHeader
          celebrate={celebrate}
          passedCount={passed.length}
          missedCount={missed.length}
          total={outcomes.length}
        />
        <PageBody narrow className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Answered correctly</CardTitle>
            <CardDescription>These can sit in your known list.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {passed.length === 0 ? (
              <p className="text-sm text-muted-foreground">None this round.</p>
            ) : (
              passed.map((item, i) => (
                <div key={`${item.item.wordId}-ok-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                  <div>
                    <span className="font-medium">{item.turkish}</span>
                    {item.english && <span className="text-muted-foreground"> · {item.english}</span>}
                    {item.item.contextTurkish && (
                      <ContextSentence
                        className="mt-1 text-sm font-normal text-muted-foreground"
                        sentence={item.item.contextTurkish}
                        subject={item.turkish}
                      />
                    )}
                  </div>
                  {item.result === "spelling" && <span className="text-xs text-muted-foreground">spelling</span>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Still to learn</CardTitle>
            <CardDescription>Redo just these, with the same prompts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {missed.length === 0 ? (
              <p className="text-sm text-muted-foreground">Every word in this round was correct.</p>
            ) : (
              missed.map((item, i) => {
                const typed = missedTypedForm(item)
                return (
                  <div key={`${item.item.wordId}-miss-${i}`} className="rounded-lg bg-muted/50 px-3 py-2">
                    <div>
                      <span className="font-medium">{item.turkish}</span>
                      {item.english && <span className="text-muted-foreground"> · {item.english}</span>}
                    </div>
                    {item.item.contextTurkish && (
                      <ContextSentence
                        className="mt-1 text-sm text-muted-foreground"
                        sentence={item.item.contextTurkish}
                        subject={item.turkish}
                      />
                    )}
                    {item.given.trim() ? (
                      <p className="mt-1 text-sm text-muted-foreground">You wrote “{item.given}”</p>
                    ) : null}
                    {typed ? <p className="mt-1 text-sm">Correct: {typed}</p> : null}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          {missed.length > 0 && (
            <Button onClick={redoMissed}>Redo {missed.length} missed word{missed.length === 1 ? "" : "s"}</Button>
          )}
          <Button variant={missed.length ? "outline" : "default"} onClick={backToSetup}>
            Back to tests
          </Button>
        </div>
        </PageBody>
      </div>
    )
  }

  if (current) {
    return (
      <PageBody narrow className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {index + 1} / {items.length} · {MODES.find((item) => item.id === current.mode)?.label}
        </p>
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-3xl select-text">
              {current.mode === "listening" ? (
                "Listen"
              ) : current.mode === "cloze" || /_{3,}/.test(current.prompt) ? (
                <BlankPrompt text={current.prompt} />
              ) : (
                current.prompt
              )}
            </CardTitle>
            {promptContext(current) && (
              <ContextSentence
                className="text-sm font-normal text-muted-foreground"
                sentence={promptContext(current)!}
                subject={contextSubject(current)}
                speak={promptContext(current) === current.contextTurkish}
              />
            )}
            {current.mode === "listening" && (
              <Button variant="outline" onClick={() => speakTurkish(current.prompt)}>
                Play again
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {choices.length ? (
              <div className="grid gap-2">
                {choices.map((choice) => (
                  <Button key={choice} variant="outline" className="justify-start" onClick={() => void submit(choice)}>
                    {choice}
                  </Button>
                ))}
              </div>
            ) : (
              <Input
                key={`${index}-${current.wordId}`}
                autoFocus
                value={given}
                placeholder="Type your answer"
                onChange={(event) => setGiven(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.nativeEvent.isComposing) return
                  event.preventDefault()
                  event.stopPropagation()
                  void checkAndContinue(event.currentTarget.value)
                }}
              />
            )}
            {!feedback && !choices.length && <Button onClick={() => void submit()}>Check</Button>}
            {feedback && (
              <div className="space-y-2 rounded-lg bg-muted/60 p-3">
                <p className="font-medium capitalize">{feedback.result === "partial" ? "Close" : feedback.result}</p>
                {feedback.explanation && !/^expected\b/i.test(feedback.explanation) && (
                  <p className="text-sm text-muted-foreground">{feedback.explanation}</p>
                )}
                {showCorrectAnswer(feedback.result) && current.expected && (
                  <p className="text-sm">Correct: {current.expected}</p>
                )}
                {feedback.result !== "correct" && current.contextEnglish && (
                  <p className="text-sm text-muted-foreground">{current.contextEnglish}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button autoFocus onClick={continueNext}>
                    {index + 1 >= items.length ? "See results" : "Continue"}
                  </Button>
                  {feedback.result !== "correct" && (
                    <Button variant="outline" onClick={() => void submit(given, "correct")}>
                      Mark as correct
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </PageBody>
    )
  }

  return (
    <div>
      <PageHero
        title="Tests"
        subtitle="Active recall with generous matching for spelling and valid alternatives."
      />
      <PageBody className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        {MODES.map((item) => (
          <button
            key={item.id}
            onClick={() => setMode(item.id)}
            className={`rounded-xl border p-4 text-left ${mode === item.id ? "border-primary bg-muted/60" : "bg-card"}`}
          >
            <div className="font-medium">{item.label}</div>
            <p className="mt-1 text-sm text-muted-foreground">{item.help}</p>
          </button>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>How many words</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {COUNTS.map((item) => (
            <Button key={item} size="sm" variant={count === item ? "default" : "outline"} onClick={() => setCount(item)}>
              {item}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pick a set</CardTitle>
          <CardDescription>Random from your list, a detected category, or a subject you type.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => randomFrom("all")}>
              Random mix
            </Button>
            <Button size="sm" variant="outline" onClick={() => randomFrom("to-learn")}>
              Still to learn
            </Button>
            <Button size="sm" variant="outline" onClick={() => randomFrom("known")}>
              Known
            </Button>
          </div>

          {groups.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Categories in your list</p>
              <div className="flex flex-wrap gap-2">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    title={group.help}
                    onClick={() => applyIds(group.wordIds, group.name)}
                    className={`rounded-full border px-3 py-1 text-sm ${pickLabel === group.name ? "border-primary bg-muted/60" : "bg-card"}`}
                  >
                    {group.name}
                    <span className="ml-1 text-muted-foreground">{group.wordIds.length}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault()
              void findTopic()
            }}
          >
            <Input
              value={topic}
              placeholder="Holiday, food, work, feelings…"
              onChange={(event) => setTopic(event.target.value)}
            />
            <Button type="submit" variant="outline" disabled={topicBusy}>
              {topicBusy ? "Finding…" : "Find subject"}
            </Button>
          </form>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Your word list</p>
              <ClearSelectionButton selectedCount={selected.length} onClear={() => setSelected([])} />
            </div>
            {words.length ? (
              <WordChipPicker words={words} selected={selected} onSelectedChange={setSelected} />
            ) : (
              <p className="text-sm text-muted-foreground">Loading your words…</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>This test</CardTitle>
          <CardDescription>
            {summary.length} word{summary.length === 1 ? "" : "s"} · {pickLabel}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {summary.map((word) => (
            <button
              key={word.id}
              className="rounded-full bg-muted px-3 py-1 text-sm"
              onClick={() => setSelected((current) => current.filter((id) => id !== word.id))}
            >
              {word.turkish} ×
            </button>
          ))}
          {summary.length === 0 && <p className="text-sm text-muted-foreground">Pick a set above to start.</p>}
        </CardContent>
      </Card>
      <Button onClick={() => void start()} disabled={!selected.length}>
        Start test
      </Button>
      </PageBody>
    </div>
  )
}
