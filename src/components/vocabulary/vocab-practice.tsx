"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/client"
import { evaluateAgainst, isPassing } from "@/lib/eval/match"
import type { WordListItem } from "@/lib/types"
import { looksLikeVerb } from "@/lib/turkish"
import { shufflePick } from "@/lib/vocab/groups"

export type VocabPracticeMode = "daily" | "context" | "en-tr" | "verbs"

type QueueItem = {
  word: WordListItem
  prompt: string
  expected: string[]
  lang: "tr" | "en"
  context?: string
}

function isVerbWord(word: WordListItem) {
  if (word.partOfSpeech === "verb") return true
  // Fallback only when POS is missing — prefer stored partOfSpeech.
  if (!word.partOfSpeech) {
    return looksLikeVerb(word.turkish) || looksLikeVerb(word.dictionaryForm ?? "")
  }
  return false
}

export function filterVerbWords(words: WordListItem[]) {
  return words.filter(isVerbWord)
}

function isProductionMode(mode: VocabPracticeMode) {
  return mode === "en-tr" || mode === "verbs"
}

function modeTitle(mode: VocabPracticeMode) {
  if (mode === "daily") return "Daily words"
  if (mode === "context") return "Meaning in context"
  if (mode === "verbs") return "Verbs only"
  return "English → Turkish"
}

export function VocabPractice({
  mode,
  words,
  onClose,
}: {
  mode: VocabPracticeMode
  words: WordListItem[]
  onClose: () => void
}) {
  const queue = useMemo(() => buildQueue(mode, words), [mode, words])
  const [index, setIndex] = useState(0)
  const [given, setGiven] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [score, setScore] = useState({ correct: 0, total: 0 })

  const current = queue[index]
  const production = isProductionMode(mode)

  useEffect(() => {
    setIndex(0)
    setGiven("")
    setFeedback(null)
    setScore({ correct: 0, total: 0 })
  }, [mode, words])

  if (!queue.length) {
    return (
      <Card className="border-0 shadow-none ring-1 ring-black/8">
        <CardHeader>
          <CardTitle>No words ready</CardTitle>
          <CardDescription>
            {mode === "verbs"
              ? "No verbs in the current list. Import verbs or clear filters."
              : "Add CEFR-tagged words or import a list first."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={onClose}>
            Back to library
          </Button>
        </CardContent>
      </Card>
    )
  }

  function check() {
    if (!current) return
    const { result } = evaluateAgainst(given, current.expected, current.lang)
    const passed = isPassing(result)
    setFeedback(passed ? "correct" : `incorrect · ${current.expected[0]}`)
    setScore((prev) => ({ correct: prev.correct + (passed ? 1 : 0), total: prev.total + 1 }))
    if (passed) {
      void api("/api/reviews", {
        method: "POST",
        body: JSON.stringify({
          wordId: current.word.id,
          rating: "good",
          face: production ? "production" : "recognition",
          source: `vocab-${mode}`,
          clientKey: crypto.randomUUID?.() ?? `v-${Date.now()}`,
        }),
      }).catch(() => undefined)
    } else {
      void api("/api/reviews", {
        method: "POST",
        body: JSON.stringify({
          wordId: current.word.id,
          rating: "again",
          face: production ? "production" : "recognition",
          source: `vocab-${mode}`,
          clientKey: crypto.randomUUID?.() ?? `v-${Date.now()}`,
        }),
      }).catch(() => undefined)
    }
  }

  function next() {
    setGiven("")
    setFeedback(null)
    if (index + 1 >= queue.length) {
      toast.success(`Session complete · ${score.correct}/${score.total}`)
      onClose()
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
    // next closes over index/score/queue — rebind when feedback or those change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback, index, score, queue.length])

  return (
    <Card className="border-0 shadow-none ring-1 ring-black/8">
      <CardHeader>
        <CardTitle>{modeTitle(mode)}</CardTitle>
        <CardDescription>
          {index + 1} / {queue.length}
          {score.total ? ` · ${score.correct}/${score.total}` : ""}
          {mode === "verbs" ? " · English → Turkish · verbs" : " · context over isolation"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {current?.context ? (
          <p className="rounded-xl bg-muted/60 p-3 text-lg leading-relaxed">{current.context}</p>
        ) : null}
        <p className="text-2xl font-semibold">{current?.prompt}</p>
        {!feedback ? (
          <>
            <Input
              autoFocus
              value={given}
              placeholder={production ? "Type Turkish" : "Type English meaning"}
              onChange={(event) => setGiven(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  check()
                }
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={check} disabled={!given.trim()}>
                Check
              </Button>
              <Button variant="outline" onClick={onClose}>
                Exit
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <p className="font-medium capitalize">{feedback}</p>
            <Button autoFocus onClick={next}>
              Continue
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function buildEnTrQueue(words: WordListItem[]): QueueItem[] {
  return shufflePick(words, Math.min(12, words.length)).map((word) => ({
    word,
    prompt: word.english || word.meanings[0] || "?",
    expected: [word.turkish, word.dictionaryForm].filter(Boolean) as string[],
    lang: "tr" as const,
    context: word.example?.turkish,
  }))
}

function buildQueue(mode: VocabPracticeMode, words: WordListItem[]): QueueItem[] {
  if (!words.length) return []
  const withExample = words.filter((word) => word.example?.turkish)
  if (mode === "en-tr") {
    return buildEnTrQueue(words)
  }
  if (mode === "verbs") {
    return buildEnTrQueue(filterVerbWords(words))
  }
  if (mode === "context") {
    const pool = withExample.length ? withExample : words
    return shufflePick(pool, Math.min(12, pool.length)).map((word) => ({
      word,
      prompt: "What does the focused word mean in this sentence?",
      expected: word.meanings.length ? word.meanings : [word.english],
      lang: "en" as const,
      context: highlightInSentence(word.example?.turkish || word.turkish, word.turkish),
    }))
  }
  // daily: prefer a few new + due/old with context
  const news = words.filter((word) => word.learningStatus === "new" || word.reviewCount === 0)
  const old = words.filter((word) => word.reviewCount > 0)
  const picked = [
    ...shufflePick(news, Math.min(6, news.length)),
    ...shufflePick(old, Math.min(6, old.length)),
  ]
  const unique = [...new Map(picked.map((word) => [word.id, word])).values()].slice(0, 12)
  return unique.map((word) => ({
    word,
    prompt: word.example?.turkish
      ? "Guess the meaning of the word used in context"
      : word.turkish,
    expected: word.meanings.length ? word.meanings : [word.english],
    lang: "en" as const,
    context: word.example?.turkish
      ? highlightInSentence(word.example.turkish, word.turkish)
      : undefined,
  }))
}

function highlightInSentence(sentence: string, word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return sentence.replace(new RegExp(`(${escaped}\\w*)`, "iu"), "「$1」")
}
