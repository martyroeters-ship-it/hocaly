/**
 * Topic practice: five exercise types + master mix (2 of each).
 */
import { getStructure, GRAMMAR_DRILL_NOUNS, GRAMMAR_DRILL_VERBS } from "@/lib/grammar"
import {
  templatesForStructure,
  validateQuestion,
  type AssessmentTemplate,
} from "@/lib/grammar/assessment-bank"
import {
  buildConjugationDrills,
  buildParadigm,
  conjugate,
  mutateWrongForm,
  primaryGlossVerb,
  stripInfinitive,
  type Person,
} from "@/lib/grammar/conjugate"
import { getGrammarLesson } from "@/lib/grammar/lessons"

export type PracticeExerciseKind =
  | "conjugation"
  | "blank"
  | "error-correction"
  | "translate"
  | "transform"

export type PracticeModeId = PracticeExerciseKind | "master"

export type PracticeExercise = {
  kind: PracticeExerciseKind
  structureId: string
  structureLabel: string
  instruction: string
  expected: string
  accepted: string[]
  verb?: string
  verbEnglish?: string
  /** Primary surface prompt (Turkish blank / broken sentence / verb line). */
  turkishPrompt?: string
  englishPrompt?: string
  sentenceCue?: string
  brokenForm?: string
  sourceSentences?: string[]
  turkishFull?: string
  /** Grammar chunk that must appear for flexible translation grading. */
  requiredForm?: string
  person?: Person
  personLabel?: string
  uncertainKey?: boolean
}

const SECONDARY_CLAUSES = [
  { full: "Ben işe gittim.", clause: "işe gittim" },
  { full: "Ben eve döndüm.", clause: "eve döndüm" },
  { full: "Ben dışarı çıktım.", clause: "dışarı çıktım" },
  { full: "Ben uyudum.", clause: "uyudum" },
  { full: "Ben dinlendim.", clause: "dinlendim" },
] as const

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

