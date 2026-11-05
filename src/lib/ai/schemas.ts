import { z } from "zod"

export const selectionTranslationSchema = z.object({
  turkish: z.string().min(1),
  english: z.string().min(1),
  dictionaryForm: z.string().optional(),
  partOfSpeech: z.enum(["noun", "verb", "adjective", "adverb", "expression", "other"]).optional(),
  note: z.string().optional(),
})

export const translationBatchSchema = z.object({
  items: z.array(
    z.object({
      turkish: z.string().min(1),
      meanings: z.array(z.string().min(1)).min(1),
      partOfSpeech: z.enum(["noun", "verb", "adjective", "adverb", "expression", "other"]).optional(),
      dictionaryForm: z.string().optional(),
      cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).optional(),
    }),
  ),
})

function normalizeCombinedSentence(raw: unknown) {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const sentences = Array.isArray(data.sentences) ? data.sentences : []
  const turkishFromList = sentences
    .map((item) => (item && typeof item === "object" ? String((item as { turkish?: string }).turkish ?? "") : ""))
    .filter(Boolean)
    .join(" ")
  const englishFromList = sentences
    .map((item) => (item && typeof item === "object" ? String((item as { english?: string }).english ?? "") : ""))
    .filter(Boolean)
    .join(" ")
  const usedRaw = Array.isArray(data.usedWords) ? data.usedWords : []
  const usedWords = usedRaw
    .map((item) => {
      if (typeof item === "string") return { turkish: item, form: item }
      if (!item || typeof item !== "object") return null
      const row = item as { turkish?: string; word?: string; form?: string }
      const turkish = (row.turkish || row.word || "").trim()
      if (!turkish) return null
      return { turkish, form: (row.form || turkish).trim() }
    })
    .filter((item): item is { turkish: string; form: string } => Boolean(item))

  return {
    turkish: String(data.turkish ?? data.sentence ?? turkishFromList ?? "").trim(),
    english: String(data.english ?? data.translation ?? englishFromList ?? "").trim(),
    usedWords,
    omittedWords: Array.isArray(data.omittedWords) ? data.omittedWords.map((item) => String(item)) : [],
    notes: typeof data.notes === "string" ? data.notes : undefined,
  }
}

export const sentenceSchema = z.preprocess(
  normalizeCombinedSentence,
  z.object({
    turkish: z.string().min(1),
    english: z.string().min(1),
    usedWords: z.array(z.object({ turkish: z.string().min(1), form: z.string().min(1) })),
    omittedWords: z.array(z.string()),
    notes: z.string().optional(),
  }),
)

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => (typeof item === "string" ? item : String(item))).filter(Boolean)
}

export const storySchema = z.preprocess((raw) => {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const sentences = Array.isArray(data.sentences)
    ? data.sentences
        .map((item) => {
          if (!item || typeof item !== "object") return null
          const row = item as { turkish?: string; english?: string }
          const turkish = String(row.turkish ?? "").trim()
          const english = String(row.english ?? "").trim()
          if (!turkish || !english) return null
          return { turkish, english }
        })
        .filter((item): item is { turkish: string; english: string } => Boolean(item))
    : []
  const turkish = String(data.turkish ?? sentences.map((item) => item.turkish).join(" ")).trim()
  const english = String(data.english ?? sentences.map((item) => item.english).join(" ")).trim()
  const questions = Array.isArray(data.questions)
    ? data.questions
        .map((item) => {
          if (!item || typeof item !== "object") return null
          const row = item as { question?: string; answer?: string }
          const question = String(row.question ?? "").trim()
          const answer = String(row.answer ?? "").trim()
          if (!question || !answer) return null
          return { question, answer }
        })
        .filter((item): item is { question: string; answer: string } => Boolean(item))
    : []
  return {
    title: String(data.title ?? "Story").trim() || "Story",
    turkish: turkish || "…",
    english: english || "…",
    sentences: sentences.length ? sentences : turkish && english ? [{ turkish, english }] : [{ turkish: "…", english: "…" }],
    usedWords: asStringList(data.usedWords),
    omittedWords: asStringList(data.omittedWords),
    questions: questions.length ? questions : [{ question: "What is this text about?", answer: english || turkish }],
    grammarNotes: Array.isArray(data.grammarNotes)
      ? data.grammarNotes.flatMap((item): Array<{ structure?: string; explanation?: string }> => {
          if (typeof item === "string") {
            const explanation = item.trim()
            return explanation ? [{ explanation }] : []
          }
          if (!item || typeof item !== "object") return []
          const row = item as { structure?: string; explanation?: string }
          const structure = String(row.structure ?? "").trim()
          const explanation = String(row.explanation ?? "").trim()
          if (!structure && !explanation) return []
          return [{ ...(structure ? { structure } : {}), ...(explanation ? { explanation } : {}) }]
        })
      : [],
  }
}, z.object({
  title: z.string().min(1),
  turkish: z.string().min(1),
  english: z.string().min(1),
  sentences: z.array(z.object({ turkish: z.string().min(1), english: z.string().min(1) })).min(1),
  usedWords: z.array(z.string()),
  omittedWords: z.array(z.string()),
  questions: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })),
  grammarNotes: z
    .array(
      z.object({
        structure: z.string().optional(),
        explanation: z.string().optional(),
      }),
    )
    .optional(),
}))

