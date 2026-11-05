import { completeJson, describeAiFailure } from "@/lib/ai/provider"
import {
  choiceSchema,
  clozeSchema,
  evaluationSchema,
  listeningSchema,
  sentencePromptSchema,
  selectionTranslationSchema,
  sentenceSchema,
  storySchema,
  translationBatchSchema,
  wordFormsSchema,
} from "@/lib/ai/schemas"
import {
  clozePrompt,
  distractorsPrompt,
  evaluationPrompt,
  formsPrompt,
  listeningPrompt,
  selectionTranslationPrompt,
  sentenceTranslationPrompt,
  sentencesPrompt,
  storyPrompt,
  translationPrompt,
} from "@/lib/ai/prompts"
import { fail, ok, readBody, RequestError } from "@/lib/api"
import { deriveStoryTopic, fallbackCombinedSentence, fallbackStory } from "@/lib/generate/fallback"
import { ensureWordExamples } from "@/lib/generate/examples"
import { isStoryDump } from "@/lib/speech/script"
import { prisma, ensureDb } from "@/lib/prisma"
import { resolveRequestCefr } from "@/lib/profile"
import { getWordsByIds } from "@/lib/repos/words"
import { containsWord, heuristicNounForms, heuristicVerbForms, normalizeTurkish } from "@/lib/turkish"
import type { CefrLevel } from "@/lib/types"

export const maxDuration = 60

function englishOf(word: { meanings: { english: string; isPrimary: boolean }[] }) {
  return word.meanings.find((item) => item.isPrimary)?.english ?? word.meanings[0]?.english ?? ""
}

async function grammarContext() {
  const profile = await prisma.grammarProfile.findUnique({ where: { id: "default" } })
  return {
    known: JSON.parse(profile?.knownJson ?? "[]") as string[],
    introduceNew: profile?.introduceNew ?? false,
  }
}