function uniqByExpected(items: PracticeExercise[]): PracticeExercise[] {
  const seen = new Set<string>()
  const out: PracticeExercise[] = []
  for (const item of items) {
    const key = `${item.kind}:${item.expected.trim().toLocaleLowerCase("tr-TR")}:${item.turkishPrompt ?? ""}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function capitalizeTr(value: string) {
  if (!value) return value
  return value.charAt(0).toLocaleUpperCase("tr-TR") + value.slice(1)
}

function stripTerminalPunct(value: string) {
  return value.trim().replace(/[.?!…]+$/u, "").trim()
}

function withSentenceVariants(primary: string, extra: string[] = []): string[] {
  const base = stripTerminalPunct(primary)
  const variants = [primary.trim(), base, capitalizeTr(base), `${base}.`, `${capitalizeTr(base)}.`]
  for (const item of extra) {
    // Skip blank-only keys (e.g. "beklemeden") — those are not full-sentence answers.
    const clean = stripTerminalPunct(item)
    if (!clean || !/\s/.test(clean)) continue
    variants.push(item.trim(), clean, capitalizeTr(clean), `${clean}.`)
  }
  return [...new Set(variants.map((part) => part.trim()).filter(Boolean))]
}

/** Ambiguous English “left/went” often allows gitmek ↔ çıkmak. */
const MOTION_VERB_ALTS: Array<[RegExp, string[]]> = [
  [/\bgittik\b/iu, ["gittik", "çıktık"]],
  [/\bçıktık\b/iu, ["çıktık", "gittik"]],
  [/\bgitti\b/iu, ["gitti", "çıktı"]],
  [/\bçıktı\b/iu, ["çıktı", "gitti"]],
  [/\bgittim\b/iu, ["gittim", "çıktım"]],
  [/\bçıktım\b/iu, ["çıktım", "gittim"]],
  [/\bgittiniz\b/iu, ["gittiniz", "çıktınız"]],
  [/\bçıktınız\b/iu, ["çıktınız", "gittiniz"]],
  [/\bgittiler\b/iu, ["gittiler", "çıktılar"]],
  [/\bçıktılar\b/iu, ["çıktılar", "gittiler"]],
]

function expandMotionVerbSynonyms(sentence: string): string[] {
  const out = new Set<string>([sentence])
  for (const [pattern, alts] of MOTION_VERB_ALTS) {
    if (!pattern.test(sentence)) continue
    for (const alt of alts) {
      out.add(sentence.replace(pattern, alt))
    }
  }
  return [...out]
}

function expandTranslationAccepted(turkishFull: string, extra: string[] = []): string[] {
  const base = withSentenceVariants(turkishFull, extra)
  return [...new Set(base.flatMap((sentence) => expandMotionVerbSynonyms(sentence)))]
}

/** Short pedagogical name: "Without doing (-madan/-meden)" → "without doing". */
export function practiceFormLabel(structureId: string): string {
  const structure = getStructure(structureId)
  if (!structure) return structureId
  const fromLabel = structure.label.replace(/\s*\([^)]*\)\s*$/u, "").trim()
  if (fromLabel) return fromLabel.toLocaleLowerCase("en-US")
  return structure.hint.replace(/[.…]+$/u, "").trim().toLocaleLowerCase("en-US") || structureId
}

function assessmentPool(structureId: string): AssessmentTemplate[] {
  return shuffle(
    templatesForStructure(structureId).filter((template) => validateQuestion(template).ok),
  )
}

function acceptBlank(template: AssessmentTemplate): string[] {
  return [
    ...new Set(
      [template.blank, ...(template.accepted ?? [])]
        .map((part) => part.trim())
        .filter(Boolean)
        .flatMap((part) => {
          const bare = part.replace(/[?!]+$/g, "")
          return part === bare ? [part] : [part, bare]
        }),
    ),
  ]
}

export function buildConjugationExercises(structureId: string, count = 10): PracticeExercise[] {
  const structure = getStructure(structureId)
  if (!structure) return []
  const formLabel = practiceFormLabel(structureId)
  const drills = structure.conjugable
    ? buildConjugationDrills({ structureIds: [structureId], count: count * 2, kind: "blank" })
    : []

  const fromDrills: PracticeExercise[] = drills.map((drill) => ({
    kind: "conjugation",
    structureId,
    structureLabel: structure.label,
    instruction: `Convert the verb into its “${formLabel}” form.`,
    turkishPrompt: `Verb: ${drill.verb}${drill.verbEnglish ? ` (${drill.verbEnglish})` : ""}`,
    englishPrompt: drill.englishPrompt ?? drill.promptEnglish,
    sentenceCue: drill.sentenceCue,
    expected: drill.expected,
    accepted: drill.accepted?.length ? drill.accepted : [drill.expected],
    verb: drill.verb,
    verbEnglish: drill.verbEnglish,
    person: drill.person,
    personLabel: drill.personLabel,
    uncertainKey: drill.uncertainKey,
  }))

  if (fromDrills.length >= count) return shuffle(uniqByExpected(fromDrills)).slice(0, count)

  // Noun / static paradigms
  const paradigms = buildParadigm(structureId, GRAMMAR_DRILL_NOUNS[0]?.turkish ?? "ev")
  const staticItems: PracticeExercise[] = []
  for (const noun of GRAMMAR_DRILL_NOUNS) {
    const forms = buildParadigm(structureId, noun.turkish)
    for (const form of forms) {
      if (form.label.trim().toLowerCase() === "example") continue
      staticItems.push({
        kind: "conjugation",
        structureId,
        structureLabel: structure.label,
        instruction: `Convert the word into its “${formLabel}” form.`,
        turkishPrompt: `Word: ${noun.turkish} (${noun.english})`,
        expected: form.turkish.replace(/[?!]+$/g, ""),
        accepted: [form.turkish.replace(/[?!]+$/g, ""), form.turkish],
        verb: noun.turkish,
        verbEnglish: noun.english,
      })
    }
    if (!forms.length && paradigms.length) break
  }

  return shuffle(uniqByExpected([...fromDrills, ...staticItems])).slice(0, count)
}

export function buildContextBlankExercises(structureId: string, count = 10): PracticeExercise[] {
  const structure = getStructure(structureId)
  if (!structure) return []
  const fromBank: PracticeExercise[] = assessmentPool(structureId).map((template) => {
    const lemma = template.lemma?.trim()
    return {
      kind: "blank" as const,
      structureId,
      structureLabel: structure.label,
      instruction: "",
      turkishPrompt: template.turkishFull.replace(template.blank, "______"),
      englishPrompt: template.english,
      sentenceCue: template.turkishFull.replace(template.blank, "______"),
      expected: template.blank.replace(/[?!]+$/g, ""),
      accepted: acceptBlank(template),
      verb: lemma,
      verbEnglish: template.english,
      turkishFull: template.turkishFull,
    }
  })

  if (fromBank.length >= count) return shuffle(uniqByExpected(fromBank)).slice(0, count)

  // Lesson sentences: blank the conjugated form when we can find it via conjugator.
  const lesson = getGrammarLesson(structureId)
  const fromLesson: PracticeExercise[] = []
  if (lesson) {
    for (const sentence of lesson.sentences) {
      const hit = findFormInSentence(structureId, sentence.turkish)
      if (!hit) continue
      fromLesson.push({
        kind: "blank",
        structureId,
        structureLabel: structure.label,
        instruction: "",
        turkishPrompt: sentence.turkish.replace(hit.form, "______"),
        englishPrompt: sentence.english,
        sentenceCue: sentence.turkish.replace(hit.form, "______"),
        expected: hit.form,
        accepted: [hit.form],
        verb: hit.lemma,
        verbEnglish: hit.lemmaEnglish,
        turkishFull: sentence.turkish,
      })
    }
  }

  const needed = Math.max(0, count - fromBank.length - fromLesson.length)
  const generated = needed > 0 ? generateSentenceBlankExercises(structureId, needed * 2) : []

  return shuffle(uniqByExpected([...fromBank, ...fromLesson, ...generated])).slice(0, count)
}

function englishGerund(verbEnglish: string) {
  const base = primaryGlossVerb(verbEnglish)
  if (base.endsWith("e") && !base.endsWith("ee")) return `${base.slice(0, -1)}ing`
  if (/[^aeiou]y$/i.test(base)) return `${base.slice(0, -1)}ying`
  return `${base}ing`
}

type SentenceFrame = {
  turkish: (form: string) => string
  english: (ing: string) => string
  /** Restrict to these lemmas when set. */
  lemmas?: string[]
}

const SENTENCE_FRAMES: Record<string, SentenceFrame[]> = {
  "without-doing": [
    {
      turkish: (form) => `Kahvaltı ${form} evden çıktım.`,
      english: () => "I left home without eating breakfast.",
      lemmas: ["yapmak"],
    },
    {
      turkish: (form) => `${capitalizeTr(form)} evden çıktım.`,
      english: (ing) => `I left home without ${ing}.`,
    },
    {
      turkish: (form) => `O ${form} işe gitti.`,
      english: (ing) => `He/she went to work without ${ing}.`,
    },
    {
      turkish: (form) => `Biz ${form} dışarı çıktık.`,
      english: (ing) => `We went outside without ${ing}.`,
    },
    {
      turkish: (form) => `Hiçbir şey ${form} konuştum.`,
      english: (ing) => `I spoke without ${ing} anything.`,
    },
    {
      turkish: (form) => `Çay ${form} gitti.`,
      english: () => "He/she left without drinking tea.",
      lemmas: ["içmek"],
    },
    {
      turkish: (form) => `Soruyu ${form} cevap verdim.`,
      english: () => "I answered without understanding the question.",
      lemmas: ["anlamak"],
    },
    {
      turkish: (form) => `Bana ${form} konuştu.`,
      english: () => "He/she spoke without looking at me.",
      lemmas: ["bakmak"],
    },
  ],
  "before-doing": [
    {
      turkish: (form) => `${capitalizeTr(form)} ellerimi yıkadım.`,
      english: (ing) => `I washed my hands before ${ing}.`,
    },
    {
      turkish: (form) => `${capitalizeTr(form)} kapıyı kilitle.`,
      english: (ing) => `Lock the door before ${ing}.`,
    },
    {
      turkish: (form) => `${capitalizeTr(form)} beni ara.`,
      english: (ing) => `Call me before ${ing}.`,
    },
  ],
  "after-doing": [
    {
      turkish: (form) => `${capitalizeTr(form)} yürüdüm.`,
      english: (ing) => `I walked after ${ing}.`,
    },
    {
      turkish: (form) => `${capitalizeTr(form)} dinlendik.`,
      english: (ing) => `We rested after ${ing}.`,
    },
    {
      turkish: (form) => `${capitalizeTr(form)} uyudu.`,
      english: (ing) => `He/she slept after ${ing}.`,
    },
  ],
  "while-doing": [
    {
      turkish: (form) => `${capitalizeTr(form)} müzik dinliyorum.`,
      english: (ing) => `I listen to music while ${ing}.`,
    },
    {
      turkish: (form) => `${capitalizeTr(form)} gülümsedi.`,
      english: (ing) => `He/she smiled while ${ing}.`,
    },
    {
      turkish: (form) => `${capitalizeTr(form)} düşünüyorum.`,
      english: (ing) => `I think while ${ing}.`,
    },
  ],
  "by-doing": [
    {
      turkish: (form) => `Okula ${form} gidiyorum.`,
      english: (ing) => `I go to school by ${ing}.`,
    },
    {
      turkish: (form) => `${capitalizeTr(form)} cevap verdi.`,
      english: (ing) => `He/she answered by ${ing}.`,
    },
    {
      turkish: (form) => `${capitalizeTr(form)} öğrendik.`,
      english: (ing) => `We learned by ${ing}.`,
    },
  ],
  "present-continuous": [
    {
      turkish: (form) => `Şu anda kitap ${form}.`,
      english: () => "I am reading a book right now.",
      lemmas: ["okumak"],
    },
    {
      turkish: (form) => `Babam mutfakta yemek ${form}.`,
      english: () => "My father is cooking in the kitchen.",
      lemmas: ["yapmak"],
    },
    {
      turkish: (form) => `Biz şimdi Türkçe ${form}.`,
      english: () => "We are speaking Turkish now.",
      lemmas: ["konuşmak"],
    },
    {
      turkish: (form) => `Çocuklar parkta ${form}.`,
      english: (ing) => `The children are ${ing} in the park.`,
    },
  ],
  "simple-past": [
    {
      turkish: (form) => `Dün sinemaya ${form}.`,
      english: () => "I went to the cinema yesterday.",
      lemmas: ["gitmek"],
    },
    {
      turkish: (form) => `Geçen hafta bu kitabı ${form}.`,
      english: () => "I read this book last week.",
      lemmas: ["okumak"],
    },
    {
      turkish: (form) => `Sabah erken ${form}.`,
      english: (ing) => `I ${ing} early this morning.`,
    },
  ],
  future: [
    {
      turkish: (form) => `Yarın Ankara'ya ${form}.`,
      english: () => "I will go to Ankara tomorrow.",
      lemmas: ["gitmek"],
    },
    {
      turkish: (form) => `Akşam seni ${form}.`,
      english: () => "I will call you this evening.",
      lemmas: ["aramak"],
    },
    {
      turkish: (form) => `Bu akşam yemek ${form}.`,
      english: () => "I will cook dinner this evening.",
      lemmas: ["yapmak"],
    },
  ],
}

