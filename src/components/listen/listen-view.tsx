"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { PageBody, PageHero } from "@/components/layout/page-hero"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CefrPicker } from "@/components/cefr-picker"
import { useProfileCefr } from "@/components/use-profile-cefr"
import { ClearSelectionButton, WordChipPicker } from "@/components/vocab/word-chip-picker"
import { api } from "@/lib/client"
import { playTurkishAudio, setTurkishAudioSpeed, stopTurkishAudio } from "@/lib/speech/client-audio"
import { hasTextSelection } from "@/lib/translate/selection"
import { listeningClipSec, pickDailyStudyWords, type DailyStudyPrefs } from "@/lib/daily-study"
import { shufflePick, toLearnIds } from "@/lib/vocab/groups"
import { type EvalResult, type ListeningFormat, type ListeningQuestion, type ListeningSentence, type WordListItem } from "@/lib/types"

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5] as const

type Exercise = {
  id: string
  title: string
  topic: string
  cefrLevel: string
  format: string
  durationSec: number
  speed: number
  turkish: string
  english: string
  sentences: ListeningSentence[]
  questions: ListeningQuestion[]
  dictation: { turkish: string; english: string }[]
  vocabPrompts: ListeningQuestion[]
  usedWords: string[]
  omittedWords: string[]
  saved: boolean
}

