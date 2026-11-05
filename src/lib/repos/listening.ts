import { completeJson, describeAiFailure, providerStatus } from "@/lib/ai/provider"
import { listeningPassagePrompt } from "@/lib/ai/prompts"
import { listeningPassageSchema } from "@/lib/ai/schemas"
import { prisma } from "@/lib/prisma"
import { applySkillReview } from "@/lib/repos/skills"
import { getWordsByIds } from "@/lib/repos/words"
import { fallbackListeningScript, isListLikeListening } from "@/lib/speech/script"
import { evaluateAgainst } from "@/lib/eval/match"
import type { CefrLevel, EvalResult, ListeningFormat } from "@/lib/types"

function englishOf(word: { meanings: { english: string; isPrimary: boolean }[] }) {
  return word.meanings.find((item) => item.isPrimary)?.english ?? word.meanings[0]?.english ?? ""
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function serializeListening(row: {
  id: string
  title: string
  topic: string
  cefrLevel: string
  format: string
  durationSec: number
  speed: number
  turkish: string
  english: string
  sentencesJson: string
  questionsJson: string
  dictationJson: string
  vocabJson: string
  usedJson: string
  omittedJson: string
  saved: boolean
  createdAt: Date
}) {
  return {
    id: row.id,
    title: row.title,
    topic: row.topic,
    cefrLevel: row.cefrLevel,
    format: row.format,
    durationSec: row.durationSec,
    speed: row.speed,
    turkish: row.turkish,
    english: row.english,
    sentences: parseJson(row.sentencesJson, []),
    questions: parseJson(row.questionsJson, []),
    dictation: parseJson(row.dictationJson, []),
    vocabPrompts: parseJson(row.vocabJson, []),
    usedWords: parseJson(row.usedJson, []),
    omittedWords: parseJson(row.omittedJson, []),
    saved: row.saved,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function createListeningExercise(options: {
  wordIds: string[]
  topic: string
  cefr: CefrLevel
  format: ListeningFormat
  durationSec: number
  speed: number
}) {
  const words = (await getWordsByIds(options.wordIds)).slice(0, 8)
  if (!words.length) throw new Error("Select vocabulary first")
  const mapped = words.map((word) => ({
    id: word.id,
    turkish: word.turkish,
    english: englishOf(word),
    partOfSpeech: word.partOfSpeech,
  }))
  const profile = await prisma.grammarProfile.findUnique({ where: { id: "default" } })
  const known = JSON.parse(profile?.knownJson ?? "[]") as string[]
  const introduceNew = profile?.introduceNew ?? false

  let script = fallbackListeningScript({
    words: mapped,
    topic: options.topic,
    format: options.format,
    durationSec: options.durationSec,
    cefr: options.cefr,
  })
  if (!providerStatus().configured) {
    console.warn("[kelime] Gemini listening skipped (skip-ai). Using a local narrative.")
  } else {
    try {
      const prompt = listeningPassagePrompt({
        words: mapped.map((word) => ({ turkish: word.turkish, english: word.english })),
        topic: options.topic,
        cefr: options.cefr,
        format: options.format,
        durationSec: options.durationSec,
        knownGrammar: known,
        introduceNew,
      })
      const generated = await completeJson({
        kind: "listening-passage",
        schema: listeningPassageSchema,
        system: prompt.system,
        user: prompt.user,
        cache: false,
      })
      if (isListLikeListening(generated.sentences)) {
        throw new Error(
          `list-like listening script: ${generated.sentences
            .slice(0, 3)
            .map((sentence) => sentence.turkish)
            .join(" | ")}`,
        )
      }
      script = {
        title: generated.title,
        sentences: generated.sentences,
        turkish: generated.sentences
          .map((sentence) => (sentence.speaker ? `${sentence.speaker}: ${sentence.turkish}` : sentence.turkish))
          .join(" "),
        english: generated.sentences
          .map((sentence) => (sentence.speaker ? `${sentence.speaker}: ${sentence.english}` : sentence.english))
          .join(" "),
        questions: generated.questions,
        dictation: generated.dictation,
        vocabPrompts: generated.vocabPrompts,
        usedWords: generated.usedWords,
        omittedWords: generated.omittedWords,
      }
    } catch (error) {
      const reason = describeAiFailure(error)
      console.warn(`[kelime] Gemini listening skipped (${reason}). Using a local narrative.`, error instanceof Error ? error.message : error)
    }
  }

  const spokenTurkish = script.sentences.map((sentence) => sentence.turkish).join(" ")
  const row = await prisma.listeningExercise.create({
    data: {
      title: script.title,
      topic: options.topic,
      cefrLevel: options.cefr,
      format: options.format,
      durationSec: options.durationSec,
      speed: options.speed,
      turkish: spokenTurkish,
      english: script.english,
      sentencesJson: JSON.stringify(script.sentences),
      questionsJson: JSON.stringify(script.questions),
      dictationJson: JSON.stringify(script.dictation),
      vocabJson: JSON.stringify(script.vocabPrompts),
      usedJson: JSON.stringify(script.usedWords),
      omittedJson: JSON.stringify(script.omittedWords),
      words: {
        create: words.map((word) => ({
          wordId: word.id,
          used: script.usedWords.some((item) => item === word.turkish),
        })),
      },
    },
  })
  return serializeListening(row)
}

export async function listListeningExercises() {
  const rows = await prisma.listeningExercise.findMany({
    where: { saved: true },
    orderBy: { createdAt: "desc" },
    take: 40,
  })
  return rows.map(serializeListening)
}

export async function getListeningExercise(id: string) {
  const row = await prisma.listeningExercise.findUnique({ where: { id } })
  if (!row) throw new Error("Exercise not found")
  return serializeListening(row)
}

export async function saveListeningExercise(id: string, saved: boolean) {
  const row = await prisma.listeningExercise.update({ where: { id }, data: { saved } })
  return serializeListening(row)
}

export async function gradeListening(options: {
  exerciseId: string
  kind: "comprehension" | "dictation" | "vocab"
  prompt: string
  given: string
  expected: string
  extra?: string[]
}) {
  const lang = options.kind === "dictation" || options.kind === "vocab" ? "tr" : "en"
  const accepted = [options.expected, ...(options.extra ?? [])]
  const { result } = evaluateAgainst(options.given, accepted, lang)
  await prisma.listeningAttempt.create({
    data: {
      exerciseId: options.exerciseId,
      kind: options.kind,
      prompt: options.prompt,
      given: options.given,
      expected: options.expected,
      result,
    },
  })

  const exercise = await prisma.listeningExercise.findUnique({
    where: { id: options.exerciseId },
    include: { words: true },
  })
  const needle = options.expected
  if (exercise) {
    const words = await getWordsByIds(exercise.words.map((item) => item.wordId))
    const match = words.find(
      (item) =>
        item.turkish === needle ||
        item.meanings.some((meaning) => meaning.english.toLowerCase() === needle.toLowerCase()),
    )
    if (match) {
      await applySkillReview({
        wordId: match.id,
        skill: "listening",
        result: result as EvalResult,
        source: `listening-${options.kind}`,
      })
    }
  }

  return { result }
}
