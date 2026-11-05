import { completeJson } from "@/lib/ai/provider"
import { choiceSchema, clozeSchema, evaluationSchema, listeningSchema, sentencePromptSchema } from "@/lib/ai/schemas"
import {
  clozePrompt,
  distractorsPrompt,
  evaluationPrompt,
  listeningPrompt,
  sentenceTranslationPrompt,
} from "@/lib/ai/prompts"
import { fail, ok, readBody } from "@/lib/api"
import { evaluateAgainst, isPassing } from "@/lib/eval/match"
import { ensureWordExamples } from "@/lib/generate/examples"
import { prisma, ensureDb } from "@/lib/prisma"
import { getProfileCefr } from "@/lib/profile"
import { applyReview } from "@/lib/repos/reviews"
import { applySkillReview } from "@/lib/repos/skills"
import { getWordsByIds } from "@/lib/repos/words"
import type { EvalResult, SrsRating, TestMode } from "@/lib/types"

export const maxDuration = 60

type TestItem = {
  wordId: string
  mode: TestMode
  prompt: string
  expected: string
  extra?: string[]
  contextTurkish?: string
  contextEnglish?: string
}

function englishOf(word: { meanings: { english: string; isPrimary: boolean }[] }) {
  return word.meanings.find((item) => item.isPrimary)?.english ?? word.meanings[0]?.english ?? ""
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function withContext(
  item: TestItem,
  example: { turkish: string; english: string } | undefined,
): TestItem {
  if (!example || item.mode === "cloze" || item.mode === "sentence") return item
  return { ...item, contextTurkish: example.turkish, contextEnglish: example.english }
}

async function buildItem(
  mode: TestMode,
  word: Awaited<ReturnType<typeof getWordsByIds>>[number],
  allEnglish: string[],
  cefr: string,
  example?: { turkish: string; english: string },
): Promise<TestItem> {
  const english = englishOf(word)
  const mapped = { turkish: word.turkish, english }

  if (mode === "tr-en") {
    return { wordId: word.id, mode, prompt: word.turkish, expected: english, extra: word.meanings.map((m) => m.english) }
  }
  if (mode === "en-tr") {
    return { wordId: word.id, mode, prompt: english, expected: word.turkish, extra: [word.dictionaryForm ?? word.turkish] }
  }
  if (mode === "multiple-choice") {
    try {
      const prompt = distractorsPrompt(mapped, cefr as never)
      const result = await completeJson({ kind: "choices", schema: choiceSchema, system: prompt.system, user: prompt.user })
      return { wordId: word.id, mode, prompt: word.turkish, expected: result.choices[result.correctIndex], extra: result.choices }
    } catch {
      const pool = allEnglish.filter((item) => item && item !== english)
      const distractors = shuffle(pool).slice(0, 3)
      while (distractors.length < 3) distractors.push(`not ${english}`)
      const choices = shuffle([english, ...distractors.slice(0, 3)])
      return { wordId: word.id, mode, prompt: word.turkish, expected: english, extra: choices }
    }
  }
  if (mode === "cloze") {
    const clozeSource = word.examples[0] ?? (example ? { ...example, highlight: word.turkish } : null)
    if (clozeSource) {
      const form = clozeSource.highlight || word.turkish
      return {
        wordId: word.id,
        mode,
        prompt: clozeSource.turkish.replace(form, "______"),
        expected: form,
        extra: [clozeSource.english, word.turkish],
      }
    }
    try {
      const prompt = clozePrompt(mapped, cefr as never)
      const result = await completeJson({ kind: "cloze", schema: clozeSchema, system: prompt.system, user: prompt.user })
      return { wordId: word.id, mode, prompt: result.sentence, expected: result.answer, extra: result.accepted ?? [word.turkish] }
    } catch {
      return { wordId: word.id, mode, prompt: `______ (${english})`, expected: word.turkish, extra: [word.turkish] }
    }
  }
  if (mode === "sentence") {
    try {
      const prompt = sentenceTranslationPrompt(mapped, cefr as never)
      const result = await completeJson({ kind: "sentence-prompt", schema: sentencePromptSchema, system: prompt.system, user: prompt.user })
      return { wordId: word.id, mode, prompt: result.english, expected: result.acceptedTurkish[0], extra: result.acceptedTurkish }
    } catch {
      return { wordId: word.id, mode, prompt: `Translate: ${english}`, expected: word.turkish, extra: [word.turkish] }
    }
  }
  try {
    const prompt = listeningPrompt(mapped, cefr as never)
    const result = await completeJson({ kind: "listening", schema: listeningSchema, system: prompt.system, user: prompt.user })
    return { wordId: word.id, mode, prompt: result.sentence, expected: word.turkish, extra: [result.english, word.turkish] }
  } catch {
    const sentence = word.examples[0]?.turkish ?? word.turkish
    return { wordId: word.id, mode, prompt: sentence, expected: word.turkish, extra: [english] }
  }
}

export async function POST(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{
      mode: TestMode
      wordIds: string[]
      given?: string
      sessionId?: string
      wordId?: string
      prompt?: string
      expected?: string
      extra?: string[]
      override?: EvalResult
      rating?: SrsRating
    }>(request)

    if (body.sessionId && body.wordId && (body.given !== undefined || body.override)) {
      const lang = body.mode === "en-tr" || body.mode === "cloze" || body.mode === "listening" || body.mode === "sentence" ? "tr" : "en"
      const accepted = [body.expected ?? "", ...(body.extra ?? [])].filter(Boolean)
      let result: EvalResult = body.override ?? evaluateAgainst(body.given ?? "", accepted, lang).result
      let explanation: string | null = null

      if (!body.override && (result === "incorrect" || result === "partial") && (body.mode === "sentence" || body.mode === "listening")) {
        try {
          const prompt = evaluationPrompt({
            mode: body.mode,
            prompt: body.prompt ?? "",
            expected: accepted.join("; "),
            given: body.given ?? "",
          })
          const ai = await completeJson({
            kind: "evaluate",
            schema: evaluationSchema,
            system: prompt.system,
            user: prompt.user,
            cache: false,
          })
          result = ai.result
          explanation = ai.explanation
        } catch {
          explanation = result === "partial" ? "Close — check grammar or missing words." : "Not quite. Compare with the expected form."
        }
      } else if (result === "spelling") {
        explanation = "Meaning is right; watch the spelling or Turkish letters."
      } else if (result === "partial") {
        explanation = "Close — you have part of it."
      }

      const answer = await prisma.testAnswer.create({
        data: {
          sessionId: body.sessionId,
          wordId: body.wordId,
          prompt: body.prompt ?? "",
          expected: body.expected ?? "",
          given: body.given ?? "",
          result,
          overridden: Boolean(body.override),
          explanation,
        },
      })

      const rating: SrsRating = body.rating ?? (result === "correct" ? "good" : result === "spelling" ? "hard" : "again")
      const skill = body.mode === "listening" ? "listening" : body.mode === "en-tr" || body.mode === "cloze" || body.mode === "sentence" ? "writing" : "reading"
      const face =
        body.mode === "en-tr" || body.mode === "cloze" || body.mode === "sentence"
          ? ("production" as const)
          : body.mode === "tr-en" || body.mode === "multiple-choice" || body.mode === "listening"
            ? ("recognition" as const)
            : undefined
      const appliedRating = isPassing(result) ? rating : "again"
      await applySkillReview({ wordId: body.wordId, skill, result, source: "test", rating: appliedRating })
      if (skill === "listening") {
        if (face) {
          await applySkillReview({ wordId: body.wordId, skill: face, result, source: "test", rating: appliedRating })
        }
      } else {
        // applyReview advances the primary SrsCard and records the vocab face once
        await applyReview(body.wordId, appliedRating, "test", 0, { face })
      }
      return ok({ answer, result, explanation })
    }

    const words = await getWordsByIds(body.wordIds ?? [])
    if (!words.length) return fail(new Error("Select vocabulary first"))
    const cefr = await getProfileCefr()
    const allEnglish = (await prisma.meaning.findMany({ take: 80 })).map((item) => item.english)
    const examples = await ensureWordExamples(words, cefr)
    const items = []
    for (const word of words) {
      const example = examples.get(word.id)
      items.push(withContext(await buildItem(body.mode, word, allEnglish, cefr, example), example))
    }
    const session = await prisma.testSession.create({
      data: {
        mode: body.mode,
        wordIdsJson: JSON.stringify(body.wordIds),
      },
    })
    return ok({ sessionId: session.id, items })
  } catch (error) {
    return fail(error)
  }
}