export async function POST(request: Request) {
  try {
    await ensureDb()
    const body = await readBody<{
      action: string
      wordIds?: string[]
      cefr?: CefrLevel
      topic?: string
      length?: number
      seed?: number
      avoidTitle?: string
      mode?: string
      prompt?: string
      expected?: string
      given?: string
      extra?: string
      text?: string
      turkish?: string
      english?: string
      title?: string
      usedWords?: { turkish: string; form: string }[] | string[]
      omittedWords?: string[]
      sentences?: { turkish: string; english: string }[]
      questions?: { question: string; answer: string }[]
      grammarNotes?: { structure?: string; explanation?: string }[]
      refresh?: boolean
    }>(request)

    const words = body.wordIds?.length ? await getWordsByIds(body.wordIds) : []
    const mapped = words.map((word) => ({
      turkish: word.turkish,
      english: englishOf(word),
      partOfSpeech: word.partOfSpeech,
    }))
    const cefr = await resolveRequestCefr(body.cefr)
    const grammar = await grammarContext()

    if (body.action === "translate-selection") {
      const text = (body.text ?? body.turkish ?? "").replace(/\s+/g, " ").trim()
      if (!text) throw new RequestError("Select some Turkish text first")
      const existing = await prisma.word.findUnique({
        where: { turkishNormalized: normalizeTurkish(text) },
        include: { meanings: true },
      })
      const known = existing ? englishOf(existing) : ""
      if (existing && known) {
        return ok({
          turkish: existing.turkish,
          english: known,
          dictionaryForm: existing.dictionaryForm || existing.turkish,
          partOfSpeech: existing.partOfSpeech ?? undefined,
          note: undefined,
          fromLibrary: true,
        })
      }
      const prompt = selectionTranslationPrompt(text)
      const result = await completeJson({
        kind: "translate-selection",
        schema: selectionTranslationSchema,
        system: prompt.system,
        user: prompt.user,
      })
      return ok({ ...result, turkish: result.turkish || text, fromLibrary: false })
    }

    if (body.action === "translate") {
      const prompt = translationPrompt(mapped.map((item) => item.turkish))
      const result = await completeJson({
        kind: "translate",
        schema: translationBatchSchema,
        system: prompt.system,
        user: prompt.user,
      })
      for (const item of result.items) {
        const word = words.find((entry) => entry.turkish === item.turkish)
        if (!word || word.userEdited) continue
        await prisma.word.update({
          where: { id: word.id },
          data: {
            partOfSpeech: item.partOfSpeech ?? word.partOfSpeech,
            dictionaryForm: item.dictionaryForm ?? word.dictionaryForm,
            cefrLevel: item.cefrLevel ?? word.cefrLevel,
          },
        })
        if (!word.meanings.length && item.meanings[0]) {
          await prisma.meaning.createMany({
            data: item.meanings.map((english, index) => ({
              wordId: word.id,
              english,
              isPrimary: index === 0,
            })),
          })
        }
      }
      return ok(result)
    }

    if (body.action === "sentences") {
      if (!mapped.length) throw new RequestError("Select vocabulary first")
      try {
        const prompt = sentencesPrompt({
          words: mapped,
          cefr,
          knownGrammar: grammar.known,
          introduceNew: grammar.introduceNew,
        })
        const result = await completeJson({
          kind: "combined-sentence",
          schema: sentenceSchema,
          system: prompt.system,
          user: prompt.user,
          cache: false,
        })
        return ok({ ...result, draft: false })
      } catch (error) {
        console.warn("[kelime] Gemini sentence failed; using a local scene.", error instanceof Error ? error.message : error)
        return ok(fallbackCombinedSentence(mapped))
      }
    }

    if (body.action === "save-sentence") {
      if (!mapped.length) throw new RequestError("Select vocabulary first")
      const turkish = body.turkish?.trim()
      const english = body.english?.trim()
      if (!turkish || !english) throw new RequestError("Nothing to save")
      const usedWords = (Array.isArray(body.usedWords) ? body.usedWords : [])
        .map((item) => (typeof item === "string" ? { turkish: item, form: item } : item))
        .filter((item) => item?.turkish)
      for (const word of words) {
        const used = usedWords.find((item) => containsWord(item.turkish, word.turkish) || containsWord(word.turkish, item.turkish))
        const appears = used || containsWord(turkish, word.turkish)
        if (!appears) continue
        await prisma.exampleSentence.create({
          data: {
            wordId: word.id,
            turkish,
            english,
            cefrLevel: cefr,
            highlight: used?.form ?? word.turkish,
            favorite: true,
            source: "ai",
          },
        })
      }
      return ok({ saved: true })
    }

    if (body.action === "story") {
      if (!mapped.length) throw new RequestError("Select vocabulary first")
      const storyWords = mapped.slice(0, 8)
      const topic = body.topic?.trim() || deriveStoryTopic(storyWords, cefr)
      const seed = typeof body.seed === "number" && Number.isFinite(body.seed) ? Math.abs(Math.floor(body.seed)) : Date.now() % 1_000_000
      const avoidTitle = body.avoidTitle?.trim()
      const prompt = storyPrompt({
        words: storyWords,
        topic,
        cefr,
        length: body.length ?? 120,
        knownGrammar: grammar.known,
        introduceNew: grammar.introduceNew,
        seed,
        avoidTitle,
      })
      let lastError: unknown
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const user =
            attempt === 0
              ? prompt.user
              : `${prompt.user}\n\nREJECTED previous draft: it was a vocab dump or jumped topics. Rewrite ONE scene for topic "${topic}". Setting → action → reaction → continue. 5–8 sentences that cause the next. Omit words that do not belong (never write a letter unless the topic is writing).`
          const result = await completeJson({
            kind: "story",
            schema: storySchema,
            system: prompt.system,
            user,
            cache: false,
          })
          if (isStoryDump(result.sentences, `${result.title} ${topic}`)) {
            throw new Error(
              `list-like story dump: ${result.sentences
                .slice(0, 3)
                .map((sentence) => sentence.turkish)
                .join(" | ")}`,
            )
          }
          const used: string[] = []
          const omitted: string[] = []
          for (const word of words) {
            if (containsWord(result.turkish, word.turkish)) used.push(word.turkish)
            else omitted.push(word.turkish)
          }
          return ok({
            title: result.title,
            topic,
            turkish: result.turkish,
            english: result.english,
            sentences: result.sentences,
            questions: result.questions,
            usedWords: used,
            omittedWords: omitted,
            grammarNotes: result.grammarNotes ?? [],
            draft: false,
          })
        } catch (error) {
          lastError = error
          const reason = describeAiFailure(error)
          if (attempt === 0 && reason !== "quota" && reason !== "skip-ai") continue
          console.warn(`[kelime] Gemini story skipped (${reason}). Using a local narrative.`, error instanceof Error ? error.message : error)
          return ok(fallbackStory(storyWords, topic, cefr, { seed, avoidTitle }))
        }
      }
      console.warn(`[kelime] Gemini story skipped (${describeAiFailure(lastError)}). Using a local narrative.`)
      return ok(fallbackStory(storyWords, topic, cefr, { seed, avoidTitle }))
    }

    if (body.action === "save-story") {
      if (!mapped.length) throw new RequestError("Select vocabulary first")
      const turkish = body.turkish?.trim()
      const english = body.english?.trim()
      if (!turkish || !english) throw new RequestError("Nothing to save")
      const used: string[] = []
      const omitted: string[] = []
      for (const word of words) {
        if (containsWord(turkish, word.turkish)) used.push(word.turkish)
        else omitted.push(word.turkish)
      }
      const story = await prisma.story.create({
        data: {
          title: body.title?.trim() || "Story",
          topic: body.topic,
          cefrLevel: cefr,
          lengthTarget: body.length ?? 120,
          turkish,
          english,
          sentencesJson: JSON.stringify(body.sentences ?? [{ turkish, english }]),
          questionsJson: JSON.stringify(body.questions ?? []),
          usedJson: JSON.stringify(used),
          omittedJson: JSON.stringify(omitted),
          grammarJson: JSON.stringify(body.grammarNotes ?? []),
          words: {
            create: words.map((word) => ({
              wordId: word.id,
              used: used.includes(word.turkish),
            })),
          },
        },
      })
      return ok({
        ...story,
        sentences: body.sentences ?? [{ turkish, english }],
        questions: body.questions ?? [],
        usedWords: used,
        omittedWords: omitted,
        grammarNotes: body.grammarNotes ?? [],
      })
    }

    if (body.action === "cloze" && words[0]) {
      const prompt = clozePrompt(mapped[0], cefr)
      return ok(
        await completeJson({
          kind: "cloze",
          schema: clozeSchema,
          system: prompt.system,
          user: prompt.user,
        }),
      )
    }

    if (body.action === "choices" && words[0]) {
      const prompt = distractorsPrompt(mapped[0], cefr)
      return ok(
        await completeJson({
          kind: "choices",
          schema: choiceSchema,
          system: prompt.system,
          user: prompt.user,
        }),
      )
    }

    if (body.action === "sentence-prompt" && words[0]) {
      const prompt = sentenceTranslationPrompt(mapped[0], cefr)
      return ok(
        await completeJson({
          kind: "sentence-prompt",
          schema: sentencePromptSchema,
          system: prompt.system,
          user: prompt.user,
        }),
      )
    }

    if (body.action === "listening" && words[0]) {
      const prompt = listeningPrompt(mapped[0], cefr)
      return ok(
        await completeJson({
          kind: "listening",
          schema: listeningSchema,
          system: prompt.system,
          user: prompt.user,
        }),
      )
    }

    if (body.action === "evaluate") {
      const prompt = evaluationPrompt({
        mode: body.mode ?? "tr-en",
        prompt: body.prompt ?? "",
        expected: body.expected ?? "",
        given: body.given ?? "",
        extra: body.extra,
      })
      return ok(
        await completeJson({
          kind: "evaluate",
          schema: evaluationSchema,
          system: prompt.system,
          user: prompt.user,
          cache: false,
        }),
      )
    }

    if (body.action === "word-examples") {
      if (!words.length) throw new RequestError("Select a word first")
      const refresh = Boolean(body.refresh)
      const examples = await ensureWordExamples(words, cefr, { refresh })
      const items = words.map((word) => {
        const example = examples.get(word.id)
        return {
          wordId: word.id,
          id: example?.id ?? "",
          turkish: example?.turkish ?? "",
          english: example?.english ?? "",
          highlight: example?.highlight ?? null,
          reused: example?.reused ?? false,
        }
      })
      return ok({ items, cefr })
    }

    if (body.action === "forms" && words[0]) {
      const word = words[0]
      const heuristic =
        word.partOfSpeech === "verb" || word.turkish.endsWith("mek") || word.turkish.endsWith("mak")
          ? heuristicVerbForms(word.dictionaryForm || word.turkish)
          : heuristicNounForms(word.turkish)
      try {
        const prompt = formsPrompt(mapped[0])
        const result = await completeJson({
          kind: "forms",
          schema: wordFormsSchema,
          system: prompt.system,
          user: prompt.user,
        })
        await prisma.wordForm.deleteMany({ where: { wordId: word.id } })
        await prisma.wordForm.createMany({
          data: result.forms.map((form) => ({
            wordId: word.id,
            form: form.form,
            label: form.label,
            verified: !result.needsVerification,
            source: "ai",
          })),
        })
        return ok(result)
      } catch {
        await prisma.wordForm.deleteMany({ where: { wordId: word.id } })
        await prisma.wordForm.createMany({
          data: heuristic.map((form) => ({
            wordId: word.id,
            form: form.form,
            label: form.label,
            verified: false,
            source: "heuristic",
          })),
        })
        return ok({
          dictionaryForm: word.dictionaryForm || word.turkish,
          partOfSpeech: word.partOfSpeech ?? "other",
          forms: heuristic,
          needsVerification: true,
        })
      }
    }

    return fail(new Error("Unknown AI action"))
  } catch (error) {
    return fail(error)
  }
}