function defaultSentenceFrames(structureId: string): SentenceFrame[] {
  if (structureId.includes("without")) {
    return SENTENCE_FRAMES["without-doing"] ?? []
  }
  if (structureId.includes("before")) return SENTENCE_FRAMES["before-doing"] ?? []
  if (structureId.includes("after")) return SENTENCE_FRAMES["after-doing"] ?? []
  if (structureId.includes("while")) return SENTENCE_FRAMES["while-doing"] ?? []
  if (structureId.includes("by-doing")) return SENTENCE_FRAMES["by-doing"] ?? []

  return [
    {
      turkish: (form) => `Ben bugün bunu ${form}.`,
      english: (ing) => `I am ${ing} / I ${ing} this today.`,
    },
    {
      turkish: (form) => `O dün bunu ${form}.`,
      english: (ing) => `He/she ${ing} this yesterday.`,
    },
    {
      turkish: (form) => `Biz şimdi bunu ${form}.`,
      english: (ing) => `We are ${ing} this now.`,
    },
    {
      turkish: (form) => `Akşam yemeğinden sonra ${form}.`,
      english: (ing) => `After dinner I ${ing}.`,
    },
  ]
}

function generateSentenceBlankExercises(structureId: string, count: number): PracticeExercise[] {
  const structure = getStructure(structureId)
  if (!structure?.conjugable) return []

  const frames = SENTENCE_FRAMES[structureId] ?? defaultSentenceFrames(structureId)
  const person: Person = structureId.includes("question") ? "2sg" : "1sg"

  const out: PracticeExercise[] = []
  for (const verb of shuffle([...GRAMMAR_DRILL_VERBS])) {
    const stem = stripInfinitive(verb.turkish)
    // Prefer 1sg for tensed paradigms so frames like "Ben …" match; 3sg for converbs.
    const prefer3sg = [
      "without-doing",
      "before-doing",
      "after-doing",
      "while-doing",
      "by-doing",
      "purpose-mak-icin",
      "basic-participles",
    ].includes(structureId)
    const form =
      conjugate(structureId, stem, prefer3sg ? "3sg" : person) ??
      conjugate(structureId, stem, "3sg") ??
      conjugate(structureId, stem, "1sg")
    if (!form) continue
    const ing = englishGerund(verb.english)
    for (const frame of frames) {
      if (frame.lemmas && !frame.lemmas.includes(verb.turkish)) continue
      const turkishFull = frame.turkish(form)
      if (!turkishFull.includes(form)) continue
      out.push({
        kind: "blank",
        structureId,
        structureLabel: structure.label,
        instruction: "",
        turkishPrompt: turkishFull.replace(form, "______"),
        englishPrompt: frame.english(ing),
        sentenceCue: turkishFull.replace(form, "______"),
        expected: form,
        accepted: [form, capitalizeTr(form)],
        verb: verb.turkish,
        verbEnglish: verb.english,
        turkishFull,
      })
      if (out.length >= count) return out
    }
  }
  return out
}

