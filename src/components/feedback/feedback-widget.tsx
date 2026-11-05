"use client"

import { useEffect, useId, useState, type FormEvent } from "react"
import { MessageCircle, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/client"
import {
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_TYPES,
  type FeedbackType,
} from "@/lib/feedback"
import { cn } from "@/lib/utils"

export function FeedbackWidget() {
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>("question")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = message.trim()
    if (!trimmed) {
      toast.error("Write a message before sending.")
      return
    }
    setSending(true)
    try {
      await api("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ type, message: trimmed }),
      })
      toast.success("Sent. Thanks for the note.")
      setMessage("")
      setType("question")
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send that message.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 md:right-6 md:bottom-6">
      {open && (
        <form
          onSubmit={onSubmit}
          role="dialog"
          aria-labelledby={titleId}
          aria-modal="false"
          className="pointer-events-auto w-[min(22rem,calc(100vw-2rem))] rounded-xl bg-card p-4 text-card-foreground shadow-[0_8px_30px_rgb(0,0,0,0.10)] ring-1 ring-black/8"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="text-base font-semibold">
                Feedback
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Question, complaint, or suggestion.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close feedback"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {FEEDBACK_TYPES.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="xs"
                    variant={type === value ? "default" : "outline"}
                    className="w-full px-1"
                    onClick={() => setType(value)}
                    aria-pressed={type === value}
                  >
                    {FEEDBACK_TYPE_LABELS[value]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="kelime-feedback-message">Message</Label>
              <Textarea
                id="kelime-feedback-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={FEEDBACK_MAX_LENGTH}
                rows={5}
                placeholder="Write it here…"
                className="min-h-28 resize-none"
                disabled={sending}
              />
            </div>

            <Button type="submit" className="w-full" disabled={sending}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? "Close feedback" : "Open feedback"}
        className={cn(
          "pointer-events-auto flex size-14 items-center justify-center rounded-full bg-primary text-foreground shadow-[0_8px_24px_rgb(0,0,0,0.16)] ring-1 ring-black/10 transition-transform hover:bg-[color-mix(in_oklch,var(--primary),black_10%)] active:translate-y-px",
          open && "ring-2 ring-foreground/20",
        )}
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </div>
  )
}
