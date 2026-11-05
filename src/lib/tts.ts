export function speakTurkish(text: string, voiceURI?: string | null, rate = 0.92) {
  if (typeof window === "undefined" || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = "tr-TR"
  utterance.rate = rate
  const voices = window.speechSynthesis.getVoices()
  const selected =
    voices.find((voice) => voice.voiceURI === voiceURI) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("tr"))
  if (selected) utterance.voice = selected
  window.speechSynthesis.speak(utterance)
}

export function turkishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return []
  return window.speechSynthesis
    .getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith("tr") || voice.lang.toLowerCase().includes("turkish"))
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
}