export const wordExamplesSchema = z.preprocess((raw) => {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const list = Array.isArray(data.examples) ? data.examples : Array.isArray(data.sentences) ? data.sentences : []
  return {
    examples: list
      .map((item) => {
        if (!item || typeof item !== "object") return null
        const row = item as { word?: string; turkish?: string; english?: string; headword?: string }
        const word = String(row.word ?? row.headword ?? "").trim()
        const turkish = String(row.turkish ?? "").trim()
        const english = String(row.english ?? "").trim()
        if (!turkish || !english) return null
        return { word: word || turkish, turkish, english }
      })
      .filter((item): item is { word: string; turkish: string; english: string } => Boolean(item)),
  }
}, z.object({
  examples: z.array(
    z.object({
      word: z.string().min(1),
      turkish: z.string().min(1),
      english: z.string().min(1),
    }),
  ),
}))

export const clozeSchema = z.object({
  sentence: z.string().min(1),
  english: z.string().min(1),
  answer: z.string().min(1),
  accepted: z.array(z.string()).optional(),
})

export const choiceSchema = z.object({
  choices: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
})

export const sentencePromptSchema = z.object({
  english: z.string().min(1),
  acceptedTurkish: z.array(z.string().min(1)).min(1),
})

export const listeningSchema = z.object({
  sentence: z.string().min(1),
  english: z.string().min(1),
})

export const evaluationSchema = z.object({
  result: z.enum(["correct", "spelling", "partial", "incorrect"]),
  explanation: z.string().min(1),
  suggestedCorrection: z.string().optional(),
})

export const vocabGroupsSchema = z.preprocess((raw) => {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const list = Array.isArray(data.groups) ? data.groups : []
  return {
    groups: list
      .map((item) => {
        if (!item || typeof item !== "object") return null
        const row = item as { name?: string; help?: string; ids?: unknown; wordIds?: unknown }
        const ids = Array.isArray(row.ids) ? row.ids : Array.isArray(row.wordIds) ? row.wordIds : []
        const name = String(row.name ?? "").trim()
        if (!name) return null
        return {
          name,
          help: String(row.help ?? "").trim(),
          ids: ids.map((id) => String(id)).filter(Boolean),
        }
      })
      .filter((item): item is { name: string; help: string; ids: string[] } => Boolean(item)),
  }
}, z.object({
  groups: z.array(
    z.object({
      name: z.string().min(1),
      help: z.string(),
      ids: z.array(z.string()),
    }),
  ),
}))

export const vocabTopicSchema = z.preprocess((raw) => {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const ids = Array.isArray(data.ids) ? data.ids : Array.isArray(data.wordIds) ? data.wordIds : []
  return {
    ids: ids.map((id) => String(id)).filter(Boolean),
    note: String(data.note ?? "").trim(),
  }
}, z.object({
  ids: z.array(z.string()),
  note: z.string(),
}))