function findFormInSentence(
  structureId: string,
  turkish: string,
): { form: string; lemma?: string; lemmaEnglish?: string } | null {
  const lower = turkish.toLocaleLowerCase("tr-TR")
  for (const verb of GRAMMAR_DRILL_VERBS) {
    const stem = stripInfinitive(verb.turkish)
    const persons: Person[] = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"]
    for (const person of persons) {
      const form = conjugate(structureId, stem, person)
      if (!form) continue
      const needle = form.toLocaleLowerCase("tr-TR")
      if (lower.includes(needle)) {
        // Prefer the casing as it appears in the sentence when possible.
        const index = lower.indexOf(needle)
        const surfaced = turkish.slice(index, index + form.length)
        return { form: surfaced || form, lemma: verb.turkish, lemmaEnglish: verb.english }
      }
    }
  }
  for (const noun of GRAMMAR_DRILL_NOUNS) {
    const form = conjugate(structureId, noun.turkish, "3sg")
    if (!form) continue
    const needle = form.toLocaleLowerCase("tr-TR")
    if (lower.includes(needle)) {
      const index = lower.indexOf(needle)
      const surfaced = turkish.slice(index, index + form.length)
      return { form: surfaced || form, lemma: noun.turkish, lemmaEnglish: noun.english }
    }
  }
  return null
}

