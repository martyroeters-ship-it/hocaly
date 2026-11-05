import { grammarPromptBlock } from "@/lib/grammar"
import type { CefrLevel } from "@/lib/types"

const CEFR_GUIDE: Record<CefrLevel, string> = {
  A1: "Very simple sentences. Present tense. Everyday objects and greetings. 5–10 words per sentence.",
  A2: "Simple connected sentences. Present, past, and future. Daily life. Avoid relative clauses.",
  B1: "Natural paragraph-level Turkish. Common conjunctions. Concrete topics.",
  B2: "Fluent narrative. Mix tenses where natural. Some idioms are fine.",
  C1: "Nuanced, idiomatic Turkish. Complex sentences are welcome.",
  C2: "Native-like style, including literary or specialised phrasing when the topic needs it.",
}

export function highlightExtractionPrompt() {
  return {
    system: `You extract only the LEARNER-MARKED Turkish vocabulary from a photo.
Return JSON only: { "note"?: string, "words": [...] }.

These pages are often a full word list on peach/cream paper. The learner (or the book design) marks a SUBSET with:
- a pink, salmon, orange, yellow, or green rounded PILL / CHIP / capsule behind the word
- highlighter ink, marker wash, underline, circle, or a box

That pill is the highlight. Example: on a peach page, "akıllı" sitting in a pink capsule is selected; "apartman" in plain black on the bare page is not.

Extract every pill/chip/highlighted item, including short phrases (ana yemek, güler yüzlü). There may be dozens.

Do NOT extract:
- the rest of the list
- headings (KELİME LİSTESİ, İSİMLER, FİİLLER, KALIP İFADELER)
- page numbers, book titles
- plain unmarked words on the page background
- words you cannot read

If nothing is marked, return { "words": [], "note": "No highlighted words found." }.
Preserve Turkish spelling (ç ğ ı ö ş ü).
For verbs, dictionaryForm is the infinitive (-mek/-mak); turkish is the surface form.
Give the most common English meaning. partOfSpeech: noun, verb, adjective, adverb, expression, or other.
Never invent words.`,
    user: "Look at each word. Keep it only if it sits on a colored pill/chip or other highlight. Skip plain unmarked words, even if they are on the same vocabulary list.",
  }
}

export function selectionTranslationPrompt(text: string) {
  return {
    system: `You translate a short Turkish selection for an English-speaking learner.
The selection may be a word, an inflected form, or a short phrase (bu yoldan, eve, gidiyorum).
Give a natural English gloss, not a word-by-word dump.
If grammar matters (case ending, tense, person), put one short note in "note".
dictionaryForm is the dictionary headword (yol, ev, gitmek). For a multi-word phrase, keep the phrase.
partOfSpeech must be noun, verb, adjective, adverb, expression, or other.
Return JSON only: turkish, english, dictionaryForm, partOfSpeech, note.`,
    user: JSON.stringify({ selected: text }),
  }
}

export function translationPrompt(words: string[]) {
  return {
    system:
      "You are a Turkish-English lexicographer for language learners. Return JSON only. Never invent unrelated meanings. Preserve the original Turkish spelling. For verbs, use the dictionary infinitive (-mek/-mak) as dictionaryForm. Give the most common English sense first. partOfSpeech must be noun, verb, adjective, adverb, expression, or other.",
    user: JSON.stringify({
      task: "Translate and classify these Turkish headwords.",
      words,
    }),
  }
}

