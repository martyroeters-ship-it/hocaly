export type DialoguePreset = {
  id: string
  label: string
  speaker: string
  hint: string
}

export type DialogueTurn = {
  speaker: string
  turkish: string
  english: string
}

export const DIALOGUE_PRESETS: DialoguePreset[] = [
  { id: "restaurant", label: "Restaurant", speaker: "Waiter", hint: "ordering food with a waiter" },
  { id: "bus", label: "Bus station", speaker: "Bus employee", hint: "buying a ticket or asking about a bus" },
  { id: "hotel", label: "Hotel", speaker: "Receptionist", hint: "checking in at a hotel" },
  { id: "market", label: "Market", speaker: "Cashier", hint: "buying something at a shop" },
  { id: "doctor", label: "Doctor", speaker: "Doctor", hint: "a visit at the clinic" },
  { id: "taxi", label: "Taxi", speaker: "Taxi driver", hint: "giving a driver directions" },
  { id: "neighbors", label: "Neighbors", speaker: "Neighbor", hint: "a friendly chat at the door" },
  { id: "phone", label: "Phone call", speaker: "Caller", hint: "a short phone conversation" },
]

const OPENERS: Record<string, DialogueTurn> = {
  restaurant: {
    speaker: "Waiter",
    turkish: "Merhaba, hoş geldiniz! Bir masa mı istersiniz?",
    english: "Hello, welcome! Would you like a table?",
  },
  bus: {
    speaker: "Bus employee",
    turkish: "Merhaba, nereye gitmek istiyorsunuz?",
    english: "Hello, where would you like to go?",
  },
  hotel: {
    speaker: "Receptionist",
    turkish: "İyi günler, hoş geldiniz. Rezervasyonunuz var mı?",
    english: "Good day, welcome. Do you have a reservation?",
  },
  market: {
    speaker: "Cashier",
    turkish: "Merhaba, bakayım. Ne arıyorsunuz?",
    english: "Hello, let me see. What are you looking for?",
  },
  doctor: {
    speaker: "Doctor",
    turkish: "Merhaba, buyurun. Şikayetiniz nedir?",
    english: "Hello, come in. What is the problem?",
  },
  taxi: {
    speaker: "Taxi driver",
    turkish: "Merhaba, nereye gidelim?",
    english: "Hello, where shall we go?",
  },
  neighbors: {
    speaker: "Neighbor",
    turkish: "Merhaba komşu! Nasılsın, iyi misin?",
    english: "Hello neighbor! How are you, are you well?",
  },
  phone: {
    speaker: "Caller",
    turkish: "Alo, merhaba. Beni duyuyor musunuz?",
    english: "Hello? Can you hear me?",
  },
}

const GENERIC_OPENER: DialogueTurn = {
  speaker: "Staff",
  turkish: "Merhaba! Size nasıl yardımcı olabilirim?",
  english: "Hello! How can I help you?",
}

const GENERIC_FOLLOW_UP: Omit<DialogueTurn, "speaker"> = {
  turkish: "Anladım. Başka bir şey ister misiniz?",
  english: "I understand. Would you like anything else?",
}

export type ResolvedDialogue = {
  id: string
  label: string
  speaker: string
  scenario: string
}

export function guessDialogueSpeaker(topic: string) {
  const text = topic.toLocaleLowerCase("tr-TR")
  if (/(bakery|fırın|bread|ekmek|pasta)/.test(text)) return "Baker"
  if (/(cafe|kahve|coffee)/.test(text)) return "Barista"
  if (/(airport|havaalan)/.test(text)) return "Airport staff"
  if (/(pharmacy|eczane)/.test(text)) return "Pharmacist"
  if (/(school|okul)/.test(text)) return "Teacher"
  if (/(bank|banka)/.test(text)) return "Bank clerk"
  return "Staff"
}

export function resolveDialogueScenario(input: { presetId?: string; topic?: string }): ResolvedDialogue {
  const topic = input.topic?.trim()
  if (topic) {
    const label = topic[0] ? topic[0].toLocaleUpperCase("tr-TR") + topic.slice(1) : topic
    return {
      id: "custom",
      label,
      speaker: guessDialogueSpeaker(topic),
      scenario: topic,
    }
  }
  const preset = DIALOGUE_PRESETS.find((item) => item.id === input.presetId) ?? DIALOGUE_PRESETS[0]!
  return {
    id: preset.id,
    label: preset.label,
    speaker: preset.speaker,
    scenario: `${preset.label}: ${preset.hint}`,
  }
}

export function fallbackDialogueOpener(resolved: ResolvedDialogue): DialogueTurn {
  const scripted = OPENERS[resolved.id]
  if (scripted) return scripted
  return { ...GENERIC_OPENER, speaker: resolved.speaker }
}

export function fallbackDialogueFollowUp(speaker: string): DialogueTurn {
  return { speaker, ...GENERIC_FOLLOW_UP }
}