export function buildErrorCorrectionExercises(structureId: string, count = 10): PracticeExercise[] {
  const structure = getStructure(structureId)
  if (!structure) return []
  const items: PracticeExercise[] = []

  for (const template of assessmentPool(structureId)) {
    if (items.length >= count * 2) break
    const correct = template.blank
    const broken = mutateWrongForm(correct)
    if (!broken || broken === correct) continue
    if (!template.turkishFull.includes(correct)) continue
    const brokenSentence = template.turkishFull.replace(correct, broken)
    items.push({
      kind: "error-correction",
      structureId,
      structureLabel: structure.label,
      instruction: "Find and correct the grammatical mistake.",
      turkishPrompt: brokenSentence,
      englishPrompt: template.english,
      sentenceCue: brokenSentence,
      brokenForm: broken,
      expected: correct.replace(/[?!]+$/g, ""),
      accepted: acceptBlank(template),
      verb: template.lemma,
      verbEnglish: template.english,
      turkishFull: template.turkishFull,
    })
  }

  if (items.length < count) {
    const seeds = buildConjugationDrills({
      structureIds: [structureId],
      count: count * 3,
      kind: "blank",
    })
    for (const seed of seeds) {
      if (items.length >= count * 2) break
      const broken = mutateWrongForm(seed.expected)
      if (!broken || broken === seed.expected) continue
      items.push({
        kind: "error-correction",
        structureId,
        structureLabel: structure.label,
        instruction: "Find and correct the grammatical mistake.",
        turkishPrompt: broken,
        englishPrompt: seed.englishPrompt ?? seed.promptEnglish,
        sentenceCue: broken,
        brokenForm: broken,
        expected: seed.expected,
        accepted: seed.accepted?.length ? seed.accepted : [seed.expected],
        verb: seed.verb,
        verbEnglish: seed.verbEnglish,
      })
    }
  }

  return shuffle(uniqByExpected(items)).slice(0, count)
}