export function sentencesPrompt(options: {
  words: { turkish: string; english: string; partOfSpeech?: string | null }[]
  cefr: CefrLevel
  knownGrammar: string[]
  introduceNew: boolean
}) {
  const many = options.words.length > 1
  return {
    system: `You write natural spoken-style Turkish for English-speaking learners. ${CEFR_GUIDE[options.cefr]}
${grammarPromptBlock(options.knownGrammar, options.introduceNew)}
${
  many
    ? `Write ONE natural everyday Turkish sentence a learner would actually study. Use ALL target words in a single real situation (home, cafe, city, class). Inflect them (İstanbul'da, kitabı, gidiyorum). Never list the words, never join them with commas, and never write "kullanıyorum" / "I am using". If there are more than eight words, you may use two short sentences in one turkish string. If a word cannot fit naturally, put it in omittedWords instead of forcing it.`
    : `Write ONE natural Turkish sentence that uses the target word in a real everyday situation, inflected as needed. Never define the word. Never write "kullanıyorum".`
}
Return JSON only: turkish, english, usedWords (turkish headword + the exact form used), omittedWords.`,
    user: JSON.stringify({
      cefr: options.cefr,
      words: options.words,
    }),
  }
}

const STORY_NARRATIVE_RULES = `Write ONE real story: one place, one situation, sentences that cause the next.
The TOPIC is the scene (tennis with friends, a morning at home, a cafe — whatever the topic says). Stay on that scene from start to finish.
Narrative arc: setting → action → reaction → continue. Prefer 5–8 connected sentences. Link them with natural spoken glue (sonra, -ip, ve, bu yüzden) so the reader can follow the action.
Selected vocabulary is optional seasoning. Use a word only if it belongs in THIS scene with a real spoken inflection (kortta, topu, koşuyorum). Using 0–3 words is better than forcing a mismatch. Put every unused headword in omittedWords.
NEVER jump topics. If the scene is tennis, do not write a letter (harf/mektup), cook, shop, or define a word. Omit harf rather than write "Ben bir harf yazıyorum."
Do not default to an Istanbul morning walk, simit, tea, tennis, or “everyday life in Istanbul” unless the given topic clearly asks for them.
Each sentence must follow from the last. Never list words, never write "X önemli", "X aklıma geliyor", one isolated word per sentence, or dictionary glosses.
English must be a natural translation of that Turkish scene, not a gloss list ("to adorn", "competition, contest", "I am writing a letter" in a tennis match).
Vary the opening and title so two stories with the same words are not twins.
Good: "Arkadaşımla tenis kortundayız. Hava güzel. Oyun başlıyor; o servis atıyor. Top bana geliyor. Koşup raketi uzatıyorum. Topu geri gönderiyorum."
Bad: "Hava çok güzel. Arkadaşım inatçı bir oyuncu. Ben bir harf yazıyorum. Oyun başlıyor. Top geliyor. Ben koşuyorum."`

const LISTENING_NARRATIVE_RULES = `Write ONE scene: one protagonist, one place, one continuous moment (the given topic).
If the topic is a morning in Istanbul, stay on that walk from start to finish (step outside → street → tea or simit → mosque, ferry, or school only as scenery you pass → continue).
Each sentence must cause the next. Do not switch topics or jump to a new unrelated noun.
Vocabulary is optional seasoning. Use at most 6 target words, and only when they fit this scene with real spoken inflections (İstanbul'da, yürüyorum, çay içiyorum).
Using 0–3 words is better than forcing a mismatch. Put every unused headword in omittedWords.
NEVER force mismatched words (cömert/generous, süslemek/decorate, yarışma/contest, alışkanlık/habit, akıllı/aptal) into an Istanbul walk.
NEVER write "X önemli", "X aklıma geliyor", "X comes to mind", "X is part of my story", one isolated word per sentence, or join target words with commas.
English must be a natural translation of that Turkish sentence, not a dictionary gloss ("to adorn", "competition, contest").`

export function storyPrompt(options: {
  words: { turkish: string; english: string }[]
  topic: string
  cefr: CefrLevel
  length: number
  knownGrammar: string[]
  introduceNew: boolean
  seed?: number
  avoidTitle?: string
}) {
  const vocabulary = options.words.slice(0, 8)
  return {
    system: `You write ONE short connected Turkish story for learners. ${CEFR_GUIDE[options.cefr]}
${grammarPromptBlock(options.knownGrammar, options.introduceNew)}
${STORY_NARRATIVE_RULES}
Split the story into sentences with English translations.
Also provide a full English translation, 3–5 comprehension questions, and optional grammar notes.
Return JSON only with this shape:
{"title":"...","turkish":"...","english":"...","sentences":[{"turkish":"...","english":"..."}],"usedWords":[],"omittedWords":[],"questions":[{"question":"...","answer":"..."}],"grammarNotes":[]}
sentences must have at least 5 objects, each with both turkish and english.`,
    user: JSON.stringify({
      topic: options.topic,
      cefr: options.cefr,
      targetLength: options.length,
      vocabulary,
      seed: options.seed,
      avoidTitle: options.avoidTitle || undefined,
      instruction:
        "The topic is the scene. Vocabulary is seasoning — include a headword only if it fits without changing the topic, otherwise omittedWords. 5–8 connected sentences (setting → action → reaction → continue). Honest usedWords/omittedWords. Do not reuse avoidTitle. Change the opening using seed.",
    }),
  }
}

export function wordExamplesPrompt(
  words: { turkish: string; english: string; partOfSpeech?: string | null }[],
  cefr: CefrLevel,
) {
  return {
    system: `You write one short natural Turkish example sentence per headword for English-speaking learners. ${CEFR_GUIDE[cefr]}
Each sentence must be something a native speaker would actually say, using that word in a real everyday situation, inflected if needed (avuç → avucuma, gitmek → gidiyorum).
Use a typical partner for the word. Do not bolt on a loosely related theme with the wrong grammar (bağımlılık is an addiction to a substance/habit, not "to health"; sağlığa goes with zarar vermek, not bağımlılık yapmak).
english must be a natural translation of THAT Turkish sentence — the same meaning, as a textbook would print it. If the English sounds like a calque or does not make sense, the Turkish is wrong: rewrite both.
Never define the word. Never write "kullanıyorum". Never join the words into one list-like sentence.
Bad: "Sigara sağlığa büyük bir bağımlılık yapar." / "Smoking creates a major addiction to health."
Good: "Sigara ciddi bir bağımlılık yapar." / "Smoking causes a serious addiction."
Return JSON only: { "examples": [ { "word": "<headword>", "turkish": "<sentence>", "english": "<translation>" } ] }.
Give exactly one object per input word, in the same order.`,
    user: JSON.stringify({ cefr, words }),
  }
}

export function clozePrompt(word: { turkish: string; english: string }, cefr: CefrLevel) {
  return {
    system:
      "Create one natural Turkish gap-fill sentence. Replace the target word (in a natural inflected form if needed) with ______. Return JSON with sentence, english, answer, and accepted alternate inflections.",
    user: JSON.stringify({ word, cefr }),
  }
}

export function distractorsPrompt(word: { turkish: string; english: string }, cefr: CefrLevel) {
  return {
    system:
      "Create four English multiple-choice options for a Turkish headword. One is correct. Three are plausible distractors (related meanings, false friends, or similar-looking words). Return JSON with choices (length 4) and correctIndex.",
    user: JSON.stringify({ word, cefr }),
  }
}

export function sentenceTranslationPrompt(word: { turkish: string; english: string }, cefr: CefrLevel) {
  return {
    system:
      "Create one short English sentence that a learner should translate into Turkish, using the target word. Return JSON with english and acceptedTurkish (2–4 natural Turkish renderings).",
    user: JSON.stringify({ word, cefr }),
  }
}

export function listeningPrompt(word: { turkish: string; english: string }, cefr: CefrLevel) {
  return {
    system:
      "Create one short spoken-style Turkish sentence that clearly uses the target word. Return JSON with sentence and english.",
    user: JSON.stringify({ word, cefr }),
  }
}

export function evaluationPrompt(options: {
  mode: string
  prompt: string
  expected: string
  given: string
  extra?: string
}) {
  return {
    system:
      "You evaluate a Turkish learner's answer. Be generous with valid alternative translations. Distinguish correct, spelling (diacritics or minor typos), partial, and incorrect. Return JSON with result, explanation, and optional suggestedCorrection.",
    user: JSON.stringify(options),
  }
}

export function formsPrompt(word: { turkish: string; english?: string; partOfSpeech?: string | null }) {
  return {
    system:
      "Analyse a Turkish headword. Return dictionaryForm, partOfSpeech, common learner-relevant inflected forms, and needsVerification=true if morphology is uncertain. Return JSON only.",
    user: JSON.stringify(word),
  }
}

export function listeningPassagePrompt(options: {
  words: { turkish: string; english: string }[]
  topic: string
  cefr: CefrLevel
  format: "monologue" | "conversation"
  durationSec: number
  knownGrammar: string[]
  introduceNew: boolean
}) {
  const words = Math.max(40, Math.round(options.durationSec * 2.2))
  const vocabulary = options.words.slice(0, 8)
  return {
    system: `You write ONE short connected spoken Turkish story for listening practice. ${CEFR_GUIDE[options.cefr]}
${grammarPromptBlock(options.knownGrammar, options.introduceNew)}
Format: ${options.format}. Aim for about ${words} spoken words (${options.durationSec} seconds).
${LISTENING_NARRATIVE_RULES}
Spoken style, not a textbook. If conversation, Ada and Deniz walk through the SAME scene with short turns (speaker field Ada or Deniz).
Good: "Bu sabah İstanbul'da yürüyorum. Fırından simit alıyorum. Karşıdaki camiye bakıp yola devam ediyorum."
Bad: "Bugün kendimi biraz cömert hissediyorum. Yarışma da aklıma geliyor. Alışkanlık bu sabah hikayemin bir parçası."
Return JSON only with this shape:
{"title":"...","sentences":[{"turkish":"...","english":"..."}],"usedWords":[],"omittedWords":[],"questions":[{"question":"...","answer":"...","choices":["...","..."]}],"dictation":[{"turkish":"...","english":"..."}],"vocabPrompts":[{"question":"...","answer":"...","choices":["...","..."]}]}
sentences must have at least 5 objects, each with both turkish and english.`,
    user: JSON.stringify({
      topic: options.topic,
      cefr: options.cefr,
      format: options.format,
      durationSec: options.durationSec,
      vocabulary,
      instruction: "Use at most 6 vocabulary items, only if they fit this scene. Omit the rest honestly.",
    }),
  }
}

export function speakingEvalPrompt(options: {
  mode: "listen-repeat" | "translate-speak"
  english?: string
  expected: string
  transcript: string
  targetWords: string[]
}) {
  return {
    system: `You evaluate a Turkish learner's spoken answer from an automatic transcript.
Do not judge pronunciation, accent, or sounds — only the words that were recognized.
Accept grammatically correct alternative translations.
Be concise. Return JSON with result (correct|spelling|partial|incorrect), explanation, vocabulary issues, grammar issues, and optional naturalness note.`,
    user: JSON.stringify(options),
  }
}

export function conversationTurnPrompt(options: {
  topic: string
  cefr: CefrLevel
  targetWords: { turkish: string; english: string }[]
  messages: { role: string; turkish: string }[]
  remainingSec: number
  knownGrammar: string[]
  introduceNew: boolean
  npcRole?: string
}) {
  const persona = options.npcRole
    ? `You are role-playing as a ${options.npcRole} in this scene: ${options.topic}. Stay in character. Do not speak for the learner.`
    : "You are a patient Turkish conversation partner for an English-speaking learner."
  return {
    system: `${persona} ${CEFR_GUIDE[options.cefr]}
${grammarPromptBlock(options.knownGrammar, options.introduceNew)}
Speak only Turkish in the turkish field. Keep turns short (1–2 sentences plus one simple question) so the learner has time to answer.
Encourage the target vocabulary without forcing it. Ask natural follow-ups. Stay on topic. Do not interrupt or talk over the learner.
If remainingSec is under 20, wrap up politely and do not ask another question (endConversation=true).
Return JSON only.`,
    user: JSON.stringify({
      topic: options.topic,
      speaker: options.npcRole,
      cefr: options.cefr,
      targetWords: options.targetWords,
      remainingSec: options.remainingSec,
      history: options.messages.slice(-12),
    }),
  }
}

export function dialogueTurnPrompt(options: {
  scenario: string
  speaker: string
  cefr: CefrLevel
  targetWords: { turkish: string; english: string }[]
  messages: { role: string; turkish: string }[]
  knownGrammar: string[]
  introduceNew: boolean
  opening: boolean
}) {
  const base = conversationTurnPrompt({
    topic: options.scenario,
    cefr: options.cefr,
    targetWords: options.targetWords,
    messages: options.messages,
    remainingSec: 120,
    knownGrammar: options.knownGrammar,
    introduceNew: options.introduceNew,
    npcRole: options.speaker,
  })
  return {
    system: `${base.system}
You always answer as the ${options.speaker}. ${
      options.opening
        ? "This is the opening turn: greet the learner in spoken Turkish and start the situation with one natural question."
        : "Reply only to the learner's last message, in character."
    }
Return JSON only with speaker, turkish, and english.`,
    user: JSON.stringify({
      scenario: options.scenario,
      speaker: options.speaker,
      cefr: options.cefr,
      opening: options.opening,
      targetWords: options.targetWords,
      history: options.messages.slice(-12),
    }),
  }
}

export function vocabGroupsPrompt(words: { id: string; turkish: string; english: string }[]) {
  return {
    system: `You group a learner's Turkish vocabulary into study categories.
Use only the given ids. Do not invent words.
Put conjunctions and discourse markers (çünkü, aslında, bu yüzden, ayrıca, ama, fakat, yani, mesela, oysa, üstelik) in a group named "Sentence glue" when they appear.
Other groups should be useful for a test: food, people, motion, home, work, feelings, and similar.
5–12 groups. Skip tiny groups of one word unless it is Sentence glue.
Return JSON only: { "groups": [ { "name": "...", "help": "...", "ids": ["..."] } ] }.`,
    user: JSON.stringify({ words }),
  }
}

export function vocabTopicPrompt(topic: string, words: { id: string; turkish: string; english: string }[]) {
  return {
    system: `You pick vocabulary from a learner's existing list that fits a subject.
Use only given ids. Prefer clear matches (holiday → sea, sun, beach, travel if those ids exist).
If the list has no perfect match, pick the closest related words rather than returning nothing.
Return JSON only: { "ids": ["..."], "note": "short reason" }.`,
    user: JSON.stringify({ topic, words }),
  }
}

export function conversationReportPrompt(options: {
  topic: string
  cefr: CefrLevel
  targetWords: { turkish: string; english: string }[]
  messages: { role: string; turkish: string; transcript?: string }[]
}) {
  return {
    system: `You coach a Turkish learner after a spoken conversation. Be specific and kind.
Do not claim to have heard pronunciation — you only have transcripts.
Return JSON with targetUsed, targetMissed, vocabMistakes, grammarMistakes, improvements, newExpressions, reviewWords.`,
    user: JSON.stringify(options),
  }
}
