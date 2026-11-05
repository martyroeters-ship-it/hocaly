"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { PageBody, PageHero } from "@/components/layout/page-hero"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { CefrPicker } from "@/components/cefr-picker"
import { useProfileCefr } from "@/components/use-profile-cefr"
import { ClearSelectionButton, WordChipPicker } from "@/components/vocab/word-chip-picker"
import { api } from "@/lib/client"
import { pickDailyStudyWords, storyLengthForMinutes, type DailyStudyPrefs } from "@/lib/daily-study"
import { type WordListItem } from "@/lib/types"
import { Reader } from "@/components/stories/reader"

type Story = {
  id: string
  title: string
  topic: string | null
  cefrLevel: string
  turkish: string
  english: string | null
  sentences: { turkish: string; english: string }[]
  questions: { question: string; answer: string }[]
  usedWords: string[]
  omittedWords: string[]
  grammarNotes: { structure: string; explanation: string }[]
}

export function StoriesView({ session }: { session?: DailyStudyPrefs | null }) {
  const [words, setWords] = useState<WordListItem[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [topic, setTopic] = useState("")
  const [cefr, setCefr] = useProfileCefr(session?.cefr)
  const [length, setLength] = useState(session ? storyLengthForMinutes(session.minutes) : 160)
  const [stories, setStories] = useState<Story[]>([])
  const [active, setActive] = useState<Story | null>(null)
  const [lastTitle, setLastTitle] = useState("")
  const [busy, setBusy] = useState(false)

  async function load() {
    const [vocab, saved] = await Promise.all([
      api<{ items: WordListItem[] }>("/api/words?take=400"),
      api<{ stories: Story[] }>("/api/stories"),
    ])
    setWords(vocab.items)
    setStories(saved.stories)
    if (!selected.length) {
      setSelected(session ? pickDailyStudyWords(vocab.items, session, 8) : vocab.items.slice(0, 8).map((item) => item.id))
    }
  }

  useEffect(() => {
    load().catch((error) => toast.error(error.message))
  }, [])

  const selectedWords = useMemo(
    () => words.filter((word) => selected.includes(word.id)),
    [words, selected],
  )

  async function generate() {
    setBusy(true)
    try {
      const generated = await api<Story>("/api/ai", {
        method: "POST",
        body: JSON.stringify({
          action: "story",
          wordIds: selected,
          topic,
          cefr,
          length,
          seed: Date.now() % 1_000_000,
          avoidTitle: lastTitle || undefined,
        }),
      })
      let opened: Story = { ...generated, id: generated.id || `draft-${Date.now()}` }
      try {
        opened = await api<Story>("/api/ai", {
          method: "POST",
          body: JSON.stringify({
            action: "save-story",
            wordIds: selected,
            topic: generated.topic || topic || generated.title,
            cefr,
            length,
            title: generated.title,
            turkish: generated.turkish,
            english: generated.english,
            sentences: generated.sentences,
            questions: generated.questions,
            grammarNotes: generated.grammarNotes ?? [],
          }),
        })
      } catch {
        // Still open the freshly generated text if saving the row fails.
      }
      setLastTitle(opened.title || generated.title)
      await load()
      setActive(opened)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate story")
    } finally {
      setBusy(false)
    }
  }

  if (active) {
    return (
      <Reader
        story={active}
        vocab={words}
        onBack={() => setActive(null)}
        onRetest={() => {
          window.location.href = `/tests?ids=${selected.join(",")}`
        }}
      />
    )
  }

  return (
    <div>
      <PageHero
        title="Stories"
        subtitle="Generate a short Turkish story at your level. The topic is the scene; selected words are used only when they fit."
      />
      <PageBody className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <span>{selectedWords.length} words selected</span>
            <ClearSelectionButton selectedCount={selected.length} onClear={() => setSelected([])} />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <WordChipPicker words={words} selected={selected} onSelectedChange={setSelected} />
          <Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Story topic" />
          <CefrPicker value={cefr} onChange={setCefr} />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <div className="mb-1 text-xs text-muted-foreground">About {length} words</div>
              <Slider value={[length]} min={80} max={280} onValueChange={(value) => setLength(Array.isArray(value) ? (value[0] ?? 160) : value)} />
            </div>
            <Button disabled={busy || !selected.length} onClick={generate}>
              {busy ? "Writing…" : "Generate story"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {stories.map((story) => (
          <button key={story.id} className="text-left" onClick={() => setActive(story)}>
            <Card>
              <CardHeader>
                <CardTitle>{story.title}</CardTitle>
                <CardDescription>
                  {story.cefrLevel} · {story.topic}
                </CardDescription>
              </CardHeader>
            </Card>
          </button>
        ))}
      </div>
      </PageBody>
    </div>
  )
}