export const highlightedWordsSchema = z.object({
  note: z.string().optional(),
  words: z.array(
    z.object({
      turkish: z.string().min(1),
      dictionaryForm: z.string().optional(),
      english: z.string().optional(),
      extraMeanings: z.array(z.string()).optional(),
      partOfSpeech: z.enum(["noun", "verb", "adjective", "adverb", "expression", "other"]).optional(),
      context: z.string().optional(),
      highlightColor: z.string().optional(),
    }),
  ),
})

export const wordFormsSchema = z.object({
  dictionaryForm: z.string().min(1),
  partOfSpeech: z.enum(["noun", "verb", "adjective", "adverb", "expression", "other"]),
  forms: z.array(
    z.object({
      form: z.string().min(1),
      label: z.string().min(1),
    }),
  ),
  needsVerification: z.boolean(),
})

function unwrapRecord(raw: unknown): Record<string, unknown> {
  if (Array.isArray(raw)) return { sentences: raw }
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  for (const key of ["story", "passage", "script", "exercise", "data", "result", "listening"]) {
    const inner = data[key]
    if (Array.isArray(inner)) return { ...data, sentences: inner }
    if (typeof inner === "string" && inner.trim()) return { ...data, turkish: String(data.turkish ?? inner) }
    if (inner && typeof inner === "object") {
      const row = inner as Record<string, unknown>
      if (row.sentences || row.turkish || row.title) return { ...data, ...row }
    }
  }
  return data
}

function splitSpoken(text: string) {
  const lines = text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
  if (lines.length >= 2) return lines
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function mapSpokenSentences(value: unknown): { speaker?: string; turkish: string; english: string; targetWords?: string[] }[] {
  if (!Array.isArray(value)) return []
  const mapped: { speaker?: string; turkish: string; english: string; targetWords?: string[] }[] = []
  for (const item of value) {
    if (typeof item === "string") {
      const turkish = item.trim()
      if (turkish) mapped.push({ turkish, english: turkish })
      continue
    }
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const turkish = String(row.turkish ?? row.tr ?? row.text ?? row.sentence ?? "").trim()
    const english = String(row.english ?? row.en ?? row.translation ?? "").trim()
    if (!turkish) continue
    mapped.push({
      speaker: row.speaker ? String(row.speaker) : undefined,
      turkish,
      english: english || turkish,
      targetWords: Array.isArray(row.targetWords) ? row.targetWords.map((word) => String(word)) : undefined,
    })
  }
  return mapped
}

function mapChoiceQuestions(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const row = item as { question?: string; answer?: string; choices?: unknown }
      const question = String(row.question ?? "").trim()
      const answer = String(row.answer ?? "").trim()
      const choices = Array.isArray(row.choices) ? row.choices.map((choice) => String(choice).trim()).filter(Boolean) : []
      if (!question || !answer) return null
      const unique = [...new Set([answer, ...choices])]
      while (unique.length < 2) unique.push(answer)
      return { question, answer, choices: unique }
    })
    .filter((item): item is { question: string; answer: string; choices: string[] } => Boolean(item))
}

