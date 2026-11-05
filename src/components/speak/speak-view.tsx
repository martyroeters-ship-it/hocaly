"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { PageBody, PageHero } from "@/components/layout/page-hero"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MicButton, type MicResult } from "@/components/speech/mic-button"
import { useProfileCefr } from "@/components/use-profile-cefr"
import { api } from "@/lib/client"
import { playTurkishAudio, stopTurkishAudio } from "@/lib/speech/client-audio"
import { pickDailyStudyWords, speakingDurationSec, type DailyStudyPrefs } from "@/lib/daily-study"
import { CEFR_LEVELS, type CefrLevel, type SpeakingMode, type SpokenFeedback, type WordListItem } from "@/lib/types"

type SpeakItem = { wordId: string; turkish: string; english: string; accepted?: string[] }
type Session = {
  id: string
  mode: SpeakingMode
  topic: string | null
  cefrLevel: string
  speed: number
  durationSec: number | null
  items: SpeakItem[]
  messages: { role: string; turkish: string; english?: string; transcript?: string }[]
  report: ConversationReport | null
}
type ConversationReport = {
  targetUsed: string[]
  targetMissed: string[]
  vocabMistakes: { given: string; expected: string; note: string }[]
  grammarMistakes: { quote: string; note: string }[]
  improvements: string[]
  newExpressions: { turkish: string; english: string }[]
  reviewWords: string[]
}

const MODES: { id: SpeakingMode; label: string; help: string }[] = [
  { id: "listen-repeat", label: "Listen and repeat", help: "Hear a Turkish sentence, then say it. Feedback is about missing words, not pronunciation." },
  { id: "translate-speak", label: "Translate and speak", help: "See English, say a natural Turkish equivalent. Alternatives are accepted." },
  { id: "conversation", label: "Conversation", help: "Push-to-talk chat in Turkish. The partner waits until you release." },
]