export function ListenView({
  initialIds,
  session,
}: {
  initialIds?: string[]
  session?: DailyStudyPrefs | null
}) {
  const [words, setWords] = useState<WordListItem[]>([])
  const [selected, setSelected] = useState<string[]>(initialIds ?? [])
  const [topic, setTopic] = useState("A morning in Istanbul")
  const [cefr, setCefr] = useProfileCefr(session?.cefr)
  const [format, setFormat] = useState<ListeningFormat>("monologue")
  const [durationSec, setDurationSec] = useState(session ? listeningClipSec(session.minutes) : 60)
  const [speed, setSpeed] = useState(1)
  const [busy, setBusy] = useState(false)
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [saved, setSaved] = useState<Exercise[]>([])
  const [showTranscript, setShowTranscript] = useState(false)
  const [showEnglish, setShowEnglish] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [sentenceIndex, setSentenceIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, EvalResult>>({})

  async function load() {
    const [vocab, listed] = await Promise.all([
      api<{ items: WordListItem[] }>("/api/words?take=400"),
      api<{ exercises: Exercise[] }>("/api/listening"),
    ])
    setWords(vocab.items)
    setSaved(listed.exercises)
    if (!selected.length) {
      if (initialIds?.length) setSelected(initialIds)
      else if (session) setSelected(pickDailyStudyWords(vocab.items, session, 8))
      else setSelected(shufflePick(toLearnIds(vocab.items), 6))
    }
  }

  useEffect(() => {
    load().catch((error) => toast.error(error.message))
    return () => stopTurkishAudio()
  }, [])

  const selectedWords = useMemo(() => words.filter((word) => selected.includes(word.id)), [words, selected])

  async function generate() {
    setBusy(true)
    try {
      const wordIds = selected.length <= 8 ? selected : shufflePick(selected, 8)
      if (wordIds.length < selected.length) {
        toast.message(`Using ${wordIds.length} of ${selected.length} words so the story stays natural.`)
      }
      const created = await api<Exercise>("/api/listening", {
        method: "POST",
        body: JSON.stringify({ wordIds, topic, cefr, format, durationSec, speed }),
      })
      setExercise(created)
      setShowTranscript(false)
      setShowEnglish(false)
      setAnswers({})
      setResults({})
      setSentenceIndex(0)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create listening practice")
    } finally {
      setBusy(false)
    }
  }

  async function playAll() {
    if (!exercise) return
    setPlaying(true)
    try {
      await playTurkishAudio(exercise.turkish, speed)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not play audio")
    } finally {
      setPlaying(false)
    }
  }

  async function replaySentence(index = sentenceIndex) {
    const sentence = exercise?.sentences[index]
    if (!sentence) return
    setSentenceIndex(index)
    setPlaying(true)
    try {
      await playTurkishAudio(sentence.turkish, speed)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not replay")
    } finally {
      setPlaying(false)
    }
  }

  async function grade(kind: "comprehension" | "dictation" | "vocab", key: string, prompt: string, expected: string, extra?: string[]) {
    if (!exercise) return
    const given = answers[key] ?? ""
    const data = await api<{ result: EvalResult }>("/api/listening", {
      method: "POST",
      body: JSON.stringify({ action: "grade", id: exercise.id, kind, prompt, given, expected, extra }),
    })
    setResults((current) => ({ ...current, [key]: data.result }))
  }

  if (exercise) {
    return (
      <div>
        <PageHero
          title={exercise.title}
          subtitle={`${exercise.cefrLevel} · ${exercise.format === "conversation" ? "conversation" : "story"} · ~${exercise.durationSec}s · Transcript hidden until you reveal it`}
          actions={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  stopTurkishAudio()
                  setExercise(null)
                }}
              >
                Back
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  const next = await api<Exercise>("/api/listening", {
                    method: "POST",
                    body: JSON.stringify({ action: "save", id: exercise.id, saved: true }),
                  })
                  setExercise(next)
                  toast.success("Saved for later review")
                  await load()
                }}
              >
                {exercise.saved ? "Saved" : "Save exercise"}
              </Button>
            </>
          }
        />
        <PageBody className="mx-auto max-w-3xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Listen</CardTitle>
            <CardDescription>Play the whole clip, or replay one sentence without showing the text.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button disabled={playing} onClick={playAll}>
                {playing ? "Playing…" : "Play audio"}
              </Button>
              <Button variant="outline" disabled={playing} onClick={() => replaySentence()}>
                Replay sentence
              </Button>
              <Button variant="outline" onClick={() => setShowTranscript((value) => !value)}>
                {showTranscript ? "Hide transcript" : "Show transcript"}
              </Button>
              <Button variant="outline" onClick={() => setShowEnglish((value) => !value)}>
                {showEnglish ? "Hide English" : "Show English"}
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Speed</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Speech speed">
                {SPEED_OPTIONS.map((rate) => (
                  <Button
                    key={rate}
                    type="button"
                    size="sm"
                    variant={speed === rate ? "default" : "outline"}
                    aria-pressed={speed === rate}
                    onClick={() => {
                      setSpeed(rate)
                      setTurkishAudioSpeed(rate)
                    }}
                  >
                    {rate}×
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        {showTranscript && (
          <Card>
            <CardHeader>
              <CardTitle>Interactive transcript</CardTitle>
              <CardDescription>Click a sentence to replay it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {exercise.sentences.map((sentence, index) => (
                <div
                  key={`${sentence.turkish}-${index}`}
                  role="button"
                  tabIndex={0}
                  className="block w-full cursor-pointer rounded-lg px-3 py-2 text-left select-text hover:bg-muted"
                  onClick={() => {
                    if (hasTextSelection()) return
                    void replaySentence(index)
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return
                    event.preventDefault()
                    void replaySentence(index)
                  }}
                >
                  {sentence.speaker && <span className="mr-2 text-xs text-muted-foreground">{sentence.speaker}</span>}
                  <span className="font-serif text-lg">{sentence.turkish}</span>
                  {showEnglish && <p className="text-sm text-muted-foreground">{sentence.english}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {showEnglish && !showTranscript && (
          <p className="text-sm text-muted-foreground">{exercise.english}</p>
        )}
        <PracticeBlock
          title="Comprehension"
          items={exercise.questions.map((item, index) => ({
            key: `q-${index}`,
            prompt: item.question,
            expected: item.answer,
            choices: item.choices,
          }))}
          answers={answers}
          results={results}
          setAnswers={setAnswers}
          onGrade={(item) => grade("comprehension", item.key, item.prompt, item.expected, item.choices)}
        />
        <PracticeBlock
          title="Dictation"
          help="Type the Turkish sentence you hear."
          items={exercise.dictation.map((item, index) => ({
            key: `d-${index}`,
            prompt: `Sentence ${index + 1}`,
            expected: item.turkish,
            play: item.turkish,
          }))}
          answers={answers}
          results={results}
          setAnswers={setAnswers}
          speed={speed}
          onGrade={(item) => grade("dictation", item.key, item.prompt, item.expected)}
        />
        <PracticeBlock
          title="Vocabulary"
          items={exercise.vocabPrompts.map((item, index) => ({
            key: `v-${index}`,
            prompt: item.question,
            expected: item.answer,
            choices: item.choices,
          }))}
          answers={answers}
          results={results}
          setAnswers={setAnswers}
          onGrade={(item) => grade("vocab", item.key, item.prompt, item.expected, item.choices)}
        />
        </PageBody>
      </div>
    )
  }

  return (
    <div>
      <PageHero
        title="Listening"
        subtitle="Hear a short Turkish story at your level. Transcripts stay hidden until you ask."
      />
      <PageBody className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>New story</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <span>{selectedWords.length} words selected · a short story works best with 4–8 words</span>
            <ClearSelectionButton selectedCount={selected.length} onClear={() => setSelected([])} />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <WordChipPicker words={words} selected={selected} onSelectedChange={setSelected} />
          <Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Story topic" />
          <CefrPicker value={cefr} onChange={setCefr} />
          <div className="flex flex-wrap gap-2">
            <Select value={format} onValueChange={(value) => setFormat(value as ListeningFormat)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monologue">Story</SelectItem>
                <SelectItem value="conversation">Conversation</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(durationSec)} onValueChange={(value) => setDurationSec(Number(value))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[30, 60, 90, 120].map((item) => (
                  <SelectItem key={item} value={String(item)}>{item}s</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={busy || !selected.length} onClick={generate}>
              {busy ? "Writing…" : "Generate story"}
            </Button>
          </div>
        </CardContent>
      </Card>
      {saved.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {saved.map((item) => (
            <button key={item.id} className="text-left" onClick={() => setExercise(item)}>
              <Card>
                <CardHeader>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.cefrLevel} · {item.topic}</CardDescription>
                </CardHeader>
              </Card>
            </button>
          ))}
        </div>
      )}
      </PageBody>
    </div>
  )
}

function PracticeBlock({
  title,
  help,
  items,
  answers,
  results,
  setAnswers,
  onGrade,
  speed = 1,
}: {
  title: string
  help?: string
  items: { key: string; prompt: string; expected: string; choices?: string[]; play?: string }[]
  answers: Record<string, string>
  results: Record<string, EvalResult>
  setAnswers: (value: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)) => void
  onGrade: (item: { key: string; prompt: string; expected: string; choices?: string[] }) => void
  speed?: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {help && <CardDescription>{help}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => {
          const result = results[item.key]
          const settled = result === "correct"
          return (
            <div
              key={item.key}
              className={`space-y-2 rounded-lg border p-3 ${settled ? "border-transparent bg-muted/70 text-muted-foreground opacity-70" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm">{item.prompt}</p>
                {item.play && (
                  <Button size="sm" variant="outline" onClick={() => playTurkishAudio(item.play!, speed)}>
                    Play
                  </Button>
                )}
              </div>
              {item.choices?.length ? (
                <div className="flex flex-wrap gap-2">
                  {item.choices.map((choice) => (
                    <Button
                      key={choice}
                      size="xs"
                      variant={answers[item.key] === choice ? "default" : "outline"}
                      onClick={() => setAnswers((current) => ({ ...current, [item.key]: choice }))}
                    >
                      {choice}
                    </Button>
                  ))}
                </div>
              ) : (
                <Input
                  value={answers[item.key] ?? ""}
                  onChange={(event) => setAnswers((current) => ({ ...current, [item.key]: event.target.value }))}
                />
              )}
              <div className="mt-1 flex items-center gap-2 pt-1">
                <Button onClick={() => onGrade(item)}>
                  Check
                </Button>
                {result && <span className="text-xs text-muted-foreground">{result}</span>}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
