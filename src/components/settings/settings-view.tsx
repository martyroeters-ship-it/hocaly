"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { PageBody, PageHero } from "@/components/layout/page-hero"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { api } from "@/lib/client"
import { turkishVoices } from "@/lib/tts"

type Settings = {
  newWordsPerDay: number
  aiProvider: string
  ttsVoice: string | null
  ttsProvider: string
  sttProvider: string
  keepRecordings: boolean
  fontSize: number
}

export function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [ai, setAi] = useState<{ configured: boolean; provider: string | null; model: string | null } | null>(null)
  const [speech, setSpeech] = useState<{ tts: { configured: boolean; resolved: string }; stt: { configured: boolean; resolved: string } } | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  async function load() {
    const data = await api<{ settings: Settings; ai: NonNullable<typeof ai>; speech: NonNullable<typeof speech> }>("/api/settings")
    setSettings({
      newWordsPerDay: data.settings.newWordsPerDay,
      aiProvider: data.settings.aiProvider,
      ttsVoice: data.settings.ttsVoice,
      ttsProvider: data.settings.ttsProvider ?? "auto",
      sttProvider: data.settings.sttProvider ?? "auto",
      keepRecordings: data.settings.keepRecordings ?? false,
      fontSize: data.settings.fontSize,
    })
    setAi(data.ai)
    setSpeech(data.speech)
  }

  useEffect(() => {
    load().catch((error) => toast.error(error.message))
    const refresh = () => setVoices(turkishVoices())
    refresh()
    window.speechSynthesis?.addEventListener("voiceschanged", refresh)
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", refresh)
  }, [])

  async function save(next: Settings) {
    setSettings(next)
    await api("/api/settings", { method: "POST", body: JSON.stringify(next) })
    toast.success("Settings saved")
  }

  if (!settings) {
    return (
      <div>
        <PageHero
          title="Settings"
          subtitle="Local-only for now. API keys stay in `.env`, never in the browser."
        />
        <PageBody narrow>
          <p className="text-muted-foreground">Loading settings…</p>
        </PageBody>
      </div>
    )
  }

  return (
    <div>
      <PageHero
        title="Settings"
        subtitle="Local-only for now. API keys stay in `.env`, never in the browser."
      />
      <PageBody narrow className="space-y-6">
      <div className="rounded-xl border bg-card p-4 text-sm space-y-1">
        <p>AI: {ai?.configured ? `${ai.provider} · ${ai.model}` : "Not configured. Add GEMINI_API_KEY or OPENAI_API_KEY."}</p>
        <p>
          Speech: TTS {speech?.tts.resolved ?? "browser"}
          {speech?.tts.configured ? "" : " (browser fallback)"} · STT {speech?.stt.resolved ?? "browser"}
          {speech?.stt.configured ? "" : " (device recognition)"}
        </p>
      </div>
      <label className="block space-y-2">
        <span className="text-sm">New words per day</span>
        <Input
          type="number"
          min={0}
          max={50}
          value={settings.newWordsPerDay}
          onChange={(event) => save({ ...settings, newWordsPerDay: Number(event.target.value) })}
        />
      </label>
      <p className="text-sm text-muted-foreground">
        Turkish CEFR lives on{" "}
        <Link href="/profile" className="font-medium text-foreground underline underline-offset-2">
          Profile
        </Link>
        . Changing it there sets the default for generated content.
      </p>
      <label className="block space-y-2">
        <span className="text-sm">Preferred AI provider</span>
        <Select value={settings.aiProvider} onValueChange={(value) => save({ ...settings, aiProvider: String(value) })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gemini">Gemini</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label className="block space-y-2">
        <span className="text-sm">Text-to-speech provider</span>
        <Select value={settings.ttsProvider} onValueChange={(value) => save({ ...settings, ttsProvider: String(value) })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="gemini">Gemini</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="browser">Browser</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label className="block space-y-2">
        <span className="text-sm">Speech-to-text provider</span>
        <Select value={settings.sttProvider} onValueChange={(value) => save({ ...settings, sttProvider: String(value) })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="gemini">Gemini</SelectItem>
            <SelectItem value="openai">OpenAI Whisper</SelectItem>
            <SelectItem value="browser">Browser</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={settings.keepRecordings}
          onCheckedChange={(checked) => save({ ...settings, keepRecordings: Boolean(checked) })}
        />
        Keep speech recordings locally until I delete them
      </label>
      <Button
        variant="outline"
        onClick={async () => {
          await api("/api/speaking/recordings", { method: "DELETE", body: JSON.stringify({ all: true }) })
          toast.success("Recordings and transcripts deleted")
        }}
      >
        Delete recordings and transcripts
      </Button>
      {voices.length > 0 && (
        <label className="block space-y-2">
          <span className="text-sm">Turkish voice</span>
          <Select value={settings.ttsVoice ?? voices[0]?.voiceURI} onValueChange={(value) => save({ ...settings, ttsVoice: String(value) })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {voices.map((voice) => (
                <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      )}
      <div>
        <div className="mb-2 text-sm">Reading font size ({settings.fontSize}px)</div>
        <Slider
          value={[settings.fontSize]}
          min={16}
          max={32}
          onValueChange={(value) => save({ ...settings, fontSize: Array.isArray(value) ? (value[0] ?? 20) : value })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={async () => {
            await api("/api/settings", { method: "POST", body: JSON.stringify({ seed: true }) })
            toast.success("Sample vocabulary added")
          }}
        >
          Load sample words
        </Button>
        <Button nativeButton={false} variant="outline" render={<a href="/api/export?kind=vocabulary" />}>
          Export vocabulary
        </Button>
        <Button nativeButton={false} variant="outline" render={<a href="/api/export?kind=progress" />}>
          Export progress
        </Button>
        <Button nativeButton={false} variant="outline" render={<a href="/api/backup" />}>
          Download database
        </Button>
        <Button
          variant="destructive"
          onClick={async () => {
            if (!confirm("Delete all local learning data?")) return
            await api("/api/backup", { method: "POST", body: JSON.stringify({ action: "wipe" }) })
            toast.success("Local data deleted")
          }}
        >
          Delete all data
        </Button>
      </div>
      </PageBody>
    </div>
  )
}