export function buildTranslationExercises(structureId: string, count = 10): PracticeExercise[] {
  const structure = getStructure(structureId)
  if (!structure) return []
  const formLabel = practiceFormLabel(structureId)
  const items: PracticeExercise[] = []

  for (const template of assessmentPool(structureId)) {
    const requiredForm = template.blank.replace(/[?!]+$/g, "")
    const extras = [...(template.accepted ?? [])]
    if (/left without waiting/i.test(template.english)) {
      extras.push("Beklemeden çıktık.", "Biz beklemeden gittik.", "Biz beklemeden çıktık.")
    }
    items.push({
      kind: "translate",
      structureId,
      structureLabel: structure.label,
      instruction: "Translate into Turkish.",
      englishPrompt: template.english,
      turkishPrompt: template.english,
      sentenceCue: template.english,
      expected: stripTerminalPunct(template.turkishFull),
      accepted: expandTranslationAccepted(template.turkishFull, extras),
      verb: template.lemma,
      verbEnglish: template.english,
      turkishFull: template.turkishFull,
      requiredForm,
    })
  }

  const lesson = getGrammarLesson(structureId)
  if (lesson) {
    for (const sentence of lesson.sentences) {
      const hit = findFormInSentence(structureId, sentence.turkish)
      items.push({
        kind: "translate",
        structureId,
        structureLabel: structure.label,
        instruction: "Translate into Turkish.",
        englishPrompt: sentence.english,
        turkishPrompt: sentence.english,
        sentenceCue: sentence.english,
        expected: stripTerminalPunct(sentence.turkish),
        accepted: expandTranslationAccepted(sentence.turkish),
        verb: hit?.lemma,
        verbEnglish: hit?.lemmaEnglish ?? sentence.english,
        turkishFull: sentence.turkish,
        requiredForm: hit?.form,
      })
    }
  }

  if (items.length < count && structure.conjugable) {
    // Full-sentence gloss translations from conjugation drills (harder than isolated forms).
    const drills = buildConjugationDrills({
      structureIds: [structureId],
      count: count * 2,
      kind: "sentence",
      withEnglishGloss: true,
    })
    for (const drill of drills) {
      const english = drill.englishPrompt ?? drill.promptEnglish
      if (!english || !drill.expected) continue
      items.push({
        kind: "translate",
        structureId,
        structureLabel: structure.label,
        instruction: `Translate into Turkish using the “${formLabel}” form.`,
        englishPrompt: english,
        turkishPrompt: english,
        sentenceCue: english,
        expected: drill.expected,
        accepted: drill.accepted?.length ? drill.accepted : [drill.expected],
        verb: drill.verb,
        verbEnglish: drill.verbEnglish,
        requiredForm: drill.expected,
      })
    }
  }

  return shuffle(uniqByExpected(items)).slice(0, count)
}

export function buildTransformationExercises(structureId: string, count = 10): PracticeExercise[] {
  const structure = getStructure(structureId)
  if (!structure) return []
  const formLabel = practiceFormLabel(structureId)
  const curated = curatedTransforms(structureId)
  const generated = generateConverbTransforms(structureId)
  const polarity = generatePolarityTransforms(structureId)

  const mapped = [...curated, ...generated, ...polarity].map((row) => ({
    kind: "transform" as const,
    structureId,
    structureLabel: structure.label,
    instruction: row.instruction ?? `Combine these two sentences using the “${formLabel}” construction.`,
    sourceSentences: row.sourceSentences,
    turkishPrompt: row.sourceSentences.join("\n"),
    englishPrompt: row.english,
    sentenceCue: row.sourceSentences.join(" · "),
    expected: stripTerminalPunct(row.expected),
    accepted: withSentenceVariants(row.expected, row.accepted ?? []),
    verb: row.verb,
    verbEnglish: row.verbEnglish,
    turkishFull: row.expected,
  }))

  return shuffle(uniqByExpected(mapped)).slice(0, count)
}

type TransformSeed = {
  sourceSentences: string[]
  expected: string
  accepted?: string[]
  english?: string
  verb?: string
  verbEnglish?: string
  instruction?: string
}

