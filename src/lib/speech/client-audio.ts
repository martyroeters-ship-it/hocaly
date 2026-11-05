import { speakTurkish, stopSpeaking } from "@/lib/tts"

let currentAudio: HTMLAudioElement | null = null
let currentSpeed = 1

export function stopTurkishAudio() {
  stopSpeaking()
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ""
    currentAudio = null
  }
}

export function setTurkishAudioSpeed(speed: number) {
  currentSpeed = speed
  if (currentAudio) currentAudio.playbackRate = speed
}

export async function playTurkishAudio(text: string, speed = 1) {
  stopTurkishAudio()
  currentSpeed = speed
  const response = await fetch("/api/speech/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })
  const type = response.headers.get("content-type") ?? ""
  if (type.includes("audio")) {
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.preservesPitch = true
    audio.playbackRate = currentSpeed
    audio.addEventListener("loadedmetadata", () => {
      audio.playbackRate = currentSpeed
    })
    currentAudio = audio
    await audio.play()
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(url)
        if (currentAudio === audio) currentAudio = null
        resolve()
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error("Could not play audio"))
      }
    })
    return { provider: response.headers.get("X-Speech-Provider") ?? "server" }
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string; provider?: string }
  if (!response.ok) throw new Error(data.error || "Could not generate audio")
  speakTurkish(text, null, 0.92 * currentSpeed)
  return { provider: "browser" }
}

export async function transcribeBlob(blob: Blob, durationSec?: number) {
  const form = new FormData()
  form.append("audio", blob, "speech.webm")
  if (durationSec) form.append("durationSec", String(durationSec))
  const response = await fetch("/api/speech/stt", { method: "POST", body: form })
  const data = (await response.json().catch(() => ({}))) as { error?: string; transcript?: string; provider?: string }
  if (!response.ok) throw new Error(data.error || "Could not transcribe")
  return { transcript: data.transcript ?? "", provider: data.provider ?? "server" }
}

type BrowserRec = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

function speechRecognitionCtor(): (new () => BrowserRec) | null {
  const host = window as unknown as { SpeechRecognition?: new () => BrowserRec; webkitSpeechRecognition?: new () => BrowserRec }
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null
}

export function browserSpeechAvailable() {
  return Boolean(speechRecognitionCtor())
}

export function startBrowserRecognition() {
  const Ctor = speechRecognitionCtor()
  if (!Ctor) throw new Error("This browser cannot transcribe speech. Add OPENAI_API_KEY or GEMINI_API_KEY for server transcription.")
  const rec = new Ctor()
  rec.lang = "tr-TR"
  rec.interimResults = true
  rec.continuous = true
  let transcript = ""
  rec.onresult = (event) => {
    transcript = Array.from(event.results)
      .map((result) => result[0]?.transcript ?? "")
      .join(" ")
      .trim()
  }
  rec.start()
  return {
    stop: () =>
      new Promise<string>((resolve) => {
        rec.onend = () => resolve(transcript)
        rec.onerror = () => resolve(transcript)
        try {
          rec.stop()
        } catch {
          resolve(transcript)
        }
      }),
  }
}

export async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export async function startMicRecorder() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser cannot access the microphone.")
  }
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      throw new Error("Allow microphone access to practice speaking.")
    }
    throw new Error("Could not open the microphone.")
  }
  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : ""
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data)
  }
  recorder.start(200)
  const started = Date.now()
  return {
    mimeType: recorder.mimeType || "audio/webm",
    stop: () =>
      new Promise<{ blob: Blob; mimeType: string; durationSec: number }>((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop())
          resolve({
            blob: new Blob(chunks, { type: recorder.mimeType || "audio/webm" }),
            mimeType: recorder.mimeType || "audio/webm",
            durationSec: Math.max(1, Math.round((Date.now() - started) / 1000)),
          })
        }
        if (recorder.state !== "inactive") recorder.stop()
      }),
  }
}
