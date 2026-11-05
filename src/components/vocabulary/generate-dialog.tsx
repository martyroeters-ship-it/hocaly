"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { speakTurkish } from "@/lib/tts"

export type SentencePreview = {
  turkish: string
  english: string
  usedWords: { turkish: string; form: string }[]
  omittedWords: string[]
  draft?: boolean
}

export type StoryPreview = {
  title: string
  turkish: string
  english: string
  sentences: { turkish: string; english: string }[]
  usedWords: string[]
  omittedWords: string[]
  questions: { question: string; answer: string }[]
  draft?: boolean
}

export function GeneratePreviewDialog({
  open,
  kind,
  busy,
  sentence,
  story,
  onOpenChange,
  onSave,
}: {
  open: boolean
  kind: "sentence" | "story"
  busy: boolean
  sentence: SentencePreview | null
  story: StoryPreview | null
  onOpenChange: (open: boolean) => void
  onSave: () => Promise<void>
}) {
  const ready = kind === "sentence" ? Boolean(sentence) : Boolean(story)
  const writing = busy && !ready

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{kind === "sentence" ? "Generated sentence" : "Generated story"}</DialogTitle>
          <DialogDescription>
            {writing
              ? "Writing with your selected words…"
              : "Save it to your library, or close to discard it."}
          </DialogDescription>
        </DialogHeader>

        {writing && <p className="text-sm text-muted-foreground">This can take a few seconds.</p>}

        {!writing && kind === "sentence" && sentence && (
          <div className="space-y-3">
            {sentence.draft && (
              <p className="text-sm text-muted-foreground">Local scene from your words — Gemini did not return a sentence this time.</p>
            )}
            <p className="font-serif text-2xl leading-snug">{sentence.turkish}</p>
            <p className="text-muted-foreground">{sentence.english}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => speakTurkish(sentence.turkish)}>
                Listen
              </Button>
              {sentence.usedWords.map((word) => (
                <Badge key={`${word.turkish}-${word.form}`} variant="secondary">
                  {word.form}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {!writing && kind === "story" && story && (
          <div className="space-y-3">
            {story.draft && (
              <p className="text-sm text-muted-foreground">Local scene from your words — Gemini did not return a story this time.</p>
            )}
            <p className="font-medium">{story.title}</p>
            <p className="font-serif text-lg leading-relaxed">{story.turkish}</p>
            <p className="text-muted-foreground">{story.english}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button disabled={busy || !ready} onClick={() => void onSave()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