function curatedTransforms(structureId: string): TransformSeed[] {
  const all: Record<string, TransformSeed[]> = {
    "without-doing": [
      {
        sourceSentences: ["Ben kahvaltı yapmadım.", "Ben işe gittim."],
        expected: "Kahvaltı yapmadan işe gittim.",
        accepted: ["Ben kahvaltı yapmadan işe gittim."],
        english: "I went to work without eating breakfast.",
        verb: "yapmak",
      },
      {
        sourceSentences: ["Ben hiçbir şey yazmadım.", "Ben evden çıktım."],
        expected: "Hiçbir şey yazmadan evden çıktım.",
        accepted: ["Ben hiçbir şey yazmadan evden çıktım."],
        verb: "yazmak",
      },
      {
        sourceSentences: ["Ben sana bakmadım.", "Ben konuştum."],
        expected: "Sana bakmadan konuştum.",
        accepted: ["Ben sana bakmadan konuştum."],
        verb: "bakmak",
      },
    ],
    "before-doing": [
      {
        sourceSentences: ["Ben yemek yiyeceğim.", "Ben ellerimi yıkadım."],
        expected: "Yemeden önce ellerimi yıkadım.",
        accepted: ["Ben yemeden önce ellerimi yıkadım."],
        verb: "yemek",
      },
      {
        sourceSentences: ["Ben çıkacağım.", "Ben kapıyı kapattım."],
        expected: "Çıkmadan önce kapıyı kapattım.",
        accepted: ["Ben çıkmadan önce kapıyı kapattım."],
        verb: "çıkmak",
      },
    ],
    "after-doing": [
      {
        sourceSentences: ["Ben eve geldim.", "Ben yemek yaptım."],
        expected: "Eve geldikten sonra yemek yaptım.",
        accepted: ["Ben eve geldikten sonra yemek yaptım."],
        verb: "gelmek",
      },
      {
        sourceSentences: ["Ben ödevimi yaptım.", "Ben dışarı çıktım."],
        expected: "Ödevimi yaptıktan sonra dışarı çıktım.",
        accepted: ["Ben ödevimi yaptıktan sonra dışarı çıktım."],
        verb: "yapmak",
      },
    ],
    "while-doing": [
      {
        sourceSentences: ["Ben çalışıyorum.", "Ben müzik dinliyorum."],
        expected: "Çalışırken müzik dinliyorum.",
        accepted: ["Ben çalışırken müzik dinliyorum."],
        verb: "çalışmak",
      },
      {
        sourceSentences: ["Ben eve gidiyorum.", "Ben ekmek aldım."],
        expected: "Eve giderken ekmek aldım.",
        accepted: ["Ben eve giderken ekmek aldım."],
        verb: "gitmek",
      },
    ],
    "by-doing": [
      {
        sourceSentences: ["Ben yürüdüm.", "Ben okula gittim."],
        expected: "Okula yürüyerek gittim.",
        accepted: ["Ben okula yürüyerek gittim.", "Yürüyerek okula gittim."],
        verb: "yürümek",
      },
      {
        sourceSentences: ["Ben güldüm.", "Ben cevap verdim."],
        expected: "Gülerek cevap verdim.",
        accepted: ["Ben gülerek cevap verdim."],
        verb: "gülmek",
      },
    ],
    "purpose-mak-icin": [
      {
        sourceSentences: ["Ben Türkçe öğrenmek istiyorum.", "Ben Türkiye'ye geldim."],
        expected: "Türkçe öğrenmek için Türkiye'ye geldim.",
        accepted: ["Ben Türkçe öğrenmek için Türkiye'ye geldim."],
        verb: "öğrenmek",
      },
    ],
  }
  return all[structureId] ?? []
}

