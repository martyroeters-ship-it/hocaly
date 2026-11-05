"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { blobToBase64, startBrowserRecognition, startMicRecorder } from "@/lib/speech/client-audio"

export type MicResult = {
  transcript: string
  audio?: string
  mimeType?: string
  durationSec: number
}

export function MicButton({
  serverStt,
  busy,
  onResult,
}: {
  serverStt: boolean
  busy?: boolean
  onResult: (result: MicResult) => Promise<void> | void
}) {
  const [recording, setRecording] = useState(false)
  const [status, setStatus] = useState("Hold to talk")
  const session = useRef<{
    stopRecorder: () => Promise<{ blob: Blob; mimeType: string; durationSec: number }>
    stopLive?: () => Promise<string>
  } | null>(null)

  async function start() {
    if (busy || recording) return
    try {
      const recorder = await startMicRecorder()
      const live = !serverStt ? startBrowserRecognition() : null
      session.current = { stopRecorder: recorder.stop, stopLive: live?.stop }
      setRecording(true)
      setStatus(serverStt ? "Recording…" : "Listening…")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Microphone unavailable")
    }
  }

  async function stop() {
    const active = session.current
    session.current = null
    if (!active) return
    setStatus(serverStt ? "Transcribing…" : "Processing…")
    try {
      const captured = await active.stopRecorder()
      const liveTranscript = active.stopLive ? await active.stopLive() : ""
      await onResult({
        transcript: liveTranscript,
        audio: await blobToBase64(captured.blob),
        mimeType: captured.mimeType,
        durationSec: captured.durationSec,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not process speech")
    } finally {
      setRecording(false)
      setStatus("Hold to talk")
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={busy}
        variant={recording ? "destructive" : "default"}
        onPointerDown={(event) => {
          event.preventDefault()
          void start()
        }}
        onPointerUp={() => void stop()}
        onPointerLeave={() => recording && void stop()}
      >
        {recording ? "Release to send" : "Hold to talk"}
      </Button>
      <p className="text-xs text-muted-foreground">{status}. Push-to-talk so the AI waits for you to finish.</p>
    </div>
  )
}