export const listeningPassageSchema = z.preprocess((raw) => {
  const data = unwrapRecord(raw)
  let sentences = mapSpokenSentences(data.sentences ?? data.lines ?? data.script)
  if (sentences.length < 2 && Array.isArray(data.turkish)) {
    sentences = mapSpokenSentences(data.turkish)
  }
  if (sentences.length < 2 && typeof data.turkish === "string") {
    const turkishParts = splitSpoken(data.turkish)
    const englishParts = splitSpoken(String(data.english ?? ""))
    sentences = turkishParts.map((turkish, index) => ({
      turkish,
      english: englishParts[index] || turkish,
    }))
  }
  const questions = mapChoiceQuestions(data.questions)
  const dictation = Array.isArray(data.dictation)
    ? data.dictation
        .map((item) => {
          if (!item || typeof item !== "object") return null
          const row = item as { turkish?: string; english?: string }
          const turkish = String(row.turkish ?? "").trim()
          const english = String(row.english ?? "").trim()
          if (!turkish) return null
          return { turkish, english: english || turkish }
        })
        .filter((item): item is { turkish: string; english: string } => Boolean(item))
    : []
  const title = String(data.title ?? "Listening story").trim() || "Listening story"
  const vocabPrompts = mapChoiceQuestions(data.vocabPrompts)
  const usedWords = asStringList(data.usedWords)
  return {
    title,
    sentences,
    questions: questions.length
      ? questions
      : [
          {
            question: "What is this story mainly about?",
            answer: title,
            choices: [title, "A shopping list", "A grammar quiz", "The weather forecast"],
          },
        ],
    dictation: dictation.length ? dictation : sentences.slice(0, 3).map((sentence) => ({ turkish: sentence.turkish, english: sentence.english })),
    vocabPrompts: vocabPrompts.length
      ? vocabPrompts
      : usedWords.length
        ? usedWords.slice(0, 4).map((word) => ({
            question: `Did you hear “${word}” in the audio?`,
            answer: word,
            choices: [word, "evet", "hayır", "bugün"],
          }))
        : [{ question: "Did you hear this story?", answer: "evet", choices: ["evet", "hayır"] }],
    usedWords,
    omittedWords: asStringList(data.omittedWords),
  }
}, z.object({
  title: z.string().min(1),
  sentences: z
    .array(
      z.object({
        speaker: z.string().optional(),
        turkish: z.string().min(1),
        english: z.string().min(1),
        targetWords: z.array(z.string()).optional(),
      }),
    )
    .min(2),
  questions: z
    .array(
      z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
        choices: z.array(z.string().min(1)).min(2),
      }),
    )
    .min(1),
  dictation: z
    .array(
      z.object({
        turkish: z.string().min(1),
        english: z.string().min(1),
      }),
    )
    .min(1),
  vocabPrompts: z
    .array(
      z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
        choices: z.array(z.string().min(1)).min(2),
      }),
    )
    .min(1),
  usedWords: z.array(z.string()),
  omittedWords: z.array(z.string()),
}))

export const speakingEvalSchema = z.object({
  result: z.enum(["correct", "spelling", "partial", "incorrect"]),
  explanation: z.string().min(1),
  vocabulary: z
    .array(
      z.object({
        issue: z.string(),
        detail: z.string(),
      }),
    )
    .optional(),
  grammar: z
    .array(
      z.object({
        issue: z.string(),
        detail: z.string(),
      }),
    )
    .optional(),
  naturalness: z.string().optional(),
  suggestedCorrection: z.string().optional(),
})

export const conversationTurnSchema = z.object({
  turkish: z.string().min(1),
  english: z.string().min(1),
  usedTargetWords: z.array(z.string()).optional(),
  endConversation: z.boolean().optional(),
})

export const dialogueTurnSchema = z.preprocess((raw) => {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    speaker: String(data.speaker ?? data.role ?? data.name ?? "").trim() || "Partner",
    turkish: String(data.turkish ?? data.tr ?? data.text ?? "").trim(),
    english: String(data.english ?? data.en ?? data.translation ?? "").trim(),
  }
}, z.object({
  speaker: z.string().min(1),
  turkish: z.string().min(1),
  english: z.string().min(1),
}))

export const conversationReportSchema = z.object({
  targetUsed: z.array(z.string()),
  targetMissed: z.array(z.string()),
  vocabMistakes: z.array(
    z.object({
      given: z.string(),
      expected: z.string(),
      note: z.string(),
    }),
  ),
  grammarMistakes: z.array(
    z.object({
      quote: z.string(),
      note: z.string(),
    }),
  ),
  improvements: z.array(z.string()),
  newExpressions: z.array(
    z.object({
      turkish: z.string(),
      english: z.string(),
    }),
  ),
  reviewWords: z.array(z.string()),
})

export type TranslationBatch = z.infer<typeof translationBatchSchema>
export type SentenceBatch = z.infer<typeof sentenceSchema>
export type StoryPayload = z.infer<typeof storySchema>
export type ListeningPassage = z.infer<typeof listeningPassageSchema>