export function SpeakView({
  initialIds,
  dailySession,
}: {
  initialIds?: string[]
  dailySession?: DailyStudyPrefs | null
}) {
  const [words, setWords] = useState<WordListItem[]>([])
  const [selected, setSelected] = useState<string[]>(initialIds ?? [])
  const [mode, setMode] = useState<SpeakingMode>("listen-repeat")
  const [topic, setTopic] = useState("Ordering food")
  const [cefr, setCefr] = useProfileCefr(dailySession?.cefr)
  const [speed, setSpeed] = useState(1)
  const [durationSec, setDurationSec] = useState(dailySession ? speakingDurationSec(dailySession.minutes) : 120)
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<SpokenFeedback | null>(null)
  const [serverStt, setServerStt] = useState(false)
  const [startedAt, setStartedAt] = useState(Date.now())
  const [status, setStatus] = useState("")

  async function load() {
    const [vocab, settings] = await Promise.all([
      api<{ items: WordListItem[] }>("/api/words?take=400"),
      api<{ speech?: { stt: { configured: boolean } } }>("/api/settings"),
    ])
    setWords(vocab.items)
    setServerStt(Boolean(settings.speech?.stt.configured))
    if (!selected.length) {
      if (initialIds?.length) setSelected(initialIds)
      else if (dailySession) setSelected(pickDailyStudyWords(vocab.items, dailySession, 6))
      else setSelected(vocab.items.slice(0, 6).map((item) => item.id))
    }
  }

  useEffect(() => {
    load().catch((error) => toast.error(error.message))
    return () => stopTurkishAudio()
  }, [])

  const selectedWords = useMemo(() => words.filter((word) => selected.includes(word.id)), [words, selected])
  const item = session?.items[index]

  async function start() {
    setBusy(true)
    try {
      const created = await api<Session>("/api/speaking", {
        method: "POST",
        body: JSON.stringify({ action: "start", mode, wordIds: selected, topic, cefr, speed, durationSec }),
      })
      setSession(created)
      setIndex(0)
      setFeedback(null)
      setStartedAt(Date.now())
      if (created.mode === "listen-repeat" && created.items[0]) {
        await playTurkishAudio(created.items[0].turkish, speed)
      }
      if (created.mode === "conversation" && created.messages[0]) {
        setStatus("Speaking…")
        await playTurkishAudio(created.messages[0].turkish, speed)
        setStatus("Your turn")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start speaking practice")
    } finally {
      setBusy(false)
    }
  }

  async function submitMic(result: MicResult) {
    if (!session) return
    setBusy(true)
    try {
      if (session.mode === "conversation") {
        setStatus("Thinking…")
        const data = await api<{ reply: { turkish: string; english: string; endConversation?: boolean }; remainingSec: number }>("/api/speaking", {
          method: "POST",
          body: JSON.stringify({
            action: "converse",
            sessionId: session.id,
            transcript: result.transcript,
            audio: result.audio,
            mimeType: result.mimeType,
            durationSec: result.durationSec,
            elapsedSec: Math.round((Date.now() - startedAt) / 1000),
          }),
        })
        setSession((current) =>
          current
            ? {
                ...current,
                messages: [
                  ...current.messages,
                  { role: "user", turkish: result.transcript, transcript: result.transcript },
                  { role: "assistant", turkish: data.reply.turkish, english: data.reply.english },
                ],
              }
            : current,
        )
        setStatus("Speaking…")
        await playTurkishAudio(data.reply.turkish, speed)
        if (data.reply.endConversation || data.remainingSec <= 0) {
          await endConversation()
        } else {
          setStatus("Your turn")
        }
      } else {
        const data = await api<{ feedback: SpokenFeedback; item: SpeakItem }>("/api/speaking", {
          method: "POST",
          body: JSON.stringify({
            action: "evaluate",
            sessionId: session.id,
            itemIndex: index,
            transcript: result.transcript,
            audio: result.audio,
            mimeType: result.mimeType,
            durationSec: result.durationSec,
          }),
        })
        setFeedback(data.feedback)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not evaluate speech")
    } finally {
      setBusy(false)
    }
  }

  async function advanceAfterFeedback() {
    if (!session) return
    const next = index + 1
    if (next >= session.items.length) {
      setSession(null)
      toast.success("Speaking round finished")
      return
    }
    setIndex(next)
    setFeedback(null)
    const nextItem = session.items[next]
    if (session.mode === "listen-repeat" && nextItem) await playTurkishAudio(nextItem.turkish, speed)
  }

  useEffect(() => {
    if (!feedback || !session || session.mode === "conversation") return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.repeat || event.isComposing) return
      event.preventDefault()
      void advanceAfterFeedback()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback, index, session?.id, session?.mode, speed])

  async function endConversation() {
    if (!session) return
    setBusy(true)
    try {
      const finished = await api<Session>("/api/speaking", {
        method: "POST",
        body: JSON.stringify({ action: "finish", sessionId: session.id }),
      })
      setSession(finished)
      setStatus("Report")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not finish conversation")
    } finally {
      setBusy(false)
    }
  }

  if (session?.report) {
    const report = session.report
    return (
      <div>
        <PageHero
          title="Conversation report"
          actions={
            <Button variant="ghost" onClick={() => setSession(null)}>
              Back
            </Button>
          }
        />
        <PageBody narrow className="space-y-4">
          <ReportList title="Target vocabulary used" items={report.targetUsed} />
          <ReportList title="Missed target words" items={report.targetMissed} />
          <ReportList title="Suggested improvements" items={report.improvements} />
          <ReportList title="Review these words" items={report.reviewWords} />
          {report.vocabMistakes.map((item) => (
            <p key={`${item.given}-${item.expected}`} className="text-sm">
              Vocabulary: {item.given} → {item.expected}. {item.note}
            </p>
          ))}
          {report.grammarMistakes.map((item) => (
            <p key={item.quote} className="text-sm">
              Grammar: “{item.quote}”. {item.note}
            </p>
          ))}
          {report.newExpressions.map((item) => (
            <p key={item.turkish} className="text-sm">
              {item.turkish} — {item.english}
            </p>
          ))}
        </PageBody>
      </div>
    )
  }

  if (session) {
    return (
      <div>
        <PageHero
          title={session.mode === "conversation" ? session.topic || "Conversation" : "Speaking"}
          subtitle={MODES.find((entry) => entry.id === session.mode)?.help}
          actions={
            <Button
              variant="ghost"
              onClick={() => {
                stopTurkishAudio()
                setSession(null)
              }}
            >
              Back
            </Button>
          }
        />
        <PageBody narrow className="space-y-4">
        {session.mode !== "conversation" && item && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-3xl">
                {session.mode === "listen-repeat" ? item.turkish : item.english}
              </CardTitle>
              <CardDescription>
                {index + 1} / {session.items.length}. {MODES.find((entry) => entry.id === session.mode)?.help}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {session.mode === "listen-repeat" && (
                <Button variant="outline" onClick={() => playTurkishAudio(item.turkish, speed)}>Play again</Button>
              )}
              <MicButton serverStt={serverStt} busy={busy} onResult={submitMic} />
              {feedback && <FeedbackCard feedback={feedback} />}
              {feedback && (
                <Button autoFocus onClick={() => void advanceAfterFeedback()}>
                  Next
                </Button>
              )}
            </CardContent>
          </Card>
        )}
        {session.mode === "conversation" && (
          <Card>
            <CardHeader>
              <CardTitle>{session.topic}</CardTitle>
              <CardDescription>{status || "Your turn when you are ready."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-64 space-y-2 overflow-auto text-sm">
                {session.messages.map((message, messageIndex) => (
                  <div key={`${message.role}-${messageIndex}`} className={message.role === "assistant" ? "" : "text-muted-foreground"}>
                    <span className="text-xs uppercase">{message.role === "assistant" ? "Partner" : "You"}</span>
                    <p className="font-serif text-lg">{message.turkish}</p>
                    {message.english && <p className="text-muted-foreground">{message.english}</p>}
                  </div>
                ))}
              </div>
              <MicButton serverStt={serverStt} busy={busy} onResult={submitMic} />
              <Button variant="outline" disabled={busy} onClick={endConversation}>End and report</Button>
            </CardContent>
          </Card>
        )}
        </PageBody>
      </div>
    )
  }

  return (
    <div>
      <PageHero
        title="Speaking"
        subtitle="Repeat, translate out loud, or hold a short Turkish conversation. Recognition checks words, not accent."
      />
      <PageBody className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {MODES.map((entry) => (
          <Button key={entry.id} variant={mode === entry.id ? "default" : "outline"} onClick={() => setMode(entry.id)}>
            {entry.label}
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{MODES.find((entry) => entry.id === mode)?.help}</p>
      <Card>
        <CardHeader>
          <CardTitle>Setup</CardTitle>
          <CardDescription>{selectedWords.length} words selected</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex max-h-40 flex-wrap gap-2 overflow-auto">
            {words.slice(0, 80).map((word) => (
              <label key={word.id} className="flex items-center gap-2 rounded-full bg-muted px-2 py-1 text-sm">
                <Checkbox
                  checked={selected.includes(word.id)}
                  onCheckedChange={(checked) =>
                    setSelected((current) => (checked ? [...current, word.id] : current.filter((id) => id !== word.id)))
                  }
                />
                {word.turkish}
              </label>
            ))}
          </div>
          {mode === "conversation" && (
            <Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Conversation topic" />
          )}
          <div className="flex flex-wrap gap-2">
            <Select value={cefr} onValueChange={(value) => setCefr(value as CefrLevel)}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CEFR_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(speed)} onValueChange={(value) => setSpeed(Number(value))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0.75, 1, 1.15, 1.3].map((item) => (
                  <SelectItem key={item} value={String(item)}>{item}×</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mode === "conversation" && (
              <Select value={String(durationSec)} onValueChange={(value) => setDurationSec(Number(value))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[60, 120, 180, 300].map((item) => (
                    <SelectItem key={item} value={String(item)}>{item / 60} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button disabled={busy || !selected.length} onClick={start}>
              {busy ? "Starting…" : "Start"}
            </Button>
          </div>
        </CardContent>
      </Card>
      </PageBody>
    </div>
  )
}

function FeedbackCard({ feedback }: { feedback: SpokenFeedback }) {
  return (
    <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
      <p className="font-medium">{feedback.result}</p>
      {feedback.explanation && <p>{feedback.explanation}</p>}
      {feedback.missing.length > 0 && <p>Missing words: {feedback.missing.join(", ")}</p>}
      {feedback.vocabulary?.map((item) => (
        <p key={item.issue}>{item.issue}: {item.detail}</p>
      ))}
      {feedback.grammar?.map((item) => (
        <p key={item.issue}>{item.issue}: {item.detail}</p>
      ))}
      {feedback.naturalness && <p>{feedback.naturalness}</p>}
      <p className="text-xs text-muted-foreground">{feedback.disclaimer}</p>
    </div>
  )
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm">{items.join(" · ")}</p>
      </CardContent>
    </Card>
  )
}
