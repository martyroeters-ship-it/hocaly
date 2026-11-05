export type TtsProviderName = "auto" | "browser" | "openai" | "gemini"
export type SttProviderName = "auto" | "browser" | "openai" | "gemini"

export class SpeechUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SpeechUnavailableError"
  }
}

export function speechKeys() {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
  }
}

export function resolveTtsProvider(requested?: string | null): "openai" | "gemini" | "browser" {
  const keys = speechKeys()
  const choice = (requested || process.env.TTS_PROVIDER || "auto").toLowerCase()
  if (choice === "browser") return "browser"
  if (choice === "openai") {
    if (!keys.openai) throw new SpeechUnavailableError("OpenAI TTS needs OPENAI_API_KEY.")
    return "openai"
  }
  if (choice === "gemini") {
    if (!keys.gemini) throw new SpeechUnavailableError("Gemini TTS needs GEMINI_API_KEY.")
    return "gemini"
  }
  if (keys.gemini) return "gemini"
  if (keys.openai) return "openai"
  return "browser"
}

export function resolveSttProvider(requested?: string | null): "openai" | "gemini" | "browser" {
  const keys = speechKeys()
  const choice = (requested || process.env.STT_PROVIDER || "auto").toLowerCase()
  if (choice === "browser") return "browser"
  if (choice === "openai") {
    if (!keys.openai) throw new SpeechUnavailableError("OpenAI speech-to-text needs OPENAI_API_KEY.")
    return "openai"
  }
  if (choice === "gemini") {
    if (!keys.gemini) throw new SpeechUnavailableError("Gemini speech-to-text needs GEMINI_API_KEY.")
    return "gemini"
  }
  if (keys.gemini) return "gemini"
  if (keys.openai) return "openai"
  return "browser"
}

export function speechStatus() {
  const keys = speechKeys()
  return {
    tts: {
      configured: keys.gemini || keys.openai,
      resolved: resolveTtsProvider("auto"),
      providers: ["auto", "gemini", "openai", "browser"] as TtsProviderName[],
    },
    stt: {
      configured: keys.gemini || keys.openai,
      resolved: resolveSttProvider("auto"),
      providers: ["auto", "gemini", "openai", "browser"] as SttProviderName[],
    },
  }
}
