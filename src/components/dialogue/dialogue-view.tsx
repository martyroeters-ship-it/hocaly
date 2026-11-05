"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { CefrPicker } from "@/components/cefr-picker"
import { PageBody, PageHero } from "@/components/layout/page-hero"
import { useProfileCefr } from "@/components/use-profile-cefr"
import { MicButton, type MicResult } from "@/components/speech/mic-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ClearSelectionButton, WordChipPicker } from "@/components/vocab/word-chip-picker"
import { api } from "@/lib/client"
import { DIALOGUE_PRESETS, guessDialogueSpeaker, type DialogueTurn } from "@/lib/dialogue"
import { pickDailyStudyWords, type DailyStudyPrefs } from "@/lib/daily-study"
import type { WordListItem } from "@/lib/types"
import { cn } from "@/lib/utils"

type ChatMessage = {
  role: "npc" | "user"
  speaker?: string
  turkish: string
  english?: string
}

type DialogueReply = DialogueTurn & {
  id: string
  label: string
  scenario: string
  draft?: boolean
}

export function DialogueView({
  initialIds,
  session,
}: {
  initialIds?: string[]
  session?: DailyStudyPrefs | null
}) {
  const [words, setWords] = useState<WordListItem[]>([])
  const [selected, setSelected] = useState<string[]>(initialIds ?? [])
  const [cefr, setCefr] = useProfileCefr(session?.cefr)
  const [customTopic, setCustomTopic] = useState("")
  const [busy, setBusy] = useState(false)
  const [serverStt, setServerStt] = useState(false)
  const [active, setActive] = useState<{ label: string; speaker: string; presetId?: string; topic?: string } | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [showEnglish, setShowEnglish] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  async function load() {
    const [vocab, settings] = await Promise.all([
      api<{ items: WordListItem[] }>("/api/words?take=400"),
      api<{ speech?: { stt: { configured: boolean } } }>("/api/settings"),
    ])
    setWords(vocab.items)
    setServerStt(Boolean(settings.speech?.stt.configured))
    if (!selected.length) {
      if (initialIds?.length) setSelected(initialIds)
      else if (session) setSelected(pickDailyStudyWords(vocab.items, session, 6))
    }
  }

  useEffect(() => {
    load().catch((error) => toast.error(error.message))
  }, [])

  useEffect(() => {
    const node = threadRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, busy])

  const selectedWords = useMemo(() => words.filter((word) => selected.includes(word.id)), [words, selected])

  async function requestTurn(body: Record<string, unknown>) {
    return api<DialogueReply>("/api/dialogue", {
      method: "POST",
      body: JSON.stringify({
        cefr,
        wordIds: selected.slice(0, 8),
        ...body,
      }),
    })
  }

  async function startDialogue(options: { presetId?: string; topic?: string }) {
    const topic = options.topic?.trim()
    const preset = DIALOGUE_PRESETS.find((item) => item.id === options.presetId)
    if (!preset && !topic) {
      toast.error("Pick a scenario or type your own")
      return
    }
    const label = topic || preset!.label
    const speaker = preset?.speaker || guessDialogueSpeaker(topic || "")
    setActive({ label, speaker, presetId: options.presetId, topic })
    setMessages([])
    setDraft("")
    setBusy(true)
    try {
      const reply = await requestTurn({ action: "start", presetId: options.presetId, topic })
      setActive({
        label: reply.label,
        speaker: reply.speaker,
        presetId: options.presetId,
        topic,
      })
      setMessages([{ role: "npc", speaker: reply.speaker, turkish: reply.turkish, english: reply.english }])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the dialogue")
      setActive(null)
    } finally {
      setBusy(false)
    }
  }

  async function sendReply(text = draft) {
    const turkish = text.trim()
    if (!active || !turkish || busy) return
    const history = messages.map((item) => ({ role: item.role, turkish: item.turkish }))
    setMessages((current) => [...current, { role: "user", turkish }])
    setDraft("")
    setBusy(true)
    try {
      const reply = await requestTurn({
        action: "turn",
        presetId: active.presetId,
        topic: active.topic,
        speaker: active.speaker,
        userText: turkish,
        messages: history,
      })
      setMessages((current) => [
        ...current,
        { role: "npc", speaker: reply.speaker, turkish: reply.turkish, english: reply.english },
      ])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not continue the dialogue")
    } finally {
      setBusy(false)
    }
  }

  function fillFromMic(result: MicResult) {
    const transcript = result.transcript.trim()
    if (!transcript) {
      toast.error("No speech was recognized. Type your reply instead.")
      return
    }
    setDraft((current) => (current.trim() ? `${current.trim()} ${transcript}` : transcript))
  }

  function resetToSetup() {
    setActive(null)
    setMessages([])
    setDraft("")
  }

  if (active) {
    return (
      <div>
        <PageHero
          title={active.label}
          subtitle={`You are talking to a ${active.speaker.toLocaleLowerCase()}. Type in Turkish or English.`}
          actions={
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowEnglish((value) => !value)}>
                {showEnglish ? "Hide English" : "Show English"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={resetToSetup}>
                New scenario
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={resetToSetup}>
                End
              </Button>
            </>
          }
        />
        <PageBody narrow className="space-y-6">
        <Card>
          <CardContent>
            <div ref={threadRef} className="flex max-h-[28rem] flex-col gap-3 overflow-auto pr-1">
              {messages.map((message, index) => {
                const fromUser = message.role === "user"
                return (
                  <div
                    key={`${message.role}-${index}-${message.turkish.slice(0, 24)}`}
                    className={cn("flex", fromUser ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3",
                        fromUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                      )}
                    >
                      {!fromUser && (
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">
                          {message.speaker || active.speaker}
                        </p>
                      )}
                      <p className="font-serif text-lg leading-snug">{message.turkish}</p>
                      {showEnglish && message.english ? (
                        <p className={cn("mt-1 text-sm", fromUser ? "text-primary-foreground/80" : "text-muted-foreground")}>
                          {message.english}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )
              })}
              {busy ? <p className="text-sm text-muted-foreground">{active.speaker} is typing…</p> : null}
            </div>
          </CardContent>
        </Card>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void sendReply()
          }}
        >
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void sendReply()
              }
            }}
            placeholder="Type your reply"
            aria-label="Your reply"
            disabled={busy}
            rows={3}
          />
          <div className="flex flex-wrap items-start gap-2">
            <Button type="submit" disabled={busy || !draft.trim()}>
              {busy ? "Sending…" : "Send"}
            </Button>
            <MicButton serverStt={serverStt} busy={busy} onResult={fillFromMic} />
          </div>
        </form>
        </PageBody>
      </div>
    )
  }

  return (
    <div>
      <PageHero title="Dialogue" subtitle="Pick a scene and talk to someone in Turkish." />
      <PageBody className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scenario</CardTitle>
          <CardDescription>Click a place to start, or type your own.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {DIALOGUE_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void startDialogue({ presetId: preset.id })}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Input
            value={customTopic}
            onChange={(event) => setCustomTopic(event.target.value)}
            placeholder="Or type your own scenario"
            aria-label="Custom scenario"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void startDialogue({ topic: customTopic })
              }
            }}
          />
          <CefrPicker value={cefr} onChange={setCefr} />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">Vocabulary (optional)</p>
              <ClearSelectionButton selectedCount={selected.length} onClear={() => setSelected([])} />
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedWords.length
                ? `${selectedWords.length} words may be woven in if they fit.`
                : "Start without chips — selected words are a hint, not a requirement."}
            </p>
            <WordChipPicker words={words} selected={selected} onSelectedChange={setSelected} />
          </div>
          <Button disabled={busy || !customTopic.trim()} onClick={() => void startDialogue({ topic: customTopic })}>
            {busy ? "Starting…" : "Start"}
          </Button>
        </CardContent>
      </Card>
      </PageBody>
    </div>
  )
}
