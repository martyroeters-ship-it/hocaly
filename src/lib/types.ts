export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]

export const CEFR_HELP: Record<CefrLevel, string> = {
  A1: "Very short present-tense sentences about everyday things.",
  A2: "Simple connected sentences about daily life.",
  B1: "A natural short story with common linking words.",
  B2: "A fluent narrative that can mix tenses.",
  C1: "Nuanced, idiomatic Turkish.",
  C2: "Native-like style, including richer phrasing.",
}

export const PARTS_OF_SPEECH = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "expression",
  "other",
] as const
export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number]

export const LEARNING_STATUSES = ["new", "learning", "reviewing", "mastered"] as const
export type LearningStatus = (typeof LEARNING_STATUSES)[number]

/** Progress buckets shown on the dashboard (mastered ≈ mature FSRS cards). */
export const VOCAB_BUCKETS = ["not-introduced", "learning", "reviewing", "mature"] as const
export type VocabBucket = (typeof VOCAB_BUCKETS)[number]

export const CEFR_SOURCES = ["verified", "estimate", "user"] as const
export type CefrSource = (typeof CEFR_SOURCES)[number]

/**
 * Vocabulary practice faces.
 * Recognition = Turkish → meaning. Production = meaning → type Turkish.
 * Scheduled separately on WordSkill without doubling the primary SrsCard due queue.
 */
export const VOCAB_FACES = ["recognition", "production"] as const
export type VocabFace = (typeof VOCAB_FACES)[number]

export const TEST_MODES = [
  "tr-en",
  "en-tr",
  "cloze",
  "multiple-choice",
  "sentence",
  "listening",
] as const
export type TestMode = (typeof TEST_MODES)[number]

export const EVAL_RESULTS = ["correct", "spelling", "partial", "incorrect"] as const
export type EvalResult = (typeof EVAL_RESULTS)[number]

export const SRS_RATINGS = ["again", "hard", "good", "easy"] as const
export type SrsRating = (typeof SRS_RATINGS)[number]

export const SKILLS = ["reading", "writing", "listening", "speaking", "recognition", "production"] as const
export type Skill = (typeof SKILLS)[number]

export const MODALITY_SKILLS = ["reading", "writing", "listening", "speaking"] as const
export type ModalitySkill = (typeof MODALITY_SKILLS)[number]

export function isVocabFace(value: string | null | undefined): value is VocabFace {
  return VOCAB_FACES.includes(value as VocabFace)
}

export const LISTENING_FORMATS = ["monologue", "conversation"] as const
export type ListeningFormat = (typeof LISTENING_FORMATS)[number]

export const SPEAKING_MODES = ["listen-repeat", "translate-speak", "conversation"] as const
export type SpeakingMode = (typeof SPEAKING_MODES)[number]

export type ListeningSentence = {
  speaker?: string
  turkish: string
  english: string
  targetWords?: string[]
}

export type ListeningQuestion = {
  question: string
  answer: string
  choices: string[]
}

export type SpokenFeedback = {
  result: EvalResult
  missing: string[]
  extra: string[]
  matched: string[]
  coverage: number
  disclaimer: string
  explanation?: string
  vocabulary?: { issue: string; detail: string }[]
  grammar?: { issue: string; detail: string }[]
  naturalness?: string
}

export type ParsedImportRow = {
  turkish: string
  english?: string
  extraMeanings?: string[]
  tags?: string[]
  cefrLevel?: CefrLevel
  cefrSource?: CefrSource
  frequencyRank?: number
  collocations?: string[]
  grammarNotes?: string
  partOfSpeech?: PartOfSpeech
  notes?: string
  context?: string
  highlightedForm?: string
  lineNumber: number
}

export type ImportPreviewRow = ParsedImportRow & {
  normalized: string
  duplicateInFile: boolean
  existingId?: string
  existingEnglish?: string
  existingUserEdited: boolean
  action: "create" | "skip" | "add-meaning" | "needs-translation"
  omitLabels?: boolean
}

export type WordListItem = {
  id: string
  turkish: string
  dictionaryForm: string | null
  english: string
  meanings: string[]
  partOfSpeech: string | null
  cefrLevel: string | null
  cefrSource: string | null
  frequencyRank: number | null
  collocations: string[]
  grammarNotes: string | null
  learningStatus: string
  reviewCount: number
  correctCount: number
  accuracy: number | null
  nextReviewAt: string | null
  lastReviewedAt: string | null
  tags: string[]
  example: { id: string; turkish: string; english: string; highlight: string | null } | null
  notes: string | null
  /** Suggested practice face for the next review (from skill weakness). */
  suggestedFace?: VocabFace
  retrievability?: number | null
  lapses?: number
  stability?: number | null
  difficulty?: number | null
}

export type StorySentence = {
  turkish: string
  english: string
}

export type StoryQuestion = {
  question: string
  answer: string
}