function generateConverbTransforms(structureId: string): TransformSeed[] {
  if (
    !["without-doing", "before-doing", "after-doing", "while-doing", "by-doing"].includes(structureId)
  ) {
    return []
  }
  const out: TransformSeed[] = []
  for (const verb of GRAMMAR_DRILL_VERBS) {
    const stem = stripInfinitive(verb.turkish)
    const form = conjugate(structureId, stem, "3sg")
    if (!form) continue
    const secondary = SECONDARY_CLAUSES[out.length % SECONDARY_CLAUSES.length]!
    if (structureId === "without-doing") {
      const negPast = conjugate("simple-past-negation", stem, "1sg")
      if (!negPast) continue
      out.push({
        sourceSentences: [`Ben ${negPast}.`, secondary.full],
        expected: `${capitalizeTr(form)} ${secondary.clause}.`,
        accepted: [`Ben ${form} ${secondary.clause}.`],
        verb: verb.turkish,
        verbEnglish: verb.english,
      })
    } else if (structureId === "before-doing") {
      const future = conjugate("future", stem, "1sg")
      if (!future) continue
      out.push({
        sourceSentences: [`Ben ${future}.`, secondary.full],
        expected: `${capitalizeTr(form)} ${secondary.clause}.`,
        accepted: [`Ben ${form} ${secondary.clause}.`],
        verb: verb.turkish,
        verbEnglish: verb.english,
      })
    } else if (structureId === "after-doing") {
      const past = conjugate("simple-past", stem, "1sg")
      if (!past) continue
      out.push({
        sourceSentences: [`Ben ${past}.`, secondary.full],
        expected: `${capitalizeTr(form)} ${secondary.clause}.`,
        accepted: [`Ben ${form} ${secondary.clause}.`],
        verb: verb.turkish,
        verbEnglish: verb.english,
      })
    } else if (structureId === "while-doing") {
      const progressive = conjugate("present-continuous", stem, "1sg")
      if (!progressive) continue
      out.push({
        sourceSentences: [`Ben ${progressive}.`, "Ben müzik dinliyorum."],
        expected: `${capitalizeTr(form)} müzik dinliyorum.`,
        accepted: [`Ben ${form} müzik dinliyorum.`],
        verb: verb.turkish,
        verbEnglish: verb.english,
      })
    } else if (structureId === "by-doing") {
      const past = conjugate("simple-past", stem, "1sg")
      if (!past) continue
      out.push({
        sourceSentences: [`Ben ${past}.`, secondary.full],
        expected: `${capitalizeTr(form)} ${secondary.clause}.`,
        accepted: [`Ben ${form} ${secondary.clause}.`],
        verb: verb.turkish,
        verbEnglish: verb.english,
      })
    }
  }
  return out
}

/** Fallback transform: rewrite a positive sentence using the topic form. */
function generatePolarityTransforms(structureId: string): TransformSeed[] {
  if (curatedTransforms(structureId).length || generateConverbTransforms(structureId).length) {
    return []
  }
  const structure = getStructure(structureId)
  if (!structure?.conjugable) return []
  const formLabel = practiceFormLabel(structureId)
  const out: TransformSeed[] = []
  const baseId = structureId.includes("negation")
    ? structureId.replace(/-negation$/, "")
    : structureId.endsWith("-questions")
      ? structureId.replace(/-questions$/, "")
      : "present-continuous"

  for (const verb of GRAMMAR_DRILL_VERBS.slice(0, 8)) {
    const stem = stripInfinitive(verb.turkish)
    const sourceForm = conjugate(baseId === structureId ? "simple-past" : baseId, stem, "1sg")
    const target = conjugate(structureId, stem, "1sg")
    if (!sourceForm || !target || sourceForm === target) continue
    out.push({
      sourceSentences: [`Ben ${sourceForm}.`],
      expected: `Ben ${target}.`,
      accepted: [target, `${target}.`],
      verb: verb.turkish,
      verbEnglish: verb.english,
      instruction: `Rewrite this sentence using the “${formLabel}” form.`,
      english: undefined,
    })
  }
  return out
}

export function buildPracticeExercises(
  structureId: string,
  mode: PracticeModeId,
  count = 10,
): PracticeExercise[] {
  if (mode === "master") {
    const per = 2
    return shuffle([
      ...buildConjugationExercises(structureId, per),
      ...buildContextBlankExercises(structureId, per),
      ...buildErrorCorrectionExercises(structureId, per),
      ...buildTranslationExercises(structureId, per),
      ...buildTransformationExercises(structureId, per),
    ])
  }
  switch (mode) {
    case "conjugation":
      return buildConjugationExercises(structureId, count)
    case "blank":
      return buildContextBlankExercises(structureId, count)
    case "error-correction":
      return buildErrorCorrectionExercises(structureId, count)
    case "translate":
      return buildTranslationExercises(structureId, count)
    case "transform":
      return buildTransformationExercises(structureId, count)
    default:
      return buildContextBlankExercises(structureId, count)
  }
}

export function practiceModeTitle(mode: PracticeModeId): string {
  switch (mode) {
    case "conjugation":
      return "Conjugation"
    case "blank":
      return "Fill in the Blank"
    case "error-correction":
      return "Error Correction"
    case "translate":
      return "Translation"
    case "transform":
      return "Sentence Transformation"
    case "master":
      return "Master test"
    default:
      return "Practice"
  }
}
