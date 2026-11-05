"use client"

import { Fragment, useMemo, useState } from "react"
import { toast } from "sonner"
import { PageBody, PageHero } from "@/components/layout/page-hero"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { lookupToken, tokenize, tokensWithSpacing } from "@/lib/reading"
import { speakTurkish } from "@/lib/tts"
import { api } from "@/lib/client"
import { hasTextSelection } from "@/lib/translate/selection"
import type { WordListItem } from "@/lib/types"

type Story = {
  id: string
  title: string
  turkish: string
  english: string | null
  sentences: { turkish: string; english: string }[]
  questions: { question: string; answer: string }[]
  usedWords: string[]
  omittedWords: string[]
  grammarNotes: { structure: string; explanation: string }[]
  cefrLevel: string
}

export function Reader({
  story,
  vocab,
  onBack,
  onRetest,
}: {
  story: Story
  vocab: WordListItem[]
  onBack: () => void
  onRetest: () => void
}) {
  const [fontSize, setFontSize] = useState(22)
  const [showFull, setShowFull] = useState(false)
  const [sentence, setSentence] = useState<number | null>(null)
  const [clicked, setClicked] = useState<{ token: string; english: string; status: string } | null>(null)
  const index = useMemo(
    () =>
      vocab.map((word) => ({
        id: word.id,
        turkish: word.turkish,
        english: word.english,
        status: word.learningStatus,
      })),
    [vocab],
  )

  return (
    <div>
      <PageHero
        eyebrow={story.cefrLevel}
        title={story.title}
        actions={
          <>
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
            <Button variant="outline" onClick={() => speakTurkish(story.turkish)}>
              Listen
            </Button>
            <Button variant="outline" onClick={() => setShowFull((value) => !value)}>
              {showFull ? "Hide translation" : "Full translation"}
            </Button>
            <Button variant="outline" onClick={onRetest}>
              Test these words
            </Button>
          </>
        }
      />
      <PageBody className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        Font
        <Slider className="max-w-40" value={[fontSize]} min={16} max={32} onValueChange={(value) => setFontSize(Array.isArray(value) ? (value[0] ?? 22) : value)} />
      </div>
      <article className="rounded-2xl bg-card p-6 leading-relaxed ring-1 ring-foreground/10" style={{ fontSize }}>
        <p className="font-serif select-text">
          {tokensWithSpacing(tokenize(story.turkish)).map((token, i) => {
            const isWord = /[\p{L}]/u.test(token)
            if (!isWord) {
              return <Fragment key={`gap-${i}`}>{token}</Fragment>
            }
            const match = lookupToken(token, index)
            const color =
              match?.status === "mastered"
                ? "bg-emerald-100"
                : match?.status === "learning" || match?.status === "reviewing"
                  ? "bg-amber-100"
                  : match
                    ? "bg-rose-100"
                    : ""
            return (
              <span
                key={`${token}-${i}`}
                className={`rounded-sm select-text ${color} cursor-pointer`}
                onClick={() => {
                  if (hasTextSelection()) return
                  if (!match) return
                  setClicked({ token, english: match.english, status: match.status })
                }}
                onDoubleClick={() => {
                  if (match) return
                  void api("/api/words", { method: "POST", body: JSON.stringify({ turkish: token }) }).then(() => {
                    toast.success(`Saved ${token}`)
                  })
                }}
              >
                {token}
              </span>
            )
          })}
        </p>
      </article>
      {clicked && (
        <p className="text-sm">
          <span className="font-medium">{clicked.token}</span>: {clicked.english || "no translation yet"} · {clicked.status}
        </p>
      )}
      {showFull && <p className="text-muted-foreground">{story.english}</p>}
      <div className="space-y-2">
        <h2 className="font-medium">Sentences</h2>
        {story.sentences.map((item, i) => (
          <div
            key={item.turkish}
            role="button"
            tabIndex={0}
            className="block w-full cursor-pointer rounded-lg bg-muted/40 p-3 text-left select-text"
            onClick={() => {
              if (hasTextSelection()) return
              setSentence(sentence === i ? null : i)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return
              event.preventDefault()
              setSentence(sentence === i ? null : i)
            }}
          >
            <p>{item.turkish}</p>
            {sentence === i && <p className="mt-1 text-sm text-muted-foreground">{item.english}</p>}
          </div>
        ))}
      </div>
      {story.questions.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-medium">Comprehension</h2>
          {story.questions.map((item) => (
            <details key={item.question} className="rounded-lg bg-muted/40 p-3">
              <summary>{item.question}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Used: {story.usedWords.join(", ") || "—"}
        {story.omittedWords.length ? ` · Omitted for naturalness: ${story.omittedWords.join(", ")}` : ""}
      </p>
      {story.grammarNotes?.map((note) => (
        <p key={note.structure} className="text-sm">
          <span className="font-medium">{note.structure}:</span> {note.explanation}
        </p>
      ))}
      </PageBody>
    </div>
  )
}
